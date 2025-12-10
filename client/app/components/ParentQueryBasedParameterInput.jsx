import { find, isArray, get, first, map, intersection, isEqual, isEmpty, uniq } from "lodash";
import React from "react";
import PropTypes from "prop-types";
import SelectWithVirtualScroll from "@/components/SelectWithVirtualScroll";

export default class ParentQueryBasedParameterInput extends React.Component {
  static propTypes = {
    parameter: PropTypes.any, // eslint-disable-line react/forbid-prop-types
    value: PropTypes.any, // eslint-disable-line react/forbid-prop-types
    mode: PropTypes.oneOf(["default", "multiple"]),
    queryId: PropTypes.number,
    onSelect: PropTypes.func,
    className: PropTypes.string,
    allParameters: PropTypes.array, // All parameters for parent dependency tracking
  };

  static defaultProps = {
    value: null,
    mode: "default",
    parameter: null,
    queryId: null,
    onSelect: () => {},
    className: "",
    allParameters: [],
  };

  constructor(props) {
    super(props);
    this.state = {
      options: [],
      value: null,
      loading: false,
      queryData: null, // Store full query results (parent key, child value pairs)
      lastKnownParentValues: {}, // Track last known parent values
    };
  }

  componentDidMount() {
    this._loadQueryData();
    this._initializeParentTracking();
  }

  componentDidUpdate(prevProps) {
    const { queryId, allParameters } = this.props;
    
    // Reload query data if queryId changed
    if (queryId !== prevProps.queryId) {
      this._loadQueryData();
      return;
    }
    
    // Always check if parent values changed (even if allParameters reference didn't change)
    // This is important because parent values can change via pendingValue
    // We need to check this on every update to catch pendingValue changes
    if (this.state.queryData) {
      this._checkParentValuesChanged();
    }
    
    // Update value if prop changed
    if (this.props.value !== prevProps.value) {
      this.setValue(this.props.value);
    }
  }

  _initializeParentTracking() {
    const { parameter, allParameters } = this.props;
    const { parentKeywords } = parameter;
    
    if (!parentKeywords || parentKeywords.length === 0) {
      return;
    }

    const lastKnownValues = {};
    parentKeywords.forEach((parentKeyword) => {
      const parentParam = this._findParentParameter(parentKeyword);
      if (parentParam) {
        lastKnownValues[parentKeyword] = this._getParameterValue(parentParam);
      }
    });
    
    this.setState({ lastKnownParentValues: lastKnownValues });
  }

  _findParentParameter(parentKeyword) {
    const { allParameters } = this.props;
    // Try to find by title first, then by name (case-insensitive)
    const found = allParameters.find(
      (p) => 
        (p.title && p.title.toLowerCase().trim() === parentKeyword.toLowerCase().trim()) ||
        (p.name && p.name.toLowerCase().trim() === parentKeyword.toLowerCase().trim())
    );
    
    if (!found) {
      console.warn(`[ParentQueryBasedParameterInput] Parent parameter not found for keyword: "${parentKeyword}"`, {
        availableParams: allParameters.map(p => ({ name: p.name, title: p.title })),
        searchingFor: parentKeyword
      });
    }
    
    return found;
  }

  _getParameterValue(param) {
    // Get pending value if it exists, otherwise get the actual value
    // This allows cascading to work immediately without clicking "Apply Changes"
    if (param && param.pendingValue !== undefined) {
      return param.pendingValue;
    }
    return param?.value;
  }

  _checkParentValuesChanged() {
    const { parameter, allParameters } = this.props;
    const { parentKeywords } = parameter;
    const { lastKnownParentValues, queryData } = this.state;
    
    if (!parentKeywords || parentKeywords.length === 0 || !queryData) {
      return;
    }

    let parentValuesChanged = false;
    const currentParentValues = {};

    parentKeywords.forEach((parentKeyword) => {
      const parentParam = this._findParentParameter(parentKeyword);
      if (parentParam) {
        const currentValue = this._getParameterValue(parentParam);
        const lastKnownValue = lastKnownParentValues[parentKeyword];
        
        currentParentValues[parentKeyword] = currentValue;
        
        // Compare values (handle arrays)
        let changed = false;
        if (isArray(currentValue) && isArray(lastKnownValue)) {
          changed = !isEqual(currentValue.sort(), lastKnownValue.sort());
        } else {
          changed = currentValue !== lastKnownValue;
        }
        
        if (changed) {
          parentValuesChanged = true;
        }
      }
    });

    if (parentValuesChanged) {
      this.setState({ lastKnownParentValues: currentParentValues }, () => {
        this._updateOptionsFromQueryData();
      });
    }
  }

  async _loadQueryData() {
    const { queryId, parameter } = this.props;
    
    if (!queryId) {
      this.setState({ queryData: null, options: [] });
      return;
    }

    this.setState({ loading: true });
    
    try {
      const result = await parameter.loadQueryResults();
      
      // Extract data from result - handle different response formats
      // Expected format: { query_result: { data: { columns: [], rows: [] } } }
      let queryData = null;
      if (result && result.query_result && result.query_result.data) {
        queryData = result.query_result.data;
      } else if (result && result.data) {
        queryData = result.data;
      } else if (result && result.columns && result.rows) {
        queryData = result;
      }

      if (queryData && Array.isArray(queryData.columns) && Array.isArray(queryData.rows)) {
        console.log("[ParentQueryBasedParameterInput] Query data loaded successfully", {
          columns: queryData.columns.map(c => c.name),
          rowCount: queryData.rows.length,
          firstRow: queryData.rows[0]
        });
        this.setState({ queryData, loading: false }, () => {
          this._updateOptionsFromQueryData();
        });
      } else {
        console.warn("[ParentQueryBasedParameterInput] Invalid query data format:", result);
        this.setState({ queryData: null, options: [], loading: false });
      }
    } catch (error) {
      console.error("Error loading query data:", error);
      this.setState({ queryData: null, options: [], loading: false });
    }
  }

  _updateOptionsFromQueryData() {
    const { parameter, allParameters } = this.props;
    const { queryData, lastKnownParentValues } = this.state;
    const { parentKeywords, parentKeyColumn, childValueColumn } = parameter;

    if (!queryData || !queryData.columns || !queryData.rows) {
      console.log("[ParentQueryBasedParameterInput] No query data available");
      this.setState({ options: [] });
      return;
    }

    console.log("[ParentQueryBasedParameterInput] Updating options from query data", {
      columns: queryData.columns,
      rowCount: queryData.rows.length,
      parentKeywords,
      parentKeyColumn,
      childValueColumn,
      firstRowStructure: queryData.rows[0] ? (Array.isArray(queryData.rows[0]) ? 'array' : 'object') : 'empty',
      firstRow: queryData.rows[0]
    });

    // Determine column names (rows are objects, not arrays)
    // For multiple parents, columns should be in order: parent1, parent2, ..., child
    const parentCount = parentKeywords ? parentKeywords.length : 0;
    let parentKeyColNames = [];
    let childValueColName = null;

    if (parentKeyColumn) {
      // If parentKeyColumn is specified, split by comma for multiple parents
      // Otherwise use it as single column
      if (parentKeyColumn.includes(",")) {
        parentKeyColNames = parentKeyColumn.split(",").map(c => c.trim()).filter(Boolean);
      } else {
        parentKeyColNames = [parentKeyColumn];
      }
    } else {
      // Default: use first N columns for N parents
      parentKeyColNames = queryData.columns.slice(0, parentCount).map(col => col.name);
    }

    // Ensure we have enough columns for all parents
    while (parentKeyColNames.length < parentCount) {
      const nextColIndex = parentKeyColNames.length;
      if (queryData.columns[nextColIndex]) {
        parentKeyColNames.push(queryData.columns[nextColIndex].name);
      } else {
        console.warn(`[ParentQueryBasedParameterInput] Not enough columns for ${parentCount} parents`);
        break;
      }
    }

    if (childValueColumn) {
      // Use specified column name
      childValueColName = childValueColumn;
    } else {
      // Default: use column after all parent columns
      const childColIndex = parentKeyColNames.length;
      childValueColName = queryData.columns[childColIndex]?.name || queryData.columns[0]?.name || null;
    }

    // Verify columns exist
    parentKeyColNames = parentKeyColNames.filter(colName => {
      const exists = queryData.columns.find((col) => col.name === colName);
      if (!exists) {
        console.warn(`[ParentQueryBasedParameterInput] Parent key column "${colName}" not found in query results`);
      }
      return exists;
    });

    if (!childValueColName || !queryData.columns.find((col) => col.name === childValueColName)) {
      console.warn(`[ParentQueryBasedParameterInput] Child value column "${childValueColName}" not found in query results`);
      childValueColName = queryData.columns[parentKeyColNames.length]?.name || queryData.columns[0]?.name || null;
    }

    console.log("[ParentQueryBasedParameterInput] Column names", {
      parentKeyColNames,
      parentCount,
      childValueColName,
      allColumns: queryData.columns.map((c) => c.name),
      sampleRow: queryData.rows[0] ? {
        parentKeys: parentKeyColNames.map(col => queryData.rows[0][col]),
        childValue: queryData.rows[0][childValueColName],
        fullRow: queryData.rows[0]
      } : null
    });

    // If no parent keywords, show all values
    if (!parentKeywords || parentKeywords.length === 0) {
      const allValues = uniq(queryData.rows.map((row) => row[childValueColName]).filter(Boolean));
      const options = allValues.map((value) => ({ name: String(value), value }));
      console.log("[ParentQueryBasedParameterInput] No parent keywords, showing all values", { count: options.length });
      this.setState({ options }, () => {
        this.setValue(this.props.value);
      });
      return;
    }

    // Filter rows based on parent values
    // For multiple parents, ALL conditions must match (AND logic)
    let filteredRows = queryData.rows;
    let allParentsSelected = true;

    // Apply filters for each parent (in order)
    parentKeywords.forEach((parentKeyword, parentIndex) => {
      const parentParam = this._findParentParameter(parentKeyword);
      const parentKeyColName = parentKeyColNames[parentIndex];
      
      if (!parentKeyColName) {
        console.warn(`[ParentQueryBasedParameterInput] No column found for parent ${parentIndex + 1} "${parentKeyword}"`);
        allParentsSelected = false;
        filteredRows = [];
        return;
      }
      
      if (parentParam) {
        const parentValue = this._getParameterValue(parentParam);
        
        console.log(`[ParentQueryBasedParameterInput] Checking parent ${parentIndex + 1} "${parentKeyword}"`, {
          parentParam: { name: parentParam.name, title: parentParam.title },
          parentValue,
          valueType: typeof parentValue,
          isArray: isArray(parentValue),
          parentKeyColName
        });
        
        if (parentValue !== null && parentValue !== undefined && !(isArray(parentValue) && parentValue.length === 0)) {
          // Handle multi-select: if parent value is array, match any value
          if (isArray(parentValue) && parentValue.length > 0) {
            filteredRows = filteredRows.filter((row) => {
              const rowParentKey = row[parentKeyColName];
              // Convert both to strings for comparison to handle type mismatches
              const matches = parentValue.some(pv => String(pv) === String(rowParentKey));
              return matches;
            });
            console.log(`[ParentQueryBasedParameterInput] Filtered by array parent value (parent ${parentIndex + 1})`, {
              parentValue,
              parentKeyColName,
              remainingRows: filteredRows.length
            });
          } else if (!isArray(parentValue)) {
            // Single value - convert both to strings for comparison
            // First, let's see what values we're comparing
            const sampleRows = filteredRows.slice(0, 5).map(row => ({
              rowParentKey: row[parentKeyColName],
              rowParentKeyType: typeof row[parentKeyColName],
              rowParentKeyString: String(row[parentKeyColName])
            }));
            
            console.log(`[ParentQueryBasedParameterInput] Before filtering (parent ${parentIndex + 1}) - sample rows:`, {
              totalRows: filteredRows.length,
              sampleRows,
              parentValue,
              parentValueType: typeof parentValue,
              parentValueString: String(parentValue),
              parentKeyColName
            });
            
            filteredRows = filteredRows.filter((row) => {
              const rowParentKey = row[parentKeyColName];
              const matches = String(rowParentKey) === String(parentValue);
              if (!matches && filteredRows.length <= 10) {
                // Log first few mismatches for debugging
                console.log(`[ParentQueryBasedParameterInput] Mismatch (parent ${parentIndex + 1}):`, {
                  rowParentKey,
                  rowParentKeyString: String(rowParentKey),
                  parentValue,
                  parentValueString: String(parentValue),
                  match: false
                });
              }
              return matches;
            });
            
            console.log(`[ParentQueryBasedParameterInput] Filtered by single parent value (parent ${parentIndex + 1})`, {
              parentValue,
              parentValueString: String(parentValue),
              parentKeyColName,
              remainingRows: filteredRows.length,
              sampleFilteredRows: filteredRows.slice(0, 3).map(row => row[parentKeyColName])
            });
          }
        } else {
          // Parent not selected - no options available
          allParentsSelected = false;
          filteredRows = [];
          console.log(`[ParentQueryBasedParameterInput] Parent ${parentIndex + 1} "${parentKeyword}" not selected, clearing options`);
        }
      } else {
        allParentsSelected = false;
        console.warn(`[ParentQueryBasedParameterInput] Parent parameter not found for keyword: "${parentKeyword}"`);
        filteredRows = [];
      }
    });

    // Extract unique child values from filtered rows
    const childValues = uniq(filteredRows.map((row) => row[childValueColName]).filter(Boolean));
    const options = childValues.map((value) => ({ name: String(value), value }));

    console.log("[ParentQueryBasedParameterInput] Final options", {
      filteredRowCount: filteredRows.length,
      uniqueChildValues: childValues.length,
      optionsCount: options.length,
      allParentsSelected
    });

    this.setState({ options }, () => {
      const updatedValue = this.setValue(this.props.value);
      // If current value is not in new options, clear it
      if (updatedValue !== this.props.value) {
        this.props.onSelect(updatedValue);
      }
    });
  }

  setValue(value) {
    const { options } = this.state;
    if (this.props.mode === "multiple") {
      value = isArray(value) ? value : [value];
      const optionValues = map(options, (option) => option.value);
      const validValues = intersection(value, optionValues);
      this.setState({ value: validValues });
      return validValues;
    }
    const found = find(options, (option) => option.value === this.props.value) !== undefined;
    value = found ? value : get(first(options), "value");
    this.setState({ value });
    return value;
  }

  handleSelectAll = () => {
    const { options } = this.state;
    const { mode, onSelect } = this.props;
    const currentValue = this.state.value || [];

    if (mode === "multiple") {
      const allValues = map(options, (option) => option.value);
      const isAllSelected = allValues.length > 0 && allValues.every((val) => currentValue.includes(val));

      if (isAllSelected) {
        // Deselect all
        onSelect([]);
      } else {
        // Select all
        onSelect(allValues);
      }
    }
  };

  render() {
    const { className, mode, onSelect, value, ...otherProps } = this.props;
    const { loading, options } = this.state;
    const currentValue = this.state.value || [];
    const allValues = map(options, (option) => option.value);
    const isAllSelected = mode === "multiple" && allValues.length > 0 && allValues.every((val) => currentValue.includes(val));

    const selectOptions = map(options, ({ value, name }) => ({ label: String(name), value }));

    // Add "Select All" option for multiple mode
    const dropdownRender =
      mode === "multiple" && options.length > 0
        ? (menu) => (
            <div>
              <div
                style={{
                  padding: "4px 8px",
                  cursor: "pointer",
                  borderBottom: "1px solid #f0f0f0",
                  background: isAllSelected ? "#e6f7ff" : "transparent",
                }}
                onClick={this.handleSelectAll}
                onMouseDown={(e) => e.preventDefault()}
              >
                <span style={{ fontWeight: isAllSelected ? "bold" : "normal" }}>
                  {isAllSelected ? "✓ " : ""}Select All
                </span>
              </div>
              {menu}
            </div>
          )
        : undefined;

    return (
      <span>
        <SelectWithVirtualScroll
          className={className}
          disabled={loading}
          loading={loading}
          mode={mode}
          value={this.state.value}
          onChange={onSelect}
          options={selectOptions}
          showSearch
          showArrow
          notFoundContent={isEmpty(options) ? "No options available" : null}
          dropdownRender={dropdownRender}
          {...otherProps}
        />
      </span>
    );
  }
}

