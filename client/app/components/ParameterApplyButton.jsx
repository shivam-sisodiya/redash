import React from "react";
import PropTypes from "prop-types";
import Button from "antd/lib/button";
import Badge from "antd/lib/badge";
import Tooltip from "@/components/Tooltip";
import KeyboardShortcuts from "@/services/KeyboardShortcuts";

function ParameterApplyButton({ paramCount, onClick, alwaysVisible = false }) {
  // Always show tick icon (no spinner)
  const icon = <i className="fa fa-check" aria-hidden="true" />;

  // If alwaysVisible is true, always show the button (data-show="true")
  // Otherwise, only show when there are pending changes
  const shouldShow = alwaysVisible || !!paramCount;

  return (
    <div className="parameter-apply-button" data-show={shouldShow} data-test="ParameterApplyButton">
      <Badge count={paramCount}>
        <Tooltip title={paramCount ? `${KeyboardShortcuts.modKey} + Enter` : null}>
          <span>
            <Button onClick={onClick}>{icon} Apply Changes</Button>
          </span>
        </Tooltip>
      </Badge>
    </div>
  );
}

ParameterApplyButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  paramCount: PropTypes.number.isRequired,
  alwaysVisible: PropTypes.bool,
};

export default ParameterApplyButton;
