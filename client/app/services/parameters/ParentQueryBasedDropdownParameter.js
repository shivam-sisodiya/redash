import { isNull, isUndefined, isArray, isEmpty, get, map, join, has } from "lodash";
import { Query } from "@/services/query";
import Parameter from "./Parameter";

class ParentQueryBasedDropdownParameter extends Parameter {
  constructor(parameter, parentQueryId) {
    super(parameter, parentQueryId);
    this.queryId = parameter.queryId;
    this.parentKeywords = parameter.parentKeywords || []; // Array of parent parameter titles/keywords
    this.parentKeyColumn = parameter.parentKeyColumn || null; // Column name for parent key (default: first column)
    this.childValueColumn = parameter.childValueColumn || null; // Column name for child value (default: second column)
    this.multiValuesOptions = parameter.multiValuesOptions;
    this.setValue(parameter.value);
  }

  normalizeValue(value) {
    if (isUndefined(value) || isNull(value) || (isArray(value) && isEmpty(value))) {
      return null;
    }

    if (this.multiValuesOptions) {
      value = isArray(value) ? value : [value];
    } else {
      value = isArray(value) ? value[0] : value;
    }
    return value;
  }

  getExecutionValue(extra = {}) {
    const { joinListValues } = extra;
    if (joinListValues && isArray(this.value)) {
      const separator = get(this.multiValuesOptions, "separator", ",");
      const prefix = get(this.multiValuesOptions, "prefix", "");
      const suffix = get(this.multiValuesOptions, "suffix", "");
      const parameterValues = map(this.value, v => `${prefix}${v}${suffix}`);
      return join(parameterValues, separator);
    }
    return this.value;
  }

  toUrlParams() {
    const prefix = this.urlPrefix;

    let urlParam = this.value;
    if (this.multiValuesOptions && isArray(this.value)) {
      urlParam = JSON.stringify(this.value);
    }

    return {
      [`${prefix}${this.name}`]: !this.isEmpty ? urlParam : null,
    };
  }

  fromUrlParams(query) {
    const prefix = this.urlPrefix;
    const key = `${prefix}${this.name}`;
    if (has(query, key)) {
      if (this.multiValuesOptions) {
        try {
          const valueFromJson = JSON.parse(query[key]);
          this.setValue(isArray(valueFromJson) ? valueFromJson : query[key]);
        } catch (e) {
          this.setValue(query[key]);
        }
      } else {
        this.setValue(query[key]);
      }
    }
  }

  loadDropdownValues() {
    if (this.parentQueryId) {
      return Query.associatedDropdown({ queryId: this.parentQueryId, dropdownQueryId: this.queryId }).catch(() =>
        Promise.resolve([])
      );
    }

    return Query.asDropdown({ id: this.queryId }).catch(Promise.resolve([]));
  }

  // Load full query results (parent key, child value pairs)
  loadQueryResults() {
    // Use resultById to get full query results with columns and rows
    return Query.resultById({ id: this.queryId }).catch(() => Promise.resolve({ query_result: { data: { columns: [], rows: [] } } }));
  }
}

export default ParentQueryBasedDropdownParameter;

