import React, { useState } from "react";
import PropTypes from "prop-types";
import Button from "antd/lib/button";
import Modal from "antd/lib/modal";
import Radio from "antd/lib/radio";
import { wrap as wrapDialog, DialogPropType } from "@/components/DialogWrapper";

function PDFOrientationDialog({ dialog }) {
  const [orientation, setOrientation] = useState("landscape"); // Default to landscape

  const handleOk = () => {
    dialog.close(orientation);
  };

  const handleCancel = () => {
    dialog.dismiss();
  };

  return (
    <Modal
      {...dialog.props}
      title="Select PDF Orientation"
      footer={[
        <Button key="cancel" {...dialog.props.cancelButtonProps} onClick={handleCancel}>
          Cancel
        </Button>,
        <Button
          key="download"
          {...dialog.props.okButtonProps}
          type="primary"
          onClick={handleOk}
          data-test="DownloadPDFButton">
          Download
        </Button>,
      ]}
      wrapProps={{
        "data-test": "PDFOrientationDialog",
      }}>
      <div style={{ padding: "20px 0" }}>
        <Radio.Group
          value={orientation}
          onChange={e => setOrientation(e.target.value)}
          style={{ width: "100%" }}>
          <Radio value="landscape" style={{ display: "block", marginBottom: "16px", height: "30px", lineHeight: "30px" }}>
            <strong>Landscape</strong> (297mm × 210mm) - Better for wide tables with many columns
          </Radio>
          <Radio value="portrait" style={{ display: "block", height: "30px", lineHeight: "30px" }}>
            <strong>Portrait</strong> (210mm × 297mm) - Better for tall tables with many rows
          </Radio>
        </Radio.Group>
      </div>
    </Modal>
  );
}

PDFOrientationDialog.propTypes = {
  dialog: DialogPropType.isRequired,
};

export default wrapDialog(PDFOrientationDialog);

