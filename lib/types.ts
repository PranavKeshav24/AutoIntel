export type Primitive = string | number | boolean | null | Date;
export type RecordData = Record<string, Primitive>;

export interface InferredFieldSchema {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "null" | "mixed";
  example?: Primitive;
  nullable?: boolean;
}

export interface DataSchema {
  fields: InferredFieldSchema[];
  rowCount: number;
  sampleRows?: RecordData[];
}

export type DataSourceType =
  | "csv"
  | "excel"
  | "sheets"
  | "json"
  | "pdf"
  | "text"
  | "postgres"
  | "sqlite"
  | "mysql"
  | "mongodb"
  | "reddit"
  | "adsense";

export interface DataSet {
  schema: DataSchema;
  rows: RecordData[];
  source: {
    kind: DataSourceType;
    name?: string;
    meta?: Record<string, unknown>;
  };
}

export interface DataCleaningOptions {
  removeEmptyRows: boolean;
  removeDuplicates: boolean;
  trimWhitespace: boolean;
  handleMissingValues: "keep" | "remove" | "fill";
  fillValue?: string;
}

export interface VisualizationSpec {
  id: string;
  title: string;
  description?: string;
  vegaLiteSpec: Record<string, unknown>;
}

export interface AnalysisResult {
  answer: string;
  selectedVisualizations: VisualizationSpec[];
  suggestedFollowUps?: string[];
  report?: string;
}

export interface OpenRouterConfig {
  apiKey: string;
  referer?: string;
  title?: string;
  model?: string;
}

// LLM Request/Response types
export interface LLMAnalysisRequest {
  dataset: DataSet;
  query: string;
  config: OpenRouterConfig;
}

export interface LLMAnalysisResponse {
  answer: string;
  visualizations: VisualizationSpec[];
  report?: string;
  followUps?: string[];
}

export interface LLMVisualizationRequest {
  dataset: DataSet;
  config: OpenRouterConfig;
}

export interface LLMReportRequest {
  dataset: DataSet;
  query: string;
  config: OpenRouterConfig;
}

export interface LLMReportResponse {
  htmlMarkdown: string;
  metadata?: {
    generatedAt: string;
    rowsAnalyzed: number;
  };
}
