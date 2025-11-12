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
  selectedVisualizations?: VisualizationSpec[];
}

export interface LLMReportResponse {
  htmlMarkdown: string;
  metadata?: {
    generatedAt: string;
    rowsAnalyzed: number;
  };
}

// Report types
export interface Report {
  id: string;
  title: string;
  content: string; // Plain text summary
  html: string; // Full HTML content
  summary?: string; // Short summary for display
  createdAt?: Date;
  metadata?: {
    visualizationIds?: string[];
    rowsAnalyzed?: number;
  };
}

// Story Presenter types
export interface Slide {
  title: string;
  content: string[];
  speakerNotes: string;
  visualizationId: string | null;
  reportId: string | null;
  audioData: string | null; // Base64 encoded audio
  slideNumber: number;
  type?: "title" | "content" | "visualization" | "report" | "conclusion";
}

export interface StoryPresentation {
  presentationTitle: string;
  presentationSubtitle: string;
  slides: Slide[];
  pptxData: string; // Base64 encoded PPTX file
  metadata?: {
    totalSlides: number;
    generatedAt: string;
    visualizationCount: number;
    reportCount: number;
  };
}

export interface StoryGenerationRequest {
  dataset: DataSet;
  selectedVisualizations: VisualizationSpec[];
  selectedReports: Report[];
  config: OpenRouterConfig;
  reportContext?: string;
}

export interface StoryGenerationResponse extends StoryPresentation {}

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

// Message type for chat interface
export type Message = {
  role: "user" | "assistant";
  content: string;
  html?: string;
  sqlData?: {
    question: string;
    sql_query: string;
    results: any[];
  };
  reportId?: string; // Link to saved report
  visualizationIds?: string[]; // Link to visualizations
  timestamp?: Date;
};

export type DataSourceItem = {
  value: DataSourceType;
  label: string;
  icon: any;
  category: string;
};

// Complete upload page state
export type UploadPageState = {
  // Data source
  source: DataSourceType;
  dataset: DataSet | null;
  dburi: string;
  dbType: string;
  originalDataset: DataSet | null;

  // UI state
  error: string;
  openRouterKey: string;
  indexingProgress: number;
  isIndexing: boolean;
  showAdSenseBanner: boolean;
  activeTab: string;

  // SQL-specific
  sqlTableData: any[];
  sqlColumns: string[];

  // User info
  userInfo: any;
  loadingUserInfo: boolean;

  // Data cleaning
  cleaningOptions: DataCleaningOptions;

  // Chat
  messages: Message[];
  input: string;
  loading: boolean;
  downloadLoading: boolean;

  // Visualizations
  visualizations: VisualizationSpec[];
  vizLoading: boolean;
  selectedVizIds: Set<string>;

  // Reports (NEW)
  reports: Report[];
  selectedReportIds: Set<string>;

  // Story presentation (NEW)
  showStoryPresenter: boolean;
  storyData: StoryPresentation | null;
  storyLoading: boolean;
};

// TTS Provider types (NEW)
export type TTSProvider = "elevenlabs" | "huggingface" | "google" | "browser";

export interface TTSConfig {
  provider: TTSProvider;
  apiKey?: string;
  voiceId?: string;
  model?: string;
  options?: {
    stability?: number;
    similarity_boost?: number;
    speaking_rate?: number;
    pitch?: number;
  };
}

export interface TTSResponse {
  audioData: string; // Base64 encoded audio
  provider: TTSProvider;
  duration?: number;
  error?: string;
}

// Chart conversion types (NEW)
export interface ChartConversionResult {
  type: any; // pptxgen.ChartType
  data: any[];
  options?: {
    title?: string;
    showTitle?: boolean;
    showLegend?: boolean;
    legendPos?: string;
    barDir?: "bar" | "col";
  };
}

export interface PlotlyTrace {
  type?: string;
  x?: any[];
  y?: any[];
  labels?: string[];
  values?: number[];
  name?: string;
  mode?: string;
  marker?: any;
  line?: any;
}

// API Response types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SQLQueryResult {
  question: string;
  sql_query: string;
  results: any[];
  execution_time?: number;
  row_count?: number;
}

// Export utility type for component props
export type PropsWithChildren<P = {}> = P & { children?: React.ReactNode };

// Story Presenter Props (NEW)
export interface StoryPresenterProps {
  presentationTitle: string;
  presentationSubtitle: string;
  slides: Slide[];
  pptxData: string;
  visualizations: VisualizationSpec[];
  onClose: () => void;
}

// Chat Assistant Props (UPDATED)
export interface ChatAssistantProps {
  messages: Message[];
  input: string;
  loading: boolean;
  downloadLoading: boolean;
  selectedVizCount: number;
  selectedReportCount: number; // NEW
  reports: Report[]; // NEW
  isSQLSource: boolean;
  storyLoading?: boolean;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onDownloadReport: (html: string, format: "html" | "pdf") => void;
  onGenerateStory?: () => void;
  onToggleReportSelection: (reportId: string) => void; // NEW
  selectedReportIds: Set<string>; // NEW
}
