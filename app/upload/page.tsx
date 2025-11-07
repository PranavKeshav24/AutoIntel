"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  DataSet,
  OpenRouterConfig,
  VisualizationSpec,
  DataCleaningOptions,
  DataSourceType,
} from "@/lib/types";
import { DataProcessor } from "@/lib/dataProcessor";
import { CsvHandler } from "@/components/upload/CSVHandler";
import { ExcelHandler } from "@/components/upload/ExcelHandler";
import { SheetsHandler } from "@/components/upload/SheetsHandler";
import {
  JsonHandler,
  TextPdfHandler,
  DatabaseHandler,
  RedditHandler,
  AdSenseHandler,
} from "@/components/upload/OtherHandlers";
import { DataCleaning } from "@/components/upload/DataCleaning";
import { VectorService } from "@/lib/vector-service";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertCircle,
  Send,
  FileText,
  BarChart3,
  Table2,
  Sparkles,
  Download,
  FileSpreadsheet,
  Link as LinkIcon,
  FileJson,
  Database,
  MessageSquare,
  DollarSign,
  CheckCircle2,
  X,
  Loader2,
  Code,
  Copy,
  Check,
} from "lucide-react";
import {
  SQLiteHandler,
  PostgresHandler,
  MySQLHandler,
} from "@/components/upload/SQLHandlers";
import PlotlyRenderer from "@/components/PlotlyRenderer";
import { PreviewTable } from "@/components/upload/PreviewTable";
import { getUserInfo } from "@/lib/api";

type Message = {
  role: "user" | "assistant";
  content: string;
  html?: string;
  sqlData?: {
    question: string;
    generated_sql: string;
    results: any[];
  };
};

const DATA_SOURCES: {
  value: DataSourceType;
  label: string;
  icon: any;
  category: string;
}[] = [
  { value: "csv", label: "CSV File", icon: FileSpreadsheet, category: "Files" },
  { value: "excel", label: "Excel", icon: FileSpreadsheet, category: "Files" },
  {
    value: "sheets",
    label: "Google Sheets",
    icon: LinkIcon,
    category: "Files",
  },
  { value: "json", label: "JSON", icon: FileJson, category: "Files" },
  { value: "text", label: "Text File", icon: FileText, category: "Files" },
  { value: "pdf", label: "PDF", icon: FileText, category: "Files" },
  {
    value: "postgresql",
    label: "PostgreSQL",
    icon: Database,
    category: "Databases",
  },
  { value: "mysql", label: "MySQL", icon: Database, category: "Databases" },
  { value: "sqlite", label: "SQLite", icon: Database, category: "Databases" },
  { value: "mongodb", label: "MongoDB", icon: Database, category: "Databases" },
  { value: "reddit", label: "Reddit", icon: MessageSquare, category: "APIs" },
  {
    value: "adsense",
    label: "Google AdSense",
    icon: DollarSign,
    category: "APIs",
  },
];

// SQL Result Display Component
const SQLResultDisplay = ({ sqlData }: { sqlData: Message["sqlData"] }) => {
  const [copiedSql, setCopiedSql] = useState(false);

  if (!sqlData) return null;

  const copySQL = () => {
    navigator.clipboard.writeText(sqlData.generated_sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Extract columns from results
  const columns =
    sqlData.results.length > 0 ? Object.keys(sqlData.results[0]) : [];
  const rows = sqlData.results;

  return (
    <div className="mt-3 space-y-3 max-w-xs">
      {/* Question */}
      <div className="border-2 rounded-lg p-3">
        <p className="text-xs font-semibold text-black dark:text-white">
          Question:
        </p>
        <p className="text-sm text-black dark:text-white">{sqlData.question}</p>
      </div>

      {/* Generated SQL */}
      <div className="border-2 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Code className="h-3 w-3 text-gray-600" />
            <p className="text-xs font-semibold text-black dark:text-white">
              Generated SQL
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={copySQL}
            className="h-6 px-2"
          >
            {copiedSql ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
        <pre className="text-xs bg-white dark:bg-slate-900 p-2 rounded border-2 overflow-x-auto">
          <code className="text-black dark:text-gray-200">
            {sqlData.generated_sql}
          </code>
        </pre>
      </div>

      {/* Results Table */}
      <div className="border-2 rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-2">
          <p className="text-xs font-semibold text-black dark:text-white">
            Results ({rows.length} row{rows.length !== 1 ? "s" : ""})
          </p>
        </div>
        <div className="max-h-64 overflow-auto">
          {rows.length > 0 ? (
            <table className="w-full text-xs">
              <thead className="sticky top-0">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left font-semibold text-black dark:text-white border-b border-2"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={idx % 2 === 0 ? "bg-none" : "bg-none"}
                  >
                    {columns.map((col) => (
                      <td
                        key={col}
                        className="px-3 py-2 text-black dark:text-white border-b-2"
                      >
                        {row[col] !== null && row[col] !== undefined
                          ? String(row[col])
                          : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-center text-gray-500 text-sm">
              No results returned
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function UploadPage() {
  const [source, setSource] = useState<DataSourceType>("csv");
  const [dataset, setDataset] = useState<DataSet | null>(null);
  const [dburi, setDburi] = useState<string>("");
  const [dbType, setDbType] = useState<string>("");
  const [originalDataset, setOriginalDataset] = useState<DataSet | null>(null);
  const [error, setError] = useState<string>("");
  const [openRouterKey, setOpenRouterKey] = useState<string>("");
  const [indexingProgress, setIndexingProgress] = useState<number>(0);
  const [isIndexing, setIsIndexing] = useState(false);
  const [showAdSenseBanner, setShowAdSenseBanner] = useState(false);

  // SQL-specific states
  const [sqlTableData, setSqlTableData] = useState<any[]>([]);
  const [sqlColumns, setSqlColumns] = useState<string[]>([]);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loadingUserInfo, setLoadingUserInfo] = useState(false);

  // Cleaning options
  const [cleaningOptions, setCleaningOptions] = useState<DataCleaningOptions>({
    removeEmptyRows: true,
    removeDuplicates: false,
    trimWhitespace: true,
    handleMissingValues: "keep",
  });

  // Chat states
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);

  // Visualization states
  const [visualizations, setVisualizations] = useState<VisualizationSpec[]>([]);
  const [vizLoading, setVizLoading] = useState(false);
  const [selectedVizIds, setSelectedVizIds] = useState<Set<string>>(new Set());

  // Active tab
  const [activeTab, setActiveTab] = useState<string>("table");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("OPENROUTER_API_KEY");
      if (saved) setOpenRouterKey(saved);
    } catch {}

    loadUserInfo();
  }, []);

  useEffect(() => {
    if (!userInfo) return;

    const isSQLSource = ["postgresql", "mysql", "sqlite"].includes(source);
    if (!isSQLSource) return;

    const connectionUrl = (() => {
      switch (source) {
        case "postgresql":
          return { url: userInfo.postgres_db_url, dbType: "postgresql" };
        case "mysql":
          return { url: userInfo.mysql_db_url, dbType: "mysql" };
        case "sqlite":
          return { url: userInfo.sqlite_db_url, dbType: "sqlite" };
        default:
          return null;
      }
    })();

    if (connectionUrl?.url && !dataset) {
      loadExistingConnection(connectionUrl.dbType, connectionUrl.url);
    }
  }, [source, userInfo]);

  const loadUserInfo = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setLoadingUserInfo(true);
    try {
      const res = await getUserInfo();
      const data = typeof res === "string" ? JSON.parse(res as any) : res;
      setUserInfo(data.data);
    } catch (err) {
      console.log("Failed to load user info:", err);
    } finally {
      setLoadingUserInfo(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get("adsense_auth");
    const authError = params.get("adsense_error");

    if (authStatus === "success") {
      setShowAdSenseBanner(true);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "✓ Google AdSense authenticated successfully! You can now fetch your AdSense data.",
        },
      ]);

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("adsense_auth");
      window.history.replaceState({}, "", newUrl.pathname + newUrl.hash);

      const timer = setTimeout(() => setShowAdSenseBanner(false), 10000);
      return () => clearTimeout(timer);
    }

    if (authError) {
      const errorMessages: Record<string, string> = {
        no_code: "Authentication failed: No authorization code received",
        config_error: "Configuration error: Google OAuth credentials not set",
        access_denied: "Authentication cancelled: You denied access",
      };

      const errorMessage =
        errorMessages[authError] ||
        `Authentication error: ${decodeURIComponent(authError)}`;
      setError(errorMessage);

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("adsense_error");
      window.history.replaceState({}, "", newUrl.pathname + newUrl.hash);
    }
  }, []);

  const config: OpenRouterConfig = {
    apiKey: openRouterKey || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || "",
    model: process.env.NEXT_PUBLIC_OPENROUTER_MODEL,
    referer: process.env.NEXT_PUBLIC_OPENROUTER_REFERER,
    title: process.env.NEXT_PUBLIC_OPENROUTER_TITLE,
  };

  const handleDataLoaded = async (ds: DataSet) => {
    setDataset(ds);
    setOriginalDataset(ds);
    setError("");
    setMessages([
      {
        role: "assistant",
        content: `✓ Dataset loaded! ${ds.schema.rowCount} rows × ${ds.schema.fields.length} columns from ${ds.source.kind}. Ready for analysis.`,
      },
    ]);
    setActiveTab("table");
  };

  const handleError = (err: string) => {
    setError(err);
  };

  const saveApiKey = () => {
    try {
      localStorage.setItem("OPENROUTER_API_KEY", openRouterKey);
      setError("");
      setMessages([
        { role: "assistant", content: "✓ API key saved successfully!" },
      ]);
    } catch {
      setError("Failed to save API key");
    }
  };

  const applyCleaning = () => {
    if (!originalDataset) return;

    const cleaned = DataProcessor.applyCleaningOptions(
      originalDataset,
      cleaningOptions
    );
    setDataset(cleaned);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `✓ Data cleaned! ${cleaned.schema.rowCount} rows remaining (${
          originalDataset.schema.rowCount - cleaned.schema.rowCount
        } removed).`,
      },
    ]);
  };

  const resetData = () => {
    if (originalDataset) {
      setDataset(originalDataset);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "✓ Data reset to original state." },
      ]);
    }
  };

  const handleUriLoaded = async (uri: string, type: string) => {
    setDburi(uri);
    setDbType(type);
    setError("");

    const mockDataset: DataSet = {
      source: {
        kind: type as DataSourceType,
        name: `${type.toUpperCase()} Database`,
        meta: { uri, connectionString: uri },
      },
      schema: {
        fields: [],
        rowCount: 0,
      },
      rows: [],
    };

    setDataset(mockDataset);
    setMessages([
      {
        role: "assistant",
        content: `✓ Connected to ${type.toUpperCase()} database successfully! Use the AI Assistant to query your data or generate visualizations.`,
      },
    ]);
    setActiveTab("table");

    loadUserInfo();
  };

  const loadExistingConnection = async (
    dbType: string,
    connectionString: string
  ) => {
    setDburi(connectionString);
    setDbType(dbType);
    setError("");

    const mockDataset: DataSet = {
      source: {
        kind: dbType as DataSourceType,
        name: `${dbType.toUpperCase()} Database`,
        meta: {
          uri: connectionString,
          connectionString: connectionString,
        },
      },
      schema: {
        fields: [],
        rowCount: 0,
      },
      rows: [],
    };

    setDataset(mockDataset);
    setMessages([
      {
        role: "assistant",
        content: `✓ Loaded existing ${dbType.toUpperCase()} connection. Ready to query!`,
      },
    ]);
    setActiveTab("table");
  };

  const fetchSQLData = async (question: string) => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Authentication required");
    }

    let endpoint = "";
    switch (dbType) {
      case "postgresql":
        endpoint = `${process.env.NEXT_PUBLIC_API_BASE_URL}/postgresql`;
        break;
      case "sqlite":
        endpoint = `${process.env.NEXT_PUBLIC_API_BASE_URL}/sqlite`;
        break;
      case "mysql":
        endpoint = `${process.env.NEXT_PUBLIC_API_BASE_URL}/mysql`;
        break;
      default:
        throw new Error("Invalid database type");
    }

    const response = await fetch(
      `${endpoint}?question=${encodeURIComponent(question)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to fetch data");
    }

    return await response.json();
  };

  const requestSQLVisualizations = async (question?: string) => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Authentication required");
    }

    let endpoint = "";
    switch (dbType) {
      case "postgresql":
        endpoint = question
          ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/postgresql/visualization`
          : `${process.env.NEXT_PUBLIC_API_BASE_URL}/postgresql/visualization/suggest`;
        break;
      case "sqlite":
        endpoint = question
          ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/sqlite/visualization`
          : `${process.env.NEXT_PUBLIC_API_BASE_URL}/sqlite/visualization/suggest`;
        break;
      case "mysql":
        endpoint = question
          ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/mysql/visualization`
          : `${process.env.NEXT_PUBLIC_API_BASE_URL}/mysql/visualization/suggest`;
        break;
      default:
        throw new Error("Invalid database type");
    }

    const url = question
      ? `${endpoint}?question=${encodeURIComponent(question)}`
      : endpoint;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to generate visualizations");
    }

    const data = await response.json();

    const allVizs: VisualizationSpec[] = [];

    if (data.visualizations && typeof data.visualizations === "object") {
      Object.entries(data.visualizations).forEach(
        ([tableName, tableData]: [string, any]) => {
          if (
            tableData.visualizations &&
            Array.isArray(tableData.visualizations)
          ) {
            tableData.visualizations.forEach((viz: any) => {
              allVizs.push({
                ...viz,
                title: `[${tableName}] ${viz.title}`,
                tableName: tableName,
              });
            });
          }
        }
      );
    } else if (data.data && data.layout) {
      allVizs.push({
        id: `viz-${Date.now()}`,
        title: data.layout.title?.text || "Generated Visualization",
        description: "Visualization generated from your query",
        plotlyData: data.data,
        plotlyLayout: data.layout,
        plotlyConfig: { responsive: true },
      });
    } else if (Array.isArray(data)) {
      allVizs.push(...data);
    }

    return allVizs;
  };

  const generateSQLReport = async (question?: string) => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Authentication required");
    }

    let endpoint = "";
    switch (dbType) {
      case "postgresql":
        endpoint = `${process.env.NEXT_PUBLIC_API_BASE_URL}/postgresql/report`;
        break;
      case "sqlite":
        endpoint = `${process.env.NEXT_PUBLIC_API_BASE_URL}/sqlite/report`;
        break;
      case "mysql":
        endpoint = `${process.env.NEXT_PUBLIC_API_BASE_URL}/mysql/report`;
        break;
      default:
        throw new Error("Invalid database type");
    }

    const url = question
      ? `${endpoint}?question=${encodeURIComponent(question)}`
      : endpoint;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to generate report");
    }

    const data = await response.json();

    let combinedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Database Analysis Report</title>
<style>
body {font-family: Arial, sans-serif; margin: 2rem; line-height: 1.6; color: #333;}
h1, h2, h3 {color: #2c3e50;}
table {width: 100%; border-collapse: collapse; margin-bottom: 1rem;}
th, td {border: 1px solid #ddd; padding: 0.75rem; text-align: left;}
th {background-color: #f2f2f2;}
.table-section {margin-bottom: 4rem; page-break-after: always; border: 2px solid #e0e0e0; padding: 2rem; border-radius: 8px; background: #fafafa;}
.table-header {background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; margin: -2rem -2rem 2rem -2rem; border-radius: 6px 6px 0 0;}
.table-header h2 {color: white; margin: 0; font-size: 1.5rem;}
.metadata {background: #f0f4f8; padding: 1rem; border-left: 4px solid #3498db; margin-bottom: 1.5rem; font-size: 0.9rem;}
.metadata strong {color: #2c3e50;}
footer {text-align: center; margin-top: 3rem; padding: 2rem; background: #f8f9fa; border-top: 2px solid #dee2e6;}
@media print {
  .table-section {page-break-after: always;}
  body {margin: 0;}
}
</style>
</head>
<body>
<h1 style="text-align: center; color: #2c3e50; margin-bottom: 0.5rem;">Comprehensive Database Analysis Report</h1>
<p style="text-align: center; color: #7f8c8d; margin-bottom: 2rem;">Generated on: ${new Date().toLocaleString()}</p>
<hr style="border: 0; height: 2px; background: linear-gradient(90deg, transparent, #3498db, transparent); margin-bottom: 3rem;">
`;

    let tableCount = 0;
    Object.entries(data).forEach(([tableName, tableData]: [string, any]) => {
      if (tableData.htmlMarkdown) {
        tableCount++;
        let bodyContent = tableData.htmlMarkdown;
        const bodyMatch = bodyContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        if (bodyMatch) {
          bodyContent = bodyMatch[1];
        }

        bodyContent = bodyContent.replace(/<h1[^>]*>.*?<\/h1>/gi, "");

        const metadata = tableData.metadata || {};
        const metadataHtml = `
<div class="metadata">
  <strong>Table:</strong> ${tableName} | 
  <strong>Rows Analyzed:</strong> ${metadata.rowsAnalyzed || "N/A"} | 
  <strong>Generated:</strong> ${
    metadata.generatedAt
      ? new Date(metadata.generatedAt).toLocaleString()
      : "N/A"
  }
</div>`;

        combinedHtml += `
<div class="table-section">
<div class="table-header">
<h2>📊 Table ${tableCount}: ${tableName}</h2>
</div>
${metadataHtml}
${bodyContent}
</div>
`;
      }
    });

    combinedHtml += `
<footer>
<p style="margin: 0; font-weight: bold; color: #2c3e50;">Database Analysis Report</p>
<p style="margin: 0.5rem 0 0 0; color: #7f8c8d;">Total Tables Analyzed: ${tableCount}</p>
</footer>
</body>
</html>`;

    return combinedHtml;
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const isSQLSource = ["postgresql", "sqlite", "mysql"].includes(dbType);
      const isReportRequest = /report|summary|document|pdf/i.test(userMessage);
      const isVisualizationRequest =
        /visuali[sz]ation|chart|graph|plot|show.*data/i.test(userMessage);

      if (isSQLSource) {
        if (isReportRequest) {
          const selectedVizContext = visualizations
            .filter((viz) => selectedVizIds.has(viz.id))
            .map((viz) => ({
              id: viz.id,
              title: viz.title,
              description: viz.description,
              plotlyData: viz.plotlyData,
              plotlyLayout: viz.plotlyLayout,
            }));

          const reportHtml = await generateSQLReport(userMessage);

          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `✓ Report generated successfully! ${
                selectedVizContext.length > 0
                  ? `Including ${selectedVizContext.length} selected visualization(s).`
                  : ""
              } Click below to download.`,
              html: reportHtml,
            },
          ]);
        } else if (isVisualizationRequest) {
          const vizArray = await requestSQLVisualizations(userMessage);

          if (vizArray.length > 0) {
            setVisualizations((prev) => [...prev, ...vizArray]);

            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `✓ Generated ${vizArray.length} visualization${
                  vizArray.length !== 1 ? "s" : ""
                } from your query!`,
              },
            ]);
            setActiveTab("charts");
          } else {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content:
                  "⚠ No visualizations could be generated from your query. Try rephrasing or asking for specific chart types.",
              },
            ]);
          }
        } else {
          // Regular SQL query
          const data = await fetchSQLData(userMessage);

          // Update the table preview with latest results
          if (
            data.results &&
            Array.isArray(data.results) &&
            data.results.length > 0
          ) {
            const columns = Object.keys(data.results[0]);
            setSqlTableData(data.results);
            setSqlColumns(columns);
            setActiveTab("table");
          }

          // Add message with SQL result data
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `✓ Query executed successfully! ${
                data.results?.length || 0
              } row${data.results?.length !== 1 ? "s" : ""} returned.`,
              sqlData: {
                question: data.question || userMessage,
                generated_sql: data.generated_sql || "",
                results: data.results || [],
              },
            },
          ]);
        }
      } else if (dataset) {
        if (isReportRequest) {
          const selectedVizContext = visualizations
            .filter((viz) => selectedVizIds.has(viz.id))
            .map((viz) => ({
              id: viz.id,
              title: viz.title,
              description: viz.description,
              plotlyData: viz.plotlyData,
              plotlyLayout: viz.plotlyLayout,
            }));

          const response = await fetch("/api/llm/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dataset,
              query: userMessage,
              config,
              selectedVisualizations: selectedVizContext,
            }),
          });

          if (!response.ok) throw new Error("Failed to generate report");

          const data = await response.json();
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `✓ Report generated successfully! ${
                selectedVizContext.length > 0
                  ? `Including ${selectedVizContext.length} selected visualization(s).`
                  : ""
              } Click below to download.`,
              html: data.htmlMarkdown,
            },
          ]);
        } else {
          const response = await fetch("/api/llm/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataset, query: userMessage, config }),
          });

          if (!response.ok) throw new Error("Failed to analyze data");

          const data = await response.json();

          if (data.visualizations && data.visualizations.length > 0) {
            setVisualizations(data.visualizations);
            setActiveTab("charts");
          }

          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.answer },
          ]);
        }
      }

      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `✗ Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const requestVisualizations = async () => {
    if (!dataset && !dbType) return;

    setVizLoading(true);
    try {
      const isSQLSource = ["postgresql", "sqlite", "mysql"].includes(dbType);

      if (isSQLSource) {
        const vizArray = await requestSQLVisualizations();
        setVisualizations(vizArray);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `✓ Generated ${vizArray.length} visualization${
              vizArray.length !== 1 ? "s" : ""
            } across all database tables!`,
          },
        ]);
      } else {
        const response = await fetch("/api/llm/visualize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataset, config }),
        });

        if (!response.ok) throw new Error("Failed to generate visualizations");

        const data = await response.json();
        setVisualizations(data.visualizations || []);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `✓ Generated ${
              data.visualizations?.length || 0
            } visualization${data.visualizations?.length !== 1 ? "s" : ""}!`,
          },
        ]);
      }

      setActiveTab("charts");
    } catch (err: any) {
      setError(err.message);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `✗ Error: ${err.message}` },
      ]);
    } finally {
      setVizLoading(false);
    }
  };

  const toggleVizSelection = (vizId: string) => {
    setSelectedVizIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(vizId)) {
        newSet.delete(vizId);
      } else {
        newSet.add(vizId);
      }
      return newSet;
    });
  };

  const downloadReport = async (
    html: string,
    format: "html" | "pdf" = "pdf"
  ) => {
    setDownloadLoading(true);
    try {
      const timestamp = Date.now();
      const baseFilename = `report-${timestamp}`;

      if (format === "html") {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseFilename}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const html2pdf = (await import("html2pdf.js")).default;

        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.top = "-10000px";
        iframe.style.left = "-10000px";
        iframe.style.width = "1200px";
        iframe.style.height = "1000px";
        document.body.appendChild(iframe);

        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) throw new Error("Failed to access iframe document");

        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();

        await new Promise((resolve) => {
          const checkCharts = () => {
            const chartScripts = iframeDoc.querySelectorAll("script");
            let chartJsLoaded = false;

            chartScripts.forEach((script) => {
              if (script.src && script.src.includes("chart.js")) {
                chartJsLoaded = true;
              }
            });

            if (chartJsLoaded) {
              setTimeout(resolve, 3000);
            } else {
              setTimeout(resolve, 1000);
            }
          };

          if (iframeDoc.readyState === "complete") {
            checkCharts();
          } else {
            iframe.onload = checkCharts;
          }
        });

        const opt = {
          margin: [10, 10, 10, 10] as [number, number, number, number],
          filename: `${baseFilename}.pdf`,
          image: { type: "jpeg" as const, quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            letterRendering: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
          },
          jsPDF: {
            unit: "mm" as const,
            format: "a4" as const,
            orientation: "portrait" as const,
          },
          pagebreak: {
            mode: ["avoid-all", "css", "legacy"],
            before: ".page-break-before",
            after: ".page-break-after",
          },
        };

        await html2pdf().set(opt).from(iframeDoc.body).save();

        document.body.removeChild(iframe);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `✓ Report downloaded successfully as ${format.toUpperCase()}!`,
        },
      ]);
    } catch (error: any) {
      console.error("Download error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error downloading report: ${error.message}`,
        },
      ]);
    } finally {
      setDownloadLoading(false);
    }
  };

  const renderDataSourceInput = () => {
    const props = { onDataLoaded: handleDataLoaded, onError: handleError };
    const sqlprops = { onUriLoaded: handleUriLoaded, onError: handleError };

    const isSQLSource = ["postgresql", "mysql", "sqlite"].includes(source);

    const existingConnection =
      isSQLSource && userInfo
        ? (() => {
            switch (source) {
              case "postgresql":
                return userInfo.postgres_db_url;
              case "mysql":
                return userInfo.mysql_db_url;
              case "sqlite":
                return userInfo.sqlite_db_url;
              default:
                return null;
            }
          })()
        : null;

    if (isSQLSource && existingConnection) {
      return null;
    }

    switch (source) {
      case "csv":
        return <CsvHandler {...props} />;
      case "excel":
        return <ExcelHandler {...props} />;
      case "sheets":
        return <SheetsHandler {...props} />;
      case "json":
        return <JsonHandler {...props} />;
      case "text":
      case "pdf":
        return <TextPdfHandler {...props} type={source} />;
      case "postgresql":
        return <PostgresHandler {...sqlprops} dbType="postgresql" />;
      case "mysql":
        return <MySQLHandler {...sqlprops} dbType="mysql" />;
      case "sqlite":
        return <SQLiteHandler {...sqlprops} dbType="sqlite" />;
      case "mongodb":
        return <DatabaseHandler {...props} dbType={source} />;
      case "reddit":
        return <RedditHandler {...props} />;
      case "adsense":
        return <AdSenseHandler {...props} />;
      default:
        return <Card className="p-6">Select a data source to begin</Card>;
    }
  };

  const groupedSources = DATA_SOURCES.reduce((acc, source) => {
    if (!acc[source.category]) acc[source.category] = [];
    acc[source.category].push(source);
    return acc;
  }, {} as Record<string, typeof DATA_SOURCES>);

  const isSQLSource = ["postgresql", "sqlite", "mysql"].includes(dbType);

  return (
    <div className="container mx-auto px-4 md:px-16 py-8 md:pt-24">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Data Analysis Platform</h1>
        <p className="text-muted-foreground">
          Connect your data, clean it, and get AI-powered insights
        </p>
      </div>

      {/* API Key Section */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">
            OpenRouter API Configuration
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <Input
              type="password"
              placeholder="sk-or-v1-..."
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
            />
          </div>
          <Button onClick={saveApiKey}>Save Key</Button>
        </div>
      </Card>

      {/* AdSense Authentication Success Banner */}
      {showAdSenseBanner && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-green-800 font-medium">
              ✓ Google AdSense authenticated successfully! You can now fetch
              your AdSense data.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdSenseBanner(false)}
              className="h-6 w-6 p-0 text-green-600 hover:text-green-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Data Source Selection */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Choose Data Source</h2>
        <div className="space-y-4">
          {Object.entries(groupedSources).map(([category, sources]) => (
            <div key={category}>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                {category}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {sources.map((src) => {
                  const Icon = src.icon;
                  return (
                    <Button
                      key={src.value}
                      variant={source === src.value ? "default" : "outline"}
                      className="h-auto py-3 flex flex-col items-center gap-2"
                      onClick={() => setSource(src.value)}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs">{src.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Upload/Connect Section */}
      {!dataset && <div className="mb-6">{renderDataSourceInput()}</div>}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      {dataset && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Data View */}
          <div className="lg:col-span-2 space-y-6">
            {/* Data Cleaning - Only for non-SQL sources */}
            {!isSQLSource && (
              <DataCleaning
                options={cleaningOptions}
                onChange={setCleaningOptions}
                onApply={applyCleaning}
                disabled={loading}
              />
            )}

            {/* Data Display */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Dataset View</h2>
                  <p className="text-sm text-muted-foreground">
                    {isSQLSource
                      ? `${dbType.toUpperCase()} Database: ${dburi}`
                      : `${dataset.schema.rowCount} rows × ${dataset.schema.fields.length} columns`}
                  </p>
                </div>
                {!isSQLSource && (
                  <Button variant="outline" size="sm" onClick={resetData}>
                    Reset Data
                  </Button>
                )}
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="table" className="flex-1">
                    <Table2 className="h-4 w-4 mr-2" />
                    Table
                  </TabsTrigger>
                  <TabsTrigger value="charts" className="flex-1">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Charts
                  </TabsTrigger>
                  <TabsTrigger value="stats" className="flex-1">
                    <FileText className="h-4 w-4 mr-2" />
                    Stats
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="table">
                  {isSQLSource ? (
                    sqlTableData.length > 0 ? (
                      <PreviewTable rows={sqlTableData} columns={sqlColumns} />
                    ) : (
                      <div className="text-sm text-muted-foreground text-center py-8">
                        <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Database connection established</p>
                        <p className="mt-2">
                          Use the AI Assistant to query your data
                        </p>
                      </div>
                    )
                  ) : (
                    <PreviewTable
                      rows={dataset.rows}
                      columns={dataset.schema.fields.map((f) => f.name)}
                    />
                  )}
                </TabsContent>

                <TabsContent value="charts">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Button
                        onClick={requestVisualizations}
                        disabled={vizLoading}
                      >
                        {vizLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          "Generate Visualizations"
                        )}
                      </Button>
                      {selectedVizIds.size > 0 && (
                        <Badge variant="secondary">
                          {selectedVizIds.size} selected for report
                        </Badge>
                      )}
                    </div>
                    {visualizations.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {visualizations.length} visualization
                        {visualizations.length > 1 ? "s" : ""} generated
                      </div>
                    )}
                  </div>

                  {visualizations.length > 0 ? (
                    <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 mt-4">
                      {visualizations.map((viz) => (
                        <div
                          key={viz.id}
                          className={`space-y-2 border-2 rounded-lg transition-all ${
                            selectedVizIds.has(viz.id)
                              ? "border-primary shadow-md"
                              : "border-gray-200"
                          }`}
                        >
                          <div className="flex items-start gap-3 p-4 pb-2">
                            <Checkbox
                              id={`viz-${viz.id}`}
                              checked={selectedVizIds.has(viz.id)}
                              onCheckedChange={() => toggleVizSelection(viz.id)}
                              className="mt-1"
                            />
                            <label
                              htmlFor={`viz-${viz.id}`}
                              className="flex-1 cursor-pointer text-sm"
                            >
                              <span className="font-medium">
                                Select for report context
                              </span>
                              <p className="text-muted-foreground text-xs mt-1">
                                Include this visualization in generated reports
                              </p>
                            </label>
                          </div>

                          <PlotlyRenderer
                            data={viz.plotlyData}
                            layout={viz.plotlyLayout}
                            config={viz.plotlyConfig}
                            title={viz.title}
                            description={viz.description}
                          />

                          <div className="flex gap-2 px-4 pb-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const spec = {
                                  data: viz.plotlyData,
                                  layout: viz.plotlyLayout,
                                  config: viz.plotlyConfig,
                                };
                                navigator.clipboard
                                  .writeText(JSON.stringify(spec, null, 2))
                                  .then(() => {
                                    alert("Plotly spec copied to clipboard!");
                                  })
                                  .catch(() => {
                                    alert("Failed to copy spec to clipboard");
                                  });
                              }}
                            >
                              Copy Spec
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const spec = {
                                  title: viz.title,
                                  description: viz.description,
                                  data: viz.plotlyData,
                                  layout: viz.plotlyLayout,
                                  config: viz.plotlyConfig,
                                };
                                const specString = JSON.stringify(
                                  spec,
                                  null,
                                  2
                                );
                                const blob = new Blob([specString], {
                                  type: "application/json",
                                });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `${
                                  viz.id || "chart"
                                }-plotly-spec.json`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              }}
                            >
                              Download Spec
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center mt-4">
                      <div className="mb-4 text-muted-foreground">
                        <svg
                          className="w-16 h-16 mx-auto mb-4 opacity-50"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                      </div>
                      <p className="text-muted-foreground mb-2">
                        No visualizations yet
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Click "Generate Visualizations" to create interactive
                        charts
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="stats">
                  {isSQLSource ? (
                    <div className="space-y-4">
                      <Card className="p-4">
                        <p className="text-sm text-muted-foreground">
                          Database Type
                        </p>
                        <p className="text-2xl font-bold">
                          {dbType.toUpperCase()}
                        </p>
                      </Card>
                      <Card className="p-4">
                        <h3 className="font-semibold mb-3">
                          Connection Details
                        </h3>
                        <div className="space-y-2">
                          <div className="text-sm">
                            <span className="font-medium">URI:</span>
                            <p className="text-muted-foreground break-all mt-1">
                              {dburi}
                            </p>
                          </div>
                          {sqlTableData.length > 0 && (
                            <>
                              <div className="text-sm">
                                <span className="font-medium">
                                  Last Query Rows:
                                </span>
                                <p className="text-muted-foreground mt-1">
                                  {sqlTableData.length}
                                </p>
                              </div>
                              <div className="text-sm">
                                <span className="font-medium">Columns:</span>
                                <p className="text-muted-foreground mt-1">
                                  {sqlColumns.length}
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </Card>
                      {sqlColumns.length > 0 && (
                        <Card className="p-4">
                          <h3 className="font-semibold mb-3">
                            Last Query Schema
                          </h3>
                          <div className="space-y-2">
                            {sqlColumns.map((col) => (
                              <div
                                key={col}
                                className="flex justify-between text-sm"
                              >
                                <span className="font-medium">{col}</span>
                                <Badge variant="secondary">column</Badge>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Card className="p-4">
                          <p className="text-sm text-muted-foreground">
                            Total Rows
                          </p>
                          <p className="text-2xl font-bold">
                            {dataset.schema.rowCount}
                          </p>
                        </Card>
                        <Card className="p-4">
                          <p className="text-sm text-muted-foreground">
                            Columns
                          </p>
                          <p className="text-2xl font-bold">
                            {dataset.schema.fields.length}
                          </p>
                        </Card>
                      </div>
                      <Card className="p-4">
                        <h3 className="font-semibold mb-3">Schema</h3>
                        <div className="space-y-2">
                          {dataset.schema.fields.map((field) => (
                            <div
                              key={field.name}
                              className="flex justify-between text-sm"
                            >
                              <span className="font-medium">{field.name}</span>
                              <Badge variant="secondary">{field.type}</Badge>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Right Column - Chat Assistant */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-4">
              <h2 className="text-xl font-semibold mb-4">AI Assistant</h2>
              {selectedVizIds.size > 0 && (
                <div className="mb-4 p-3 bg-primary/10 rounded-lg">
                  <p className="text-sm font-medium">
                    📊 {selectedVizIds.size} visualization
                    {selectedVizIds.size > 1 ? "s" : ""} selected
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    These will be included as context when generating reports
                  </p>
                </div>
              )}
              <div className="flex flex-col h-[700px]">
                <ScrollArea className="flex-1 mb-4 p-4 border rounded-lg">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`mb-3 ${
                        msg.role === "assistant"
                          ? "bg-muted/50 rounded-lg p-3"
                          : "bg-primary/10 rounded-lg p-3"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">
                        {msg.content}
                      </p>

                      {/* SQL Result Display */}
                      {msg.sqlData && (
                        <SQLResultDisplay sqlData={msg.sqlData} />
                      )}

                      {/* Report Download Buttons */}
                      {msg.html && (
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => downloadReport(msg.html!, "pdf")}
                            disabled={downloadLoading}
                          >
                            {downloadLoading ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3 mr-1" />
                            )}
                            {downloadLoading ? "Generating..." : "Download PDF"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadReport(msg.html!, "html")}
                            disabled={downloadLoading}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download HTML
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="mb-3 bg-muted/30 rounded-lg p-3 text-sm flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isSQLSource
                        ? "Querying database..."
                        : "Analyzing your data..."}
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </ScrollArea>
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" && !loading && sendMessage()
                    }
                    placeholder={
                      isSQLSource
                        ? "Ask a question about your database..."
                        : "Ask about your data..."
                    }
                    disabled={loading}
                  />
                  <Button onClick={sendMessage} disabled={loading} size="icon">
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
