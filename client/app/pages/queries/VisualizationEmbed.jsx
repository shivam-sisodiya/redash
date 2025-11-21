import { find, has } from "lodash";
import React, { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import moment from "moment";
import { markdown } from "markdown";

import Button from "antd/lib/button";
import Menu from "antd/lib/menu";
import routeWithApiKeySession from "@/components/ApplicationArea/routeWithApiKeySession";
import Parameters from "@/components/Parameters";
import { Moment } from "@/components/proptypes";
import TimeAgo from "@/components/TimeAgo";
import Timer from "@/components/Timer";
import QueryResultsLink from "@/components/EditVisualizationButton/QueryResultsLink";
import VisualizationName from "@/components/visualizations/VisualizationName";
import VisualizationRenderer from "@/components/visualizations/VisualizationRenderer";

import FilePdfOutlinedIcon from "@ant-design/icons/FilePdfOutlined";

import { VisualizationType } from "@redash/viz/lib";
import HtmlContent from "@redash/viz/lib/components/HtmlContent";

import { formatDateTime } from "@/lib/utils";
import useImmutableCallback from "@/lib/hooks/useImmutableCallback";
import { Query } from "@/services/query";
import location from "@/services/location";
import routes from "@/services/routes";
import Link from "@/components/Link";

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
  forExport,
  handleExportClick,
}) {
  // eslint-disable-next-line no-unused-vars
  const downloadMenu = (
    <Menu>
      { queryResults && queryResults.getBucketUrl() && (<Menu.Item>
        <QueryResultsLink
          fileType="pdf"
          query={query}
          queryResult={queryResults}
          apiKey={apiKey}
          disabled={!queryResults || !queryResults.getBucketUrl()}
          embed>
          <FilePdfOutlinedIcon /> Download as Pdf File
        </QueryResultsLink>
      </Menu.Item>)
      }
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
          {
            queryResults && !queryResults.getBucketUrl() ? (
              <Button
                className="m-l-5"
                loading={forExport && !queryResults}
                onClick={() => handleExportClick()}
              >
                Download Dataset
                <i className="fa fa-caret-up m-l-5" aria-hidden="true" />
              </Button>
            ) : (
              <Link
                className="m-l-5"
                target="_blank"
                rel="noopener noreferrer"
                href={queryResults ? queryResults.getBucketUrl() : "#"}
                style={{ pointerEvents: "auto", zIndex: 10, position: "relative" }}
                download
              >
                <FilePdfOutlinedIcon /> Download as Pdf File
              </Link>
            )
          }
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
};

VisualizationEmbedFooter.defaultProps = {
  queryResults: null,
  updatedAt: null,
  refreshStartedAt: null,
  queryUrl: null,
  hideTimestamp: false,
  apiKey: null,
};

function VisualizationEmbed({ queryId, visualizationId, apiKey, onError }) {
  const [query, setQuery] = useState(null);
  const [error, setError] = useState(null);
  const [refreshStartedAt, setRefreshStartedAt] = useState(null);
  const [queryResults, setQueryResults] = useState(null);

  // Store forExport in a ref so useCallback does NOT depend on it
  const forExportRef = useRef(false);

  const handleError = useImmutableCallback(onError);

  useEffect(() => {
    let isCancelled = false;

    Query.get({ id: queryId })
      .then(result => {
        if (!isCancelled) setQuery(result);
      })
      .catch(handleError);

    return () => {
      isCancelled = true;
    };
  }, [queryId, handleError]);

  // FIXED: does NOT depend on forExport, uses ref instead
  const refreshQueryResults = useCallback(() => {
    if (query) {
      setError(null);
      setRefreshStartedAt(moment());

      query
        .getQueryResultPromise(forExportRef.current ? 0 : -1, forExportRef.current)
        .then(result => {
          setQueryResults(result);
          forExportRef.current = false;   // Reset after export
        })
        .catch(err => {
          setError(err.getError());
        })
        .finally(() => setRefreshStartedAt(null));
    }
  }, [query]);

  useEffect(() => {
    document.body.classList.add("headless");
    refreshQueryResults();
  }, [refreshQueryResults]);

  if (!query) return null;

  // Export button triggers export and refetch
  const handleExportClick = () => {
    forExportRef.current = true;
    refreshQueryResults();
  };

  const hideHeader = has(location.search, "hide_header");
  const hideParametersUI = has(location.search, "hide_parameters");
  const hideQueryLink = has(location.search, "hide_link");
  const hideTimestamp = has(location.search, "hide_timestamp");
  const showQueryDescription = has(location.search, "showDescription");

  visualizationId = parseInt(visualizationId, 10);
  const visualization = find(query.visualizations, vis => vis.id === visualizationId);

  if (!visualization) {
    setTimeout(() => onError(new Error("Visualization does not exist")), 10);
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
            <Parameters
              parameters={query.getParametersDefs()}
              onValuesChange={refreshQueryResults}
            />
          </div>
        )}

        {error && <div className="alert alert-danger">{`Error: ${error}`}</div>}

        {!error && queryResults && (
          <VisualizationRenderer
            visualization={visualization}
            queryResult={queryResults}
            context="widget"
          />
        )}

        {!queryResults && refreshStartedAt && (
          <div className="d-flex justify-content-center">
            <div className="spinner">
              <i className="zmdi zmdi-refresh zmdi-hc-spin zmdi-hc-5x" />
            </div>
          </div>
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
        forExport={forExportRef.current}
        handleExportClick={handleExportClick}
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
