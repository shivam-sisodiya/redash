import { find, isArray, get, first, map, intersection, isEqual, isEmpty } from "lodash";
import React from "react";
import PropTypes from "prop-types";
import SelectWithVirtualScroll from "@/components/SelectWithVirtualScroll";

export default class QueryBasedParameterInput extends React.Component {
  static propTypes = {
    parameter: PropTypes.any, // eslint-disable-line react/forbid-prop-types
    value: PropTypes.any, // eslint-disable-line react/forbid-prop-types
    mode: PropTypes.oneOf(["default", "multiple"]),
    queryId: PropTypes.number,
    onSelect: PropTypes.func,
    className: PropTypes.string,
  };

  static defaultProps = {
    value: null,
    mode: "default",
    parameter: null,
    queryId: null,
    onSelect: () => {},
    className: "",
  };

  constructor(props) {
    super(props);
    this.state = {
      options: [],
      value: null,
      loading: false,
    };
  }

  componentDidMount() {
    this._loadOptions(this.props.queryId);
  }

  componentDidUpdate(prevProps) {
    if (this.props.queryId !== prevProps.queryId) {
      this._loadOptions(this.props.queryId);
    }
    if (this.props.value !== prevProps.value) {
      this.setValue(this.props.value);
    }
  }

  setValue(value) {
    const { options } = this.state;
    if (this.props.mode === "multiple") {
      value = isArray(value) ? value : [value];
      const optionValues = map(options, option => option.value);
      const validValues = intersection(value, optionValues);
      this.setState({ value: validValues });
      return validValues;
    }
    const found = find(options, option => option.value === this.props.value) !== undefined;
    value = found ? value : get(first(options), "value");
    this.setState({ value });
    return value;
  }

  async _loadOptions(queryId) {
    if (queryId && queryId !== this.state.queryId) {
      this.setState({ loading: true });
      const options = await this.props.parameter.loadDropdownValues();

      // stale queryId check
      if (this.props.queryId === queryId) {
        this.setState({ options, loading: false }, () => {
          const updatedValue = this.setValue(this.props.value);
          if (!isEqual(updatedValue, this.props.value)) {
            this.props.onSelect(updatedValue);
          }
        });
      }
    }
  }

  handleSelectAll = () => {
    const { options } = this.state;
    const { mode, onSelect } = this.props;
    const currentValue = this.state.value || [];
    
    if (mode === "multiple") {
      const allValues = map(options, option => option.value);
      const isAllSelected = allValues.length > 0 && allValues.every(val => currentValue.includes(val));
      
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
    const { className, mode, onSelect, queryId, value, ...otherProps } = this.props;
    const { loading, options } = this.state;
    const currentValue = this.state.value || [];
    const allValues = map(options, option => option.value);
    const isAllSelected = mode === "multiple" && allValues.length > 0 && allValues.every(val => currentValue.includes(val));
    
    const selectOptions = map(options, ({ value, name }) => ({ label: String(name), value }));
    
    // Add "Select All" option for multiple mode
    const dropdownRender = mode === "multiple" && options.length > 0 ? (menu) => (
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
    ) : undefined;
    
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
