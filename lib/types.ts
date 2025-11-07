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
  | "text"
  | "pdf"
  | "postgresql"
  | "mysql"
  | "sqlite"
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
  id?: string;
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
  plotlyData: any[];
  plotlyLayout?: Record<string, unknown>;
  plotlyConfig?: Record<string, unknown>;
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

// Vector DB / Knowledge Base Types
export interface VectorChunk {
  id: string;
  text: string;
  metadata: {
    datasetId: string;
    datasetName: string;
    sourceType: DataSourceType;
    chunkIndex: number;
    rowRange: [number, number];
    columnNames: string[];
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: string[]; // Dataset IDs used in response
  contexts?: string[]; // Relevant chunks shown
}

export interface ChatSession {
  id: string;
  title: string;
  datasetIds: string[]; // Active datasets in this chat
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetIndex {
  id: string;
  datasetName: string;
  sourceType: DataSourceType;
  rowCount: number;
  columnCount: number;
  chunkCount: number;
  indexedAt: Date;
  status: "indexing" | "ready" | "error";
}

export type Message = {
  role: "user" | "assistant";
  content: string;
  html?: string;
  sqlData?: {
    question: string;
    generated_sql: string;
    results: any[];
  };
};

export type DataSourceItem = {
  value: DataSourceType;
  label: string;
  icon: any;
  category: string;
};

export type UploadPageState = {
  source: DataSourceType;
  dataset: DataSet | null;
  dburi: string;
  dbType: string;
  originalDataset: DataSet | null;
  error: string;
  openRouterKey: string;
  indexingProgress: number;
  isIndexing: boolean;
  showAdSenseBanner: boolean;
  sqlTableData: any[];
  sqlColumns: string[];
  userInfo: any;
  loadingUserInfo: boolean;
  cleaningOptions: DataCleaningOptions;
  messages: Message[];
  input: string;
  loading: boolean;
  downloadLoading: boolean;
  visualizations: VisualizationSpec[];
  vizLoading: boolean;
  selectedVizIds: Set<string>;
  activeTab: string;
};
