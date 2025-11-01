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
} from "lucide-react";
import {
  SQLiteHandler,
  PostgresHandler,
  MySQLHandler,
} from "@/components/upload/SQLHandlers";
import PlotlyRenderer from "@/components/PlotlyRenderer";
import { PreviewTable } from "@/components/upload/PreviewTable";
import { getUserInfo } from "@/lib/api";

type Message = { role: "user" | "assistant"; content: string; html?: string };

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

    // Load user info to get existing SQL connections
    loadUserInfo();
  }, []);

  // Auto-load SQL connection when source changes and connection exists
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

    // If connection exists and dataset is not already loaded, auto-load it
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

  // Handle AdSense authentication callback
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

    // Create a mock dataset for SQL sources
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

    // Reload user info to include the new connection
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

    return await response.json();
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

    return await response.json();
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

      if (isSQLSource) {
        if (isReportRequest) {
          // Get selected visualizations context
          const selectedVizContext = visualizations
            .filter((viz) => selectedVizIds.has(viz.id))
            .map((viz) => ({
              id: viz.id,
              title: viz.title,
              description: viz.description,
              plotlyData: viz.plotlyData,
              plotlyLayout: viz.plotlyLayout,
            }));

          const reportData = await generateSQLReport(userMessage);

          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `✓ Report generated successfully! ${
                selectedVizContext.length > 0
                  ? `Including ${selectedVizContext.length} selected visualization(s).`
                  : ""
              } Click below to download.`,
              html: reportData,
            },
          ]);
        } else {
          const data = await fetchSQLData(userMessage);

          // If data contains table results, update the preview
          if (data.rows && data.columns) {
            setSqlTableData(data.rows);
            setSqlColumns(data.columns);
            setActiveTab("table");
          }

          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                data.answer ||
                `✓ Query executed successfully! ${
                  data.rows?.length || 0
                } rows returned.`,
            },
          ]);
        }
      } else if (dataset) {
        // Regular dataset handling
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
        const data = await requestSQLVisualizations();
        setVisualizations(data.visualizations || data || []);
      } else {
        const response = await fetch("/api/llm/visualize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataset, config }),
        });

        if (!response.ok) throw new Error("Failed to generate visualizations");

        const data = await response.json();
        setVisualizations(data.visualizations || []);
      }

      setActiveTab("charts");
    } catch (err: any) {
      setError(err.message);
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
        // Download as HTML
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
        // Dynamically import html2pdf only on client side
        const html2pdf = (await import("html2pdf.js")).default;

        // Download as PDF with chart rendering
        // Create a hidden iframe to render the HTML with charts
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.top = "-10000px";
        iframe.style.left = "-10000px";
        iframe.style.width = "1200px";
        iframe.style.height = "1000px";
        document.body.appendChild(iframe);

        // Write HTML to iframe
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) throw new Error("Failed to access iframe document");

        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();

        // Wait for Chart.js to load and render all charts
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
              // Wait additional time for charts to render
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

        // Configure PDF options
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

        // Generate PDF from iframe content
        await html2pdf().set(opt).from(iframeDoc.body).save();

        // Clean up iframe
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

    // Check if SQL source has existing connection
    const isSQLSource = ["postgres", "mysql", "sqlite"].includes(source);

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

    // If SQL source has existing connection, don't show input (chat interface will show)
    if (isSQLSource && existingConnection) {
      return null;
    }

    // Show input for sources without existing connections
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
                        {vizLoading
                          ? "Generating..."
                          : "Generate Visualizations"}
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
                      {msg.html && (
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => downloadReport(msg.html!, "pdf")}
                            disabled={downloadLoading}
                          >
                            <Download className="h-3 w-3 mr-1" />
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
                    <div className="mb-3 bg-muted/30 rounded-lg p-3 text-sm">
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
                    onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                    placeholder={
                      isSQLSource
                        ? "Ask a question about your database..."
                        : "Ask about your data..."
                    }
                    disabled={loading}
                  />
                  <Button onClick={sendMessage} disabled={loading} size="icon">
                    <Send className="h-4 w-4" />
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
