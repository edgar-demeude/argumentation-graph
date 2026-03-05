/**
 * @fileoverview Application-wide constants and configuration.
 */

export const GRAPH_CONFIG = {
  nodeRadius: 40,
  labelFontSize: 14,
  idFontSize: 10,
  linkDistance: 160,
  linkStrength: 0.5,
  chargeStrength: -500,
  collideRadius: 75,
  zoomMin: 0.2,
  zoomMax: 4.0,
  curvature: 0.0,
};

export const COLORS = {
  action: "#9b8fd4",
  env: "#4caf78",
  eco: "#dca450",
  state: "#4ab3f4",
  attack: "#e05555",
  support: "#4caf78",
  neutral: "#ffffff",
  inactive: "#555555",
  border: "#ffffff22",
};

export const SEMANTICS_METHODS = {
  HCATEGORIZER: "h-categorizer",
  MAXBASED: "max-based",
};

export const DEFAULT_DATA_PATH = "data.json";
