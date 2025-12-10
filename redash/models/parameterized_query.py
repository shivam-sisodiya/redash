import re
from functools import partial
from numbers import Number

import pystache
from dateutil.parser import parse
from funcy import distinct

from redash.utils import mustache_render


def _pluck_name_and_value(default_column, row):
    row = {k.lower(): v for k, v in row.items()}
    name_column = "name" if "name" in row.keys() else default_column.lower()
    value_column = "value" if "value" in row.keys() else default_column.lower()

    return {"name": row[name_column], "value": str(row[value_column])}


def _load_result(query_id, org):
    from redash import models

    query = models.Query.get_by_id_and_org(query_id, org)

    if query.data_source:
        query_result = models.QueryResult.get_by_id_and_org(query.latest_query_data_id, org)
        return query_result.data
    else:
        raise QueryDetachedFromDataSourceError(query_id)


def dropdown_values(query_id, org, column_name=None):
    """
    Get dropdown values from a query.
    
    Args:
        query_id: ID of the query
        org: Organization
        column_name: Optional column name to use. If None, uses first column.
                    Column name matching is case-insensitive.
    
    Returns:
        List of dicts with 'name' and 'value' keys
    """
    data = _load_result(query_id, org)
    
    if column_name:
        # Find column by name (case-insensitive)
        column_to_use = None
        column_name_lower = column_name.lower()
        for col in data["columns"]:
            if col["name"].lower() == column_name_lower:
                column_to_use = col["name"]
                break
        # If not found, fall back to first column
        if not column_to_use:
            column_to_use = data["columns"][0]["name"]
    else:
        # Default to first column
        column_to_use = data["columns"][0]["name"]
    
    pluck = partial(_pluck_name_and_value, column_to_use)
    return list(map(pluck, data["rows"]))


def join_parameter_list_values(parameters, schema):
    updated_parameters = {}
    for key, value in parameters.items():
        if isinstance(value, list):
            definition = next((definition for definition in schema if definition["name"] == key), {})
            multi_values_options = definition.get("multiValuesOptions", {})
            separator = str(multi_values_options.get("separator", ","))
            prefix = str(multi_values_options.get("prefix", ""))
            suffix = str(multi_values_options.get("suffix", ""))
            # Convert each value to string to handle integers and other types
            updated_parameters[key] = separator.join([prefix + str(v) + suffix for v in value])
        else:
            updated_parameters[key] = value
    return updated_parameters


def _collect_key_names(nodes):
    keys = []
    for node in nodes._parse_tree:
        if isinstance(node, pystache.parser._EscapeNode):
            keys.append(node.key)
        elif isinstance(node, pystache.parser._SectionNode):
            keys.append(node.key)
            keys.extend(_collect_key_names(node.parsed))

    return distinct(keys)


def _collect_query_parameters(query):
    nodes = pystache.parse(query)
    keys = _collect_key_names(nodes)
    return keys


def _parameter_names(parameter_values):
    names = []
    for key, value in parameter_values.items():
        if isinstance(value, dict):
            for inner_key in value.keys():
                names.append("{}.{}".format(key, inner_key))
        else:
            names.append(key)

    return names


def _is_number(string):
    if isinstance(string, Number):
        return True
    else:
        float(string)
        return True


def _is_regex_pattern(value, regex):
    try:
        if re.compile(regex).fullmatch(value):
            return True
        else:
            return False
    except re.error:
        return False


def _is_date(string):
    parse(string)
    return True


def _is_date_range(obj):
    return _is_date(obj["start"]) and _is_date(obj["end"])


def _is_value_within_options(value, dropdown_options, allow_list=False):
    if isinstance(value, list):
        return allow_list and set(map(str, value)).issubset(set(dropdown_options))
    return str(value) in dropdown_options


class ParameterizedQuery:
    def __init__(self, template, schema=None, org=None):
        self.schema = schema or []
        self.org = org
        self.template = template
        self.query = template
        self.parameters = {}

    # def apply(self, parameters):
    #     invalid_parameter_names = [key for (key, value) in parameters.items() if not self._valid(key, value)]
    #     if invalid_parameter_names:
    #         raise InvalidParameterError(invalid_parameter_names)
    #     else:
    #         self.parameters.update(parameters)
    #         self.query = mustache_render(self.template, join_parameter_list_values(parameters, self.schema))

    #     return self

    def apply(self, parameters):
        normalized = {}

        for key, value in parameters.items():
            # If empty → skip validation and skip rendering (Periscope behavior)
            if value in (None, "", []):
                parameters[key] = "NULL"
                continue   # <-- IMPORTANT!!!
            normalized[key] = value

        # Validate only NON-empty parameters
        invalid_parameter_names = [
            key for (key, value) in normalized.items()
            if not self._valid(key, value)
        ]
        if invalid_parameter_names:
            raise InvalidParameterError(invalid_parameter_names)

        # Render using only the NON-empty parameters
        self.parameters.update(parameters)
        self.query = mustache_render(
            self.template,
            join_parameter_list_values(parameters, self.schema)
        )
        return self




    def _valid(self, name, value):
        if not self.schema:
            return True

        definition = next(
            (definition for definition in self.schema if definition["name"] == name),
            None,
        )

        if not definition:
            return False

        enum_options = definition.get("enumOptions")
        query_id = definition.get("queryId")
        regex = definition.get("regex")
        allow_multiple_values = isinstance(definition.get("multiValuesOptions"), dict)
        # For query-with-parent, determine which column to use for validation
        child_value_column = None
        if definition.get("type") == "query-with-parent":
            child_value_column = definition.get("childValueColumn")
            # If not specified, infer from number of parent keywords
            if not child_value_column and query_id:
                try:
                    data = _load_result(query_id, self.org)
                    parent_count = len(definition.get("parentKeywords", []))
                    # Child column is after all parent columns
                    child_col_index = parent_count
                    if child_col_index < len(data["columns"]):
                        child_value_column = data["columns"][child_col_index]["name"]
                except Exception:
                    # If we can't load the query, fall back to first column
                    pass

        if isinstance(enum_options, str):
            enum_options = enum_options.split("\n")

        validators = {
            "text": lambda value: isinstance(value, str),
            "text-pattern": lambda value: _is_regex_pattern(value, regex),
            "number": _is_number,
            "enum": lambda value: _is_value_within_options(value, enum_options, allow_multiple_values),
            "query": lambda value: _is_value_within_options(
                value,
                [v["value"] for v in dropdown_values(query_id, self.org)],
                allow_multiple_values,
            ),
            "query-with-parent": lambda value: _is_value_within_options(
                value,
                [v["value"] for v in dropdown_values(query_id, self.org, child_value_column)],
                allow_multiple_values,
            ),  # Validates against child value column from query results
            "external-api": lambda value: True,  # External API parameters - skip validation (handled by frontend)
            "date": _is_date,
            "datetime-local": _is_date,
            "datetime-with-seconds": _is_date,
            "date-range": _is_date_range,
            "datetime-range": _is_date_range,
            "datetime-range-with-seconds": _is_date_range,
        }

        validate = validators.get(definition["type"], lambda x: False)

        try:
            # multiple error types can be raised here; but we want to convert
            # all except QueryDetached to InvalidParameterError in `apply`
            return validate(value)
        except QueryDetachedFromDataSourceError:
            raise
        except Exception:
            return False

    @property
    def is_safe(self):
        text_parameters = [param for param in self.schema if param["type"] == "text"]
        return not any(text_parameters)

    @property
    def missing_params(self):
        """
        Returns parameters that are missing and required.
        Parameters are optional by default - Mustache templates can handle missing 
        parameters by rendering them as empty strings. This allows dropdown filters
        and other parameters to be optional.
        """
        # Make all parameters optional by default
        # Mustache will render missing parameters as empty strings
        # query_parameters = set(_collect_query_parameters(self.template))
        # return set(query_parameters) - set(_parameter_names(self.parameters))
        return set()

    @property
    def text(self):
        return self.query


class InvalidParameterError(Exception):
    def __init__(self, parameters):
        parameter_names = ", ".join(parameters)
        message = "The following parameter values are incompatible with their definitions: {}".format(parameter_names)
        super(InvalidParameterError, self).__init__(message)


class QueryDetachedFromDataSourceError(Exception):
    def __init__(self, query_id):
        self.query_id = query_id
        super(QueryDetachedFromDataSourceError, self).__init__(
            "This query is detached from any data source. Please select a different query."
        )
