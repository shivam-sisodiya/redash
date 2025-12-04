import { find, has } from "lodash";
import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import moment from "moment";
import { markdown } from "markdown";

import Button from "antd/lib/button";
import Dropdown from "antd/lib/dropdown";
import Menu from "antd/lib/menu";
import Tooltip from "@/components/Tooltip";
import Link from "@/components/Link";
import routeWithApiKeySession from "@/components/ApplicationArea/routeWithApiKeySession";
import Parameters from "@/components/Parameters";
import { Moment } from "@/components/proptypes";
import TimeAgo from "@/components/TimeAgo";
import Timer from "@/components/Timer";
import QueryResultsLink from "@/components/EditVisualizationButton/QueryResultsLink";
import VisualizationName from "@/components/visualizations/VisualizationName";
import VisualizationRenderer from "@/components/visualizations/VisualizationRenderer";

import FileOutlinedIcon from "@ant-design/icons/FileOutlined";
import FileExcelOutlinedIcon from "@ant-design/icons/FileExcelOutlined";

import { VisualizationType } from "@redash/viz/lib";
import HtmlContent from "@redash/viz/lib/components/HtmlContent";

import { formatDateTime } from "@/lib/utils";
import useImmutableCallback from "@/lib/hooks/useImmutableCallback";
import { Query } from "@/services/query";
import location from "@/services/location";
import routes from "@/services/routes";
import axiosLib from "axios";

// import logoUrl from "@/assets/images/redash_icon_small.png";

function VisualizationEmbedHeader({ queryName, queryDescription, visualization }) {
  return (
    <div className="embed-heading p-b-10 p-r-15 p-l-15">
      <h3>
        <VisualizationName visualization={visualization} /> {queryName}
        {queryDescription && (
          <small>
            <HtmlContent className="markdown text-muted">{markdown.toHTML(queryDescription || "")}</HtmlContent>
          </small>
        )}
      </h3>
    </div>
  );
}

VisualizationEmbedHeader.propTypes = {
  queryName: PropTypes.string.isRequired,
  queryDescription: PropTypes.string,
  visualization: VisualizationType.isRequired,
};

VisualizationEmbedHeader.defaultProps = { queryDescription: "" };

function VisualizationEmbedFooter({
  query,
  queryResults,
  updatedAt,
  refreshStartedAt,
  queryUrl,
  hideTimestamp,
  apiKey,
  onDownloadStart,
  onDownloadComplete,
  downloadStartedAt,
}) {

  // Download handler that uses new async endpoint
  const handleDownload = async (fileType) => {
    try {
      onDownloadStart();
      // Get current parameter values
      const parameters = query.getParameters ? query.getParameters().getExecutionValues() : {};
      
      // Build URL with API key if needed
      let url = `api/queries/${query.id}/download.${fileType}`;
      if (apiKey) {
        url += `?api_key=${apiKey}`;
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
               'text/csv')
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const contentDisposition = response.headers['content-disposition'];
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || contentDisposition.split("filename*=")[1]?.split("''")[1]
        : `${query.name || `query_${query.id}`}.${fileType}`;
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
          onDownloadComplete();
          return;
        }
        errorMessage = error.response.data?.message || error.message || errorMessage;
      } else {
        errorMessage = error.message || errorMessage;
      }
      alert(`Download failed: ${errorMessage}`);
    } finally {
      onDownloadComplete();
    }
  };

  const downloadMenu = (
    <Menu>
      <Menu.Item onClick={() => handleDownload('csv')}>
        <FileOutlinedIcon /> Download as CSV File
      </Menu.Item>
      {/* <Menu.Item onClick={() => handleDownload('tsv')}>
        <FileOutlinedIcon /> Download as TSV File
      </Menu.Item> */}
      {/* <Menu.Item onClick={() => handleDownload('xlsx')}>
        <FileExcelOutlinedIcon /> Download as Excel File
      </Menu.Item> */}
      <Menu.Item onClick={() => handleDownload('pdf')}>
        <FileExcelOutlinedIcon /> Download as Pdf File
      </Menu.Item>
    </Menu>
  );

  return (
    <div className="tile__bottom-control">
      {!hideTimestamp && (
        <span>
          <span className="small hidden-print">
            <i className="zmdi zmdi-time-restore" aria-hidden="true" />{" "}
            {refreshStartedAt ? <Timer from={refreshStartedAt} /> : <TimeAgo date={updatedAt} />}
          </span>
          <span className="small visible-print">
            <i className="zmdi zmdi-time-restore" aria-hidden="true" /> {formatDateTime(updatedAt)}
          </span>
        </span>
      )}
      {queryUrl && (
        <span className="hidden-print">
          <Tooltip title="Open in Redash">
            <Link.Button className="icon-button" href={queryUrl} target="_blank">
              <i className="fa fa-external-link" aria-hidden="true" />
              <span className="sr-only">Open in Redash</span>
            </Link.Button>
          </Tooltip>
          {/* {!query.hasParameters() && ( */}
            <Dropdown 
              overlay={downloadMenu} 
              disabled={!queryResults || !!downloadStartedAt} 
              trigger={["click"]} 
              placement="topLeft">
              <Button loading={(!queryResults && !!refreshStartedAt) || !!downloadStartedAt} className="m-l-5">
                Download Dataset
                <i className="fa fa-caret-up m-l-5" aria-hidden="true" />
              </Button>
            </Dropdown>
          {/* ) */}
          {/* } */}
        </span>
      )}
    </div>
  );
}

VisualizationEmbedFooter.propTypes = {
  query: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  queryResults: PropTypes.object, // eslint-disable-line react/forbid-prop-types
  updatedAt: PropTypes.string,
  refreshStartedAt: Moment,
  queryUrl: PropTypes.string,
  hideTimestamp: PropTypes.bool,
  apiKey: PropTypes.string,
  onDownloadStart: PropTypes.func,
  onDownloadComplete: PropTypes.func,
  downloadStartedAt: Moment,
};

VisualizationEmbedFooter.defaultProps = {
  queryResults: null,
  updatedAt: null,
  refreshStartedAt: null,
  queryUrl: null,
  hideTimestamp: false,
  apiKey: null,
  onDownloadStart: () => {},
  onDownloadComplete: () => {},
  downloadStartedAt: null,
};

function VisualizationEmbed({ queryId, visualizationId, apiKey, onError }) {
  const [query, setQuery] = useState(null);
  const [error, setError] = useState(null);
  const [refreshStartedAt, setRefreshStartedAt] = useState(null);
  const [queryResults, setQueryResults] = useState(null);
  const [downloadStartedAt, setDownloadStartedAt] = useState(null);

  const handleError = useImmutableCallback(onError);

  useEffect(() => {
    let isCancelled = false;
    Query.get({ id: queryId })
      .then(result => {
        if (!isCancelled) {
          setQuery(result);
        }
      })
      .catch(handleError);

    return () => {
      isCancelled = true;
    };
  }, [queryId, handleError]);

  const refreshQueryResults = useCallback(() => {
    if (query) {
      setError(null);
      setRefreshStartedAt(moment());
      query
        .getQueryResultPromise()
        .then(result => {
          setQueryResults(result);
        })
        .catch(err => {
          setError(err.getError());
        })
        .finally(() => setRefreshStartedAt(null));
    }
  }, [query]);

  useEffect(() => {
    document.querySelector("body").classList.add("headless");
    refreshQueryResults();
  }, [refreshQueryResults]);

  if (!query) {
    return null;
  }

  const hideHeader = has(location.search, "hide_header");
  const hideParametersUI = has(location.search, "hide_parameters");
  const hideQueryLink = has(location.search, "hide_link");
  const hideTimestamp = has(location.search, "hide_timestamp");

  const showQueryDescription = has(location.search, "showDescription");
  visualizationId = parseInt(visualizationId, 10);
  const visualization = find(query.visualizations, vis => vis.id === visualizationId);

  if (!visualization) {
    // call error handler async, otherwise it will destroy the component on render phase
    setTimeout(() => {
      onError(new Error("Visualization does not exist"));
    }, 10);
    return null;
  }

  return (
    <div className="tile m-t-10 m-l-10 m-r-10 p-t-10 embed__vis" data-test="VisualizationEmbed">
      {!hideHeader && (
        <VisualizationEmbedHeader
          queryName={query.name}
          queryDescription={showQueryDescription ? query.description : null}
          visualization={visualization}
        />
      )}
      <div className="col-md-12 query__vis">
        {!hideParametersUI && query.hasParameters() && (
          <div className="p-t-15 p-b-10">
            <Parameters parameters={query.getParametersDefs()} onValuesChange={refreshQueryResults} />
          </div>
        )}
        {error && <div className="alert alert-danger" data-test="ErrorMessage">{`Error: ${error}`}</div>}
        {refreshStartedAt && (
          <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '200px' }}>
            <div className="spinner">
              <i className="zmdi zmdi-refresh zmdi-hc-spin zmdi-hc-5x" aria-hidden="true" />
            </div>
            <div className="m-t-15" style={{ fontSize: '16px', color: '#666' }}>
              Refreshing...
            </div>
          </div>
        )}
        {!error && queryResults && !refreshStartedAt && (
          <VisualizationRenderer visualization={visualization} queryResult={queryResults} context="widget" />
        )}
      </div>
      <VisualizationEmbedFooter
        query={query}
        queryResults={queryResults}
        updatedAt={queryResults ? queryResults.getUpdatedAt() : undefined}
        refreshStartedAt={refreshStartedAt}
        queryUrl={!hideQueryLink ? query.getUrl() : null}
        hideTimestamp={hideTimestamp}
        apiKey={apiKey}
        onDownloadStart={() => setDownloadStartedAt(moment())}
        onDownloadComplete={() => setDownloadStartedAt(null)}
        downloadStartedAt={downloadStartedAt}
      />
    </div>
  );
}

VisualizationEmbed.propTypes = {
  queryId: PropTypes.string.isRequired,
  visualizationId: PropTypes.string,
  apiKey: PropTypes.string.isRequired,
  onError: PropTypes.func,
};

VisualizationEmbed.defaultProps = {
  onError: () => {},
};

routes.register(
  "Visualizations.ViewShared",
  routeWithApiKeySession({
    path: "/embed/query/:queryId/visualization/:visualizationId",
    render: pageProps => <VisualizationEmbed {...pageProps} />,
    getApiKey: () => location.search.api_key,
  })
);
