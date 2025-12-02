import { find, isArray, get, first, map, intersection, isEqual, isEmpty, uniq } from "lodash";
import React from "react";
import PropTypes from "prop-types";
import SelectWithVirtualScroll from "@/components/SelectWithVirtualScroll";

// Hardcoded API response data
const HARDCODED_API_DATA = {
  data: [
    { zone: "HYDERABAD", region: "NALGONDA", division: "DYRM-NLG", depotname: "Yadagirigutta Depot" },
    { zone: "KARIMNAGAR", region: "KHAMMAM", division: "DYRM-KMM", depotname: "Yellandu Depot" },
    { zone: "GR HYD ZONE", region: "HYDERABAD", division: "DVM-CRMR", depotname: "Kacheguda Depot" },
    { zone: "GR HYD ZONE", region: "SECUNDERABAD", division: "DVM-SD", depotname: "Chengicharla Depot" },
    { zone: "KARIMNAGAR", region: "NIZAMABAD", division: "DYRM-NZB", depotname: "Armoor Depot" },
    { zone: "GR HYD ZONE", region: "HYDERABAD", division: "DVM-HYT", depotname: "Bandlaguda(Nagole) Depot" },
    { zone: "GR HYD ZONE", region: "SECUNDERABAD", division: "DVM-KP", depotname: "Jeedimetla Depot" },
    { zone: "KARIMNAGAR", region: "NIZAMABAD", division: "DYRM-NZB", depotname: "Nizamabad-Ii Depot" },
    { zone: "HYDERABAD", region: "RANGAREDDY", division: "DYRM-RR", depotname: "Bhel Depot" },
    { zone: "HYDERABAD", region: "RANGAREDDY", division: "DYRM-RR", depotname: "Vikarabad Depot" },
    { zone: "KARIMNAGAR", region: "KHAMMAM", division: "DYRM-KMM", depotname: "Khammam Depot" },
    { zone: "KARIMNAGAR", region: "WARANGAL", division: "DYRM-WL", depotname: "Warangal-I Depot" },
    { zone: "HYDERABAD", region: "MEDAK", division: "DYRM-MDK", depotname: "Siddipet Depot" },
    { zone: "KARIMNAGAR", region: "WARANGAL", division: "DYRM-WL", depotname: "Narsampet Depot" },
    { zone: "KARIMNAGAR", region: "KARIMNAGAR", division: "DYRM-KRMR", depotname: "Manthani Depot" },
    { zone: "GR HYD ZONE", region: "HYDERABAD", division: "DVM-CRMR", depotname: "Barkatpura Depot" },
    { zone: "HYDERABAD", region: "MAHABUBNAGAR", division: "DYRM-MBNR", depotname: "Mahaboobnagar Depot" },
    { zone: "GR HYD ZONE", region: "HYDERABAD", division: "DVM-CRMR", depotname: "Mushirabad-II Depot" },
    { zone: "KARIMNAGAR", region: "WARANGAL", division: "DYRM-WL", depotname: "Mahaboobabad Depot" },
    { zone: "HYDERABAD", region: "RANGAREDDY", division: "DYRM-RR", depotname: "Tandur Depot" },
    { zone: "HYDERABAD", region: "MAHABUBNAGAR", division: "DYRM-MBNR", depotname: "Shadnagar Depot" },
    { zone: "GR HYD ZONE", region: "HYDERABAD", division: "DVM-CRMR", depotname: "Farooqnagar Depot" },
    { zone: "KARIMNAGAR", region: "NIZAMABAD", division: "DYRM-NZB", depotname: "Banswada Depot" },
    { zone: "HYDERABAD", region: "MAHABUBNAGAR", division: "DYRM-MBNR", depotname: "Narayanpet Depot" },
    { zone: "GR HYD ZONE", region: "SECUNDERABAD", division: "DVM-KP", depotname: "Medchal Depot" },
    { zone: "HYDERABAD", region: "NALGONDA", division: "DYRM-NLG", depotname: "Narketpally Depot" },
    { zone: "HYDERABAD", region: "MAHABUBNAGAR", division: "DYRM-MBNR", depotname: "Nagarkurnool Depot" },
    { zone: "HYDERABAD", region: "RANGAREDDY", division: "DYRM-RR", depotname: "Picket Depot" },
    { zone: "KARIMNAGAR", region: "WARANGAL", division: "DYRM-WL", depotname: "Warangal-Ii Depot" },
    { zone: "KARIMNAGAR", region: "WARANGAL", division: "DYRM-WL", depotname: "Janagaon Depot" },
    { zone: "GR HYD ZONE", region: "HYDERABAD", division: "DVM-HYT", depotname: "Ibrahimpatnam (Hyd) Depot" },
    { zone: "GR HYD ZONE", region: "HYDERABAD", division: "DVM-CRMR", depotname: "Mehdipatnam Depot" },
    { zone: "KARIMNAGAR", region: "KARIMNAGAR", division: "DYRM-KRMR", depotname: "Huzurabad Depot" },
    { zone: "KARIMNAGAR", region: "KHAMMAM", division: "DYRM-KMM", depotname: "Manugur Depot" },
    { zone: "KARIMNAGAR", region: "KHAMMAM", division: "DYRM-KMM", depotname: "Kothagudem Depot" },
    { zone: "GR HYD ZONE", region: "SECUNDERABAD", division: "DVM-SD", depotname: "Hakeempet Depot" },
    { zone: "GR HYD ZONE", region: "HYDERABAD", division: "DVM-HYT", depotname: "Hayatnagar-II Depot" },
    { zone: "KARIMNAGAR", region: "NIZAMABAD", division: "DYRM-NZB", depotname: "Nizamabad-I Depot" },
    { zone: "HYDERABAD", region: "NALGONDA", division: "DYRM-NLG", depotname: "Suryapet Depot" },
    { zone: "HYDERABAD", region: "NALGONDA", division: "DYRM-NLG", depotname: "Kodad Depot" },
    { zone: "GR HYD ZONE", region: "SECUNDERABAD", division: "DVM-SD", depotname: "Ranigunj-I Depot" },
    { zone: "HYDERABAD", region: "NALGONDA", division: "DYRM-NLG", depotname: "Devarakonda Depot" },
    { zone: "KARIMNAGAR", region: "KARIMNAGAR", division: "DYRM-KRMR", depotname: "Vemulawada Depot" },
    { zone: "KARIMNAGAR", region: "WARANGAL", division: "DYRM-WL", depotname: "Bhupalpally Depot" },
    { zone: "HYDERABAD", region: "MAHABUBNAGAR", division: "DYRM-MBNR", depotname: "Kollapur Depot" },
    { zone: "KARIMNAGAR", region: "ADILABAD", division: "DYRM-ADB", depotname: "Mancherial Depot" },
    { zone: "KARIMNAGAR", region: "ADILABAD", division: "DYRM-ADB", depotname: "Bhainsa Depot" },
    { zone: "HYDERABAD", region: "MEDAK", division: "DYRM-MDK", depotname: "Dubbaka Depot" },
    { zone: "KARIMNAGAR", region: "KARIMNAGAR", division: "DYRM-KRMR", depotname: "Korutla Depot" },
    { zone: "KARIMNAGAR", region: "KARIMNAGAR", division: "DYRM-KRMR", depotname: "Jagityal Depot" },
    { zone: "HYDERABAD", region: "MEDAK", division: "DYRM-MDK", depotname: "Medak Depot" },
    { zone: "HYDERABAD", region: "MEDAK", division: "DYRM-MDK", depotname: "Gajwel Pragnapur Depot" },
    { zone: "HYDERABAD", region: "MAHABUBNAGAR", division: "DYRM-MBNR", depotname: "Gadwal Depot" },
    { zone: "KARIMNAGAR", region: "KARIMNAGAR", division: "DYRM-KRMR", depotname: "Godavarikhani Depot" },
    { zone: "KARIMNAGAR", region: "KARIMNAGAR", division: "DYRM-KRMR", depotname: "Sircilla Depot" },
    { zone: "HYDERABAD", region: "NALGONDA", division: "DYRM-NLG", depotname: "Miryalguda Depot" },
    { zone: "GR HYD ZONE", region: "SECUNDERABAD", division: "DVM-SD", depotname: "Kushaiguda Depot" },
    { zone: "GR HYD ZONE", region: "SECUNDERABAD", division: "DVM-SD", depotname: "Contonment Depot" },
    { zone: "KARIMNAGAR", region: "ADILABAD", division: "DYRM-ADB", depotname: "Nirmal Depot" },
    { zone: "KARIMNAGAR", region: "KARIMNAGAR", division: "DYRM-KRMR", depotname: "Husnabad Depot" },
    { zone: "HYDERABAD", region: "NALGONDA", division: "DYRM-NLG", depotname: "Nalgonda Depot" },
    { zone: "GR HYD ZONE", region: "HYDERABAD", division: "DVM-CRMR", depotname: "Falaknuma Depot" },
    { zone: "HYDERABAD", region: "RANGAREDDY", division: "DYRM-RR", depotname: "Miyapur-I Depot" },
    { zone: "HYDERABAD", region: "MEDAK", division: "DYRM-MDK", depotname: "Narsapur Depot" },
    { zone: "HYDERABAD", region: "MEDAK", division: "DYRM-MDK", depotname: "Zahirabad Depot" },
    { zone: "GR HYD ZONE", region: "HYDERABAD", division: "DVM-HYT", depotname: "Dilsukhnagar Depot" },
    { zone: "GR HYD ZONE", region: "SECUNDERABAD", division: "DVM-KP", depotname: "Hyd Central University Depot" },
    { zone: "GR HYD ZONE", region: "SECUNDERABAD", division: "DVM-SD", depotname: "Uppal Depot" },
    { zone: "GR HYD ZONE", region: "HYDERABAD", division: "DVM-HYT", depotname: "Maheshvaram Depot" },
    { zone: "KARIMNAGAR", region: "KARIMNAGAR", division: "DYRM-KRMR", depotname: "Metpally Depot" },
    { zone: "HYDERABAD", region: "MAHABUBNAGAR", division: "DYRM-MBNR", depotname: "Achampet Depot" },
    { zone: "KARIMNAGAR", region: "NIZAMABAD", division: "DYRM-NZB", depotname: "Bodhan Depot" },
    { zone: "GR HYD ZONE", region: "SECUNDERABAD", division: "DVM-KP", depotname: "Kukatpally Depot" },
    { zone: "GR HYD ZONE", region: "SECUNDERABAD", division: "DVM-KP", depotname: "Miyapur-II Depot" },
    { zone: "HYDERABAD", region: "RANGAREDDY", division: "DYRM-RR", depotname: "Hyderabad-Ii Depot" },
    { zone: "KARIMNAGAR", region: "KARIMNAGAR", division: "DYRM-KRMR", depotname: "Karimnagar-2 Depot" },
    { zone: "HYDERABAD", region: "RANGAREDDY", division: "DYRM-RR", depotname: "Hyderabad-I Depot" },
    { zone: "HYDERABAD", region: "MAHABUBNAGAR", division: "DYRM-MBNR", depotname: "Wanaparthy Depot" },
    { zone: "HYDERABAD", region: "MEDAK", division: "DYRM-MDK", depotname: "Narayanakhed Depot" },
    { zone: "GR HYD ZONE", region: "HYDERABAD", division: "DVM-CRMR", depotname: "Rajendernagar Depot" },
    { zone: "KARIMNAGAR", region: "WARANGAL", division: "DYRM-WL", depotname: "Parkal Depot" },
    { zone: "HYDERABAD", region: "MAHABUBNAGAR", division: "DYRM-MBNR", depotname: "Kosgi Depot" },
    { zone: "KARIMNAGAR", region: "ADILABAD", division: "DYRM-ADB", depotname: "Adilabad Depot" },
    { zone: "KARIMNAGAR", region: "KHAMMAM", division: "DYRM-KMM", depotname: "Sattupally Depot" },
    { zone: "KARIMNAGAR", region: "KHAMMAM", division: "DYRM-KMM", depotname: "Madhira Depot" },
    { zone: "GR HYD ZONE", region: "HYDERABAD", division: "DVM-HYT", depotname: "Midhani Depot" },
    { zone: "KARIMNAGAR", region: "KARIMNAGAR", division: "DYRM-KRMR", depotname: "Karimnagar-1 Depot" },
    { zone: "KARIMNAGAR", region: "KHAMMAM", division: "DYRM-KMM", depotname: "Bhadrachalam Depot" },
    { zone: "HYDERABAD", region: "RANGAREDDY", division: "DYRM-RR", depotname: "Pargi Depot" },
    { zone: "KARIMNAGAR", region: "WARANGAL", division: "DYRM-WL", depotname: "Hanamakonda Depot" },
    { zone: "KARIMNAGAR", region: "WARANGAL", division: "DYRM-WL", depotname: "Thorrur Depot" },
    { zone: "KARIMNAGAR", region: "ADILABAD", division: "DYRM-ADB", depotname: "Asifabad Depot" },
    { zone: "HYDERABAD", region: "MAHABUBNAGAR", division: "DYRM-MBNR", depotname: "Kalwakurthy Depot" },
    { zone: "GR HYD ZONE", region: "HYDERABAD", division: "DVM-HYT", depotname: "Hayatnagar-I Depot" },
    { zone: "KARIMNAGAR", region: "NIZAMABAD", division: "DYRM-NZB", depotname: "Kamareddy Depot" },
    { zone: "KARIMNAGAR", region: "ADILABAD", division: "DYRM-ADB", depotname: "Utnoor Depot" },
    { zone: "HYDERABAD", region: "MEDAK", division: "DYRM-MDK", depotname: "Sangareddy Depot" },
  ],
  errors: null,
};

// Shared cache (built once, used by all components)
let sharedFilterCache = null;

function buildFilterCache(mappingsData) {
  const cache = {
    zones: [],
    regionCache: {},
    depotCache: {},
  };

  // Extract unique zones (TG_ZONE)
  const zones = uniq(mappingsData.map((row) => row.zone).filter(Boolean));
  cache.zones = zones.map((zone) => ({ name: zone, value: zone }));

  // Build region cache grouped by zone (TG_REGION)
  zones.forEach((zone) => {
    const regions = uniq(
      mappingsData
        .filter((row) => row.zone === zone)
        .map((row) => row.region)
        .filter(Boolean)
    );
    cache.regionCache[zone] = regions.map((region) => ({ name: region, value: region }));
  });

  // Build depot cache grouped by zone + region (TG_DEPOT)
  zones.forEach((zone) => {
    cache.depotCache[zone] = {};
    const regions = cache.regionCache[zone];
    regions.forEach((region) => {
      const depots = uniq(
        mappingsData
          .filter((row) => row.zone === zone && row.region === region.value)
          .map((row) => row.depotname)
          .filter(Boolean)
      );
      cache.depotCache[zone][region.value] = depots.map((depot) => ({
        name: depot,
        value: depot,
      }));
    });
  });

  return cache;
}

// Build cache once on module load
if (!sharedFilterCache) {
  sharedFilterCache = buildFilterCache(HARDCODED_API_DATA.data);
}

export default class ExternalApiParameterInput extends React.Component {
  static propTypes = {
    parameter: PropTypes.any, // eslint-disable-line react/forbid-prop-types
    value: PropTypes.any, // eslint-disable-line react/forbid-prop-types
    mode: PropTypes.oneOf(["default", "multiple"]),
    onSelect: PropTypes.func,
    className: PropTypes.string,
    allParameters: PropTypes.array, // All parameters for cascading filter support
  };

  static defaultProps = {
    value: null,
    mode: "default",
    parameter: null,
    onSelect: () => {},
    className: "",
    allParameters: [],
  };

  constructor(props) {
    super(props);
    this.state = {
      options: [],
      value: null,
    };
    this._lastKnownZone = null;
    this._lastKnownRegion = null;
  }

  componentDidMount() {
    this._updateOptionsFromCache();
    this.setValue(this.props.value);
    // Store initial parent values for comparison (using pendingValue if available)
    const { parameter, allParameters } = this.props;
    if (parameter.name === "TG_REGION" || parameter.name === "TG_DEPOT") {
      const zoneParam = allParameters.find((p) => p.name === "TG_ZONE");
      this._lastKnownZone = this._getParameterValue(zoneParam);
    }
    if (parameter.name === "TG_DEPOT") {
      const regionParam = allParameters.find((p) => p.name === "TG_REGION");
      this._lastKnownRegion = this._getParameterValue(regionParam);
    }
  }

  componentDidUpdate(prevProps) {
    const { parameter, allParameters } = this.props;

    // Always check current parent values against last known values
    // This works even when allParameters array reference doesn't change
    // Use pendingValue if available so cascading works immediately
    if (parameter.name === "TG_REGION" || parameter.name === "TG_DEPOT") {
      const zoneParam = allParameters.find((p) => p.name === "TG_ZONE");
      const currentZone = this._getParameterValue(zoneParam);
      
      // Compare current value with last known value
      let zoneChanged = false;
      if (isArray(this._lastKnownZone) && isArray(currentZone)) {
        zoneChanged = !isEqual(this._lastKnownZone.sort(), currentZone.sort());
      } else {
        zoneChanged = this._lastKnownZone !== currentZone;
      }
      
      if (zoneChanged) {
        console.log(`[${parameter.name}] Zone changed:`, {
          from: this._lastKnownZone,
          to: currentZone,
        });
        this._lastKnownZone = currentZone;
        this._updateOptionsFromCache();
      }
    }

    if (parameter.name === "TG_DEPOT") {
      const regionParam = allParameters.find((p) => p.name === "TG_REGION");
      const currentRegion = this._getParameterValue(regionParam);
      
      let regionChanged = false;
      if (isArray(this._lastKnownRegion) && isArray(currentRegion)) {
        regionChanged = !isEqual(this._lastKnownRegion.sort(), currentRegion.sort());
      } else {
        regionChanged = this._lastKnownRegion !== currentRegion;
      }
      
      if (regionChanged) {
        console.log(`[TG_DEPOT] Region changed:`, {
          from: this._lastKnownRegion,
          to: currentRegion,
        });
        this._lastKnownRegion = currentRegion;
        this._updateOptionsFromCache();
      }
    }

    // Check if value prop changed
    if (this.props.value !== prevProps.value) {
      this.setValue(this.props.value);
    }
  }

  _checkParentValuesChanged(prevProps) {
    const { parameter, allParameters } = this.props;
    const prevAllParameters = prevProps.allParameters || [];

    if (parameter.name === "TG_REGION") {
      const prevZoneParam = prevAllParameters.find((p) => p.name === "TG_ZONE");
      const currentZoneParam = allParameters.find((p) => p.name === "TG_ZONE");
      const prevZone = prevZoneParam?.value;
      const currentZone = currentZoneParam?.value;
      
      console.log(`[TG_REGION] Checking zone change:`, {
        prevZone,
        currentZone,
        prevZoneParam: prevZoneParam ? { name: prevZoneParam.name, value: prevZoneParam.value } : null,
        currentZoneParam: currentZoneParam ? { name: currentZoneParam.name, value: currentZoneParam.value } : null,
      });
      
      // Handle array values (multi-select) - compare arrays
      if (isArray(prevZone) && isArray(currentZone)) {
        const changed = !isEqual(prevZone.sort(), currentZone.sort());
        console.log(`[TG_REGION] Array comparison:`, { changed, prevZone, currentZone });
        return changed;
      }
      const changed = prevZone !== currentZone;
      console.log(`[TG_REGION] Value comparison:`, { changed, prevZone, currentZone });
      return changed;
    }

    if (parameter.name === "TG_DEPOT") {
      const prevZoneParam = prevAllParameters.find((p) => p.name === "TG_ZONE");
      const prevRegionParam = prevAllParameters.find((p) => p.name === "TG_REGION");
      const currentZoneParam = allParameters.find((p) => p.name === "TG_ZONE");
      const currentRegionParam = allParameters.find((p) => p.name === "TG_REGION");
      
      const prevZone = prevZoneParam?.value;
      const prevRegion = prevRegionParam?.value;
      const currentZone = currentZoneParam?.value;
      const currentRegion = currentRegionParam?.value;
      
      // Handle array values (multi-select)
      let zoneChanged = false;
      let regionChanged = false;
      
      if (isArray(prevZone) && isArray(currentZone)) {
        zoneChanged = !isEqual(prevZone.sort(), currentZone.sort());
      } else {
        zoneChanged = prevZone !== currentZone;
      }
      
      if (isArray(prevRegion) && isArray(currentRegion)) {
        regionChanged = !isEqual(prevRegion.sort(), currentRegion.sort());
      } else {
        regionChanged = prevRegion !== currentRegion;
      }
      
      return zoneChanged || regionChanged;
    }

    return false;
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

  _getParameterValue(param) {
    // Get pending value if it exists, otherwise get the actual value
    // This allows cascading to work immediately without clicking "Apply Changes"
    if (param && param.pendingValue !== undefined) {
      return param.pendingValue;
    }
    return param?.value;
  }

  _updateOptionsFromCache() {
    const { parameter, allParameters } = this.props;

    if (!sharedFilterCache) {
      this.setState({ options: [] });
      return;
    }

    let options = [];

    if (parameter.name === "TG_ZONE") {
      // Zone filter - no dependencies
      options = sharedFilterCache.zones || [];
    } else if (parameter.name === "TG_REGION") {
      // Region filter - depends on TG_ZONE
      const zoneParam = allParameters.find((p) => p.name === "TG_ZONE");
      const selectedZone = this._getParameterValue(zoneParam);

      // Handle multi-value: if zone is an array, get regions for all selected zones
      if (isArray(selectedZone) && selectedZone.length > 0) {
        // For multi-select, show regions that belong to ANY of the selected zones
        const allRegions = new Set();
        selectedZone.forEach((zone) => {
          if (sharedFilterCache.regionCache[zone]) {
            sharedFilterCache.regionCache[zone].forEach((region) => {
              allRegions.add(region.value);
            });
          }
        });
        options = Array.from(allRegions).map((regionValue) => {
          // Find the first zone that has this region to get the full region object
          for (const zone of selectedZone) {
            if (sharedFilterCache.regionCache[zone]) {
              const regionObj = sharedFilterCache.regionCache[zone].find(
                (r) => r.value === regionValue
              );
              if (regionObj) return regionObj;
            }
          }
          return { name: regionValue, value: regionValue };
        });
      } else if (selectedZone && sharedFilterCache.regionCache[selectedZone]) {
        // Single value
        options = sharedFilterCache.regionCache[selectedZone];
      } else {
        options = [];
      }
    } else if (parameter.name === "TG_DEPOT") {
      // Depot filter - depends on TG_ZONE + TG_REGION
      const zoneParam = allParameters.find((p) => p.name === "TG_ZONE");
      const regionParam = allParameters.find((p) => p.name === "TG_REGION");

      const selectedZone = this._getParameterValue(zoneParam);
      const selectedRegion = this._getParameterValue(regionParam);

      // Handle multi-value for both zone and region
      if (isArray(selectedZone) && isArray(selectedRegion)) {
        // Multi-select for both: show depots that belong to ANY combination
        const allDepots = new Set();
        selectedZone.forEach((zone) => {
          selectedRegion.forEach((region) => {
            if (
              sharedFilterCache.depotCache[zone] &&
              sharedFilterCache.depotCache[zone][region]
            ) {
              sharedFilterCache.depotCache[zone][region].forEach((depot) => {
                allDepots.add(depot.value);
              });
            }
          });
        });
        options = Array.from(allDepots).map((depotValue) => {
          // Find the first combination that has this depot
          for (const zone of selectedZone) {
            for (const region of selectedRegion) {
              if (
                sharedFilterCache.depotCache[zone] &&
                sharedFilterCache.depotCache[zone][region]
              ) {
                const depotObj = sharedFilterCache.depotCache[zone][region].find(
                  (d) => d.value === depotValue
                );
                if (depotObj) return depotObj;
              }
            }
          }
          return { name: depotValue, value: depotValue };
        });
      } else if (
        selectedZone &&
        selectedRegion &&
        sharedFilterCache.depotCache[selectedZone] &&
        sharedFilterCache.depotCache[selectedZone][selectedRegion]
      ) {
        // Single values
        options = sharedFilterCache.depotCache[selectedZone][selectedRegion];
      } else {
        options = [];
      }
    }

    this.setState({ options }, () => {
      const updatedValue = this.setValue(this.props.value);
      // If current value is not in new options, clear it
      if (updatedValue !== this.props.value) {
        this.props.onSelect(updatedValue);
      }
    });
  }

  handleSelectAll = () => {
    const { options } = this.state;
    const { mode, onSelect } = this.props;
    const currentValue = this.state.value || [];

    if (mode === "multiple") {
      const allValues = map(options, (option) => option.value);
      const isAllSelected =
        allValues.length > 0 && allValues.every((val) => currentValue.includes(val));

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
    const { options } = this.state;
    const currentValue = this.state.value || [];
    const allValues = map(options, (option) => option.value);
    const isAllSelected =
      mode === "multiple" && allValues.length > 0 && allValues.every((val) => currentValue.includes(val));

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

