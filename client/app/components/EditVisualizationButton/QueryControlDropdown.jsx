import React, { useState } from "react";
import PropTypes from "prop-types";
import Dropdown from "antd/lib/dropdown";
import Menu from "antd/lib/menu";
import Button from "antd/lib/button";
import PlainButton from "@/components/PlainButton";
import { clientConfig } from "@/services/auth";
import axiosLib from "axios";

import PlusCircleFilledIcon from "@ant-design/icons/PlusCircleFilled";
import ShareAltOutlinedIcon from "@ant-design/icons/ShareAltOutlined";
import FileOutlinedIcon from "@ant-design/icons/FileOutlined";
import FileExcelOutlinedIcon from "@ant-design/icons/FileExcelOutlined";
import EllipsisOutlinedIcon from "@ant-design/icons/EllipsisOutlined";

export default function QueryControlDropdown(props) {
  const [isDownloading, setIsDownloading] = useState(false);
  const isDownloadDisabled = props.queryExecuting || !props.queryResult.getData || !props.queryResult.getData() || isDownloading;

  // Download handler that uses new async endpoint (removes limits)
  const handleDownload = async (fileType) => {
    if (isDownloading) return; // Prevent multiple simultaneous downloads
    
    try {
      setIsDownloading(true);
      // Get current parameter values
      const parameters = props.query.getParameters ? props.query.getParameters().getExecutionValues() : {};
      
      // Build URL with API key if needed
      let url = `api/queries/${props.query.id}/download.${fileType}`;
      if (props.apiKey) {
        url += `?api_key=${props.apiKey}`;
      }
      
      // Use axiosLib directly to bypass interceptor that converts to response.data
      const response = await axiosLib.post(url, { parameters }, {
        responseType: 'blob',
        xsrfCookieName: 'csrf_token',
        xsrfHeaderName: 'X-CSRF-TOKEN',
      });
      
      // Create blob and trigger download
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 
              (fileType === 'pdf' ? 'application/pdf' : 
               fileType === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
               fileType === 'tsv' ? 'text/tab-separated-values' :
               'text/csv')
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const contentDisposition = response.headers['content-disposition'];
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || contentDisposition.split("filename*=")[1]?.split("''")[1]
        : `${props.query.name || `query_${props.query.id}`}.${fileType}`;
      link.download = decodeURIComponent(filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed:', error);
      let errorMessage = 'Unknown error';
      if (error.response) {
        // Try to read error message from blob response
        if (error.response.data instanceof Blob) {
          error.response.data.text().then(text => {
            try {
              const json = JSON.parse(text);
              alert(`Download failed: ${json.message || errorMessage}`);
            } catch {
              alert(`Download failed: ${errorMessage}`);
            }
          });
          setIsDownloading(false);
          return;
        }
        errorMessage = error.response.data?.message || error.message || errorMessage;
      } else {
        errorMessage = error.message || errorMessage;
      }
      alert(`Download failed: ${errorMessage}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const menu = (
    <Menu>
      {!props.query.isNew() && (!props.query.is_draft || !props.query.is_archived) && (
        <Menu.Item>
          <PlainButton onClick={() => props.openAddToDashboardForm(props.selectedTab)}>
            <PlusCircleFilledIcon /> Add to Dashboard
          </PlainButton>
        </Menu.Item>
      )}
      {!clientConfig.disablePublicUrls && !props.query.isNew() && (
        <Menu.Item>
          <PlainButton
            onClick={() => props.showEmbedDialog(props.query, props.selectedTab)}
            data-test="ShowEmbedDialogButton">
            <ShareAltOutlinedIcon /> Embed Elsewhere
          </PlainButton>
        </Menu.Item>
      )}
      <Menu.Item disabled={isDownloadDisabled} onClick={() => !isDownloadDisabled && handleDownload('csv')}>
        <FileOutlinedIcon /> Download as CSV File
      </Menu.Item>
      {/* <Menu.Item disabled={isDownloadDisabled} onClick={() => !isDownloadDisabled && handleDownload('tsv')}>
        <FileOutlinedIcon /> Download as TSV File
      </Menu.Item>
      <Menu.Item disabled={isDownloadDisabled} onClick={() => !isDownloadDisabled && handleDownload('xlsx')}>
        <FileExcelOutlinedIcon /> Download as Excel File
      </Menu.Item> */}
      <Menu.Item disabled={isDownloadDisabled} onClick={() => !isDownloadDisabled && handleDownload('pdf')}>
        <FileExcelOutlinedIcon /> Download as PDF File
      </Menu.Item>
    </Menu>
  );

  return (
    <Dropdown 
      trigger={["click"]} 
      overlay={menu} 
      overlayClassName="query-control-dropdown-overlay"
      disabled={isDownloading}>
      <Button data-test="QueryControlDropdownButton" loading={isDownloading} disabled={isDownloading}>
        <EllipsisOutlinedIcon rotate={90} />
      </Button>
    </Dropdown>
  );
}

QueryControlDropdown.propTypes = {
  query: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  queryResult: PropTypes.object, // eslint-disable-line react/forbid-prop-types
  queryExecuting: PropTypes.bool.isRequired,
  showEmbedDialog: PropTypes.func.isRequired,
  embed: PropTypes.bool,
  apiKey: PropTypes.string,
  selectedTab: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  openAddToDashboardForm: PropTypes.func.isRequired,
};

QueryControlDropdown.defaultProps = {
  queryResult: {},
  embed: false,
  apiKey: "",
  selectedTab: "",
};
