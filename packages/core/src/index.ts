/**
 * `@kamibase/core`: the shared crease-pattern core described in DESIGN.md §9.
 *
 * One implementation of the geometry graph, the `.kami` schema, the
 * canonicalizer, the validator and the format parsers, running in the browser
 * (editor live-validation), on the server (ingest) and in workers. Two
 * implementations of the validator would diverge within a month.
 */

export * from "./geometry/vec.js";

export * from "./graph/types.js";
export {
  graphFromSegments,
  segmentsFromGraph,
  VertexIndex,
  type BuildOptions,
  type BuildResult,
} from "./graph/build.js";

export {
  buildRotationSystem,
  findFaces,
  withFaces,
  type FaceFindingResult,
  type RotationSystem,
} from "./topology/faces.js";
export { planarize, type PlanarizeOptions } from "./topology/planarize.js";

export * from "./kami/schema.js";
export * from "./kami/json-schema.js";
export {
  documentFromGraph,
  extractGraph,
  withGeometry,
  GEOMETRY_KEYS,
  KAMI_KEY_ORDER,
  type DocumentMetadata,
  type GeometryExtraction,
} from "./kami/document.js";

export {
  canonicalGeometryPayload,
  canonicalizeDocument,
  canonicalizeGraph,
  contentHash,
  isCanonical,
  serializeCanonical,
  type CanonicalizeOptions,
  type CanonicalizedDocument,
} from "./canonical/index.js";

export * from "./validate/defects.js";
export {
  analyzeBoundary,
  validateDocument,
  validateGraph,
  validateStructure,
  type BoundaryAnalysis,
  type ValidateOptions,
} from "./validate/structural.js";
export {
  checkFlatFoldability,
  type CheckOutcome,
  type FlatFoldOptions,
  type FlatFoldReport,
  type VertexFlatFoldCheck,
} from "./validate/flatfold.js";
export {
  atLeast,
  grade,
  gradeGraph,
  VALIDATION_LEVELS,
  type GradeOptions,
  type GradeResult,
  type SimulationEvidence,
  type ValidationLevel,
} from "./validate/grade.js";

export * from "./parse/types.js";
export { ParseError } from "./parse/errors.js";
export { parseFold, type ParseFoldOptions } from "./parse/fold.js";
export { parseCp, toCp, CP_LINE_TYPES, type ParseCpOptions } from "./parse/cp.js";
export { parseOpx, type ParseOpxOptions } from "./parse/opx.js";
export {
  parseSvg,
  type ParsedSvg,
  type ParseSvgOptions,
  type SvgStyleSummary,
} from "./parse/svg/index.js";
export {
  classifyColor,
  classifyLayer,
  classifyStyle,
  styleKey,
  type Classification,
  type ClassifyMethod,
  type ClassifyOptions,
  type StyleFacts,
} from "./parse/svg/classify.js";
export {
  decodeXmlDecoder,
  javaNumber,
  CLASS_KEY,
  type JavaValue,
} from "./parse/xmldecoder.js";
export { detectFormat, parse, type ParseOptions } from "./parse/detect.js";

export { toFold, toFoldJson, type ToFoldOptions } from "./export/fold.js";

export {
  renderSvg,
  ORIGAMI_SIMULATOR_PALETTE,
  type RenderSvgOptions,
} from "./render/svg.js";

export { ingest, type IngestOptions, type IngestResult } from "./ingest.js";
