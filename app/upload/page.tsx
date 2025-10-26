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
    value: "postgres",
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
  const [originalDataset, setOriginalDataset] = useState<DataSet | null>(null);
  const [error, setError] = useState<string>("");
  const [openRouterKey, setOpenRouterKey] = useState<string>("");
  const [indexingProgress, setIndexingProgress] = useState<number>(0);
  const [isIndexing, setIsIndexing] = useState(false);
  const [showAdSenseBanner, setShowAdSenseBanner] = useState(false);

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

  // Visualization states
  const [visualizations, setVisualizations] = useState<VisualizationSpec[]>([]);
  const [vizLoading, setVizLoading] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<string>("table");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("OPENROUTER_API_KEY");
      if (saved) setOpenRouterKey(saved);
    } catch {}
  }, []);

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

      // Clean up URL params immediately
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("adsense_auth");
      window.history.replaceState({}, "", newUrl.pathname + newUrl.hash);

      // Auto-hide banner after 10 seconds
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

      // Clean up URL params
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

  const indexDataset = async (ds: DataSet) => {
    if (!openRouterKey) {
      setError("Please set OpenRouter API key to enable chat features");
      return;
    }

    setIsIndexing(true);
    setIndexingProgress(0);

    try {
      await VectorService.indexDataset(ds, openRouterKey, (progress) => {
        setIndexingProgress(progress);
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `✓ Dataset indexed successfully! You can now chat with this data. Go to the Chat tab to start.`,
        },
      ]);
    } catch (err: any) {
      setError(`Failed to index dataset: ${err.message}`);
    } finally {
      setIsIndexing(false);
      setIndexingProgress(0);
    }
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

  const sendMessage = async () => {
    if (!input.trim() || !dataset) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const isReportRequest = /report|summary|document|pdf/i.test(userMessage);

      if (isReportRequest) {
        const response = await fetch("/api/llm/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataset, query: userMessage, config }),
        });

        if (!response.ok) throw new Error("Failed to generate report");

        const data = await response.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "✓ Report generated successfully! Click below to download.",
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
    if (!dataset) return;

    setVizLoading(true);
    try {
      const response = await fetch("/api/llm/visualize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset, config }),
      });

      if (!response.ok) throw new Error("Failed to generate visualizations");

      const data = await response.json();
      setVisualizations(data.visualizations || []);
      setActiveTab("charts");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setVizLoading(false);
    }
  };

  const downloadReport = (html: string) => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUriLoaded = (uri: string) => {
    setDburi(uri);
    setError("");
    setMessages([
      {
        role: "assistant",
        content: `URI loaded successfully! Ready to connect to database.`,
      },
    ]);
    setActiveTab("table");
  };

  const renderDataSourceInput = () => {
    const props = { onDataLoaded: handleDataLoaded, onError: handleError };
    const sqlprops = { onUriLoaded: handleUriLoaded, onError: handleError };

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
      case "postgres":
        return <PostgresHandler {...sqlprops} />;
      case "mysql":
        return <MySQLHandler {...sqlprops} />;
      case "sqlite":
        return <SQLiteHandler {...sqlprops} />;
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

  // Group sources by category
  const groupedSources = DATA_SOURCES.reduce((acc, source) => {
    if (!acc[source.category]) acc[source.category] = [];
    acc[source.category].push(source);
    return acc;
  }, {} as Record<string, typeof DATA_SOURCES>);

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

      {/* Main Content - Non-Database Sources */}
      {dataset && !["postgres", "mysql", "sqlite"].includes(source) && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Data View & Cleaning */}
          <div className="lg:col-span-2 space-y-6">
            {/* Data Cleaning */}
            <DataCleaning
              options={cleaningOptions}
              onChange={setCleaningOptions}
              onApply={applyCleaning}
              disabled={loading}
            />

            {/* Data Display */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Dataset View</h2>
                  <p className="text-sm text-muted-foreground">
                    {dataset.schema.rowCount} rows ×{" "}
                    {dataset.schema.fields.length} columns
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={resetData}>
                  Reset Data
                </Button>
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
                  <PreviewTable
                    rows={dataset.rows}
                    columns={dataset.schema.fields.map((f) => f.name)}
                  />
                </TabsContent>

                <TabsContent value="charts">
                  <div className="space-y-4">
                    <Button
                      onClick={requestVisualizations}
                      disabled={vizLoading}
                    >
                      {vizLoading ? "Generating..." : "Generate Visualizations"}
                    </Button>
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
                          className="space-y-2 border-2 border-gray-200 rounded-lg"
                        >
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
                                const specString = JSON.stringify(
                                  spec,
                                  null,
                                  2
                                );
                                const blob = new Blob([specString], {
                                  type: "application/json",
                                });
                                const url = URL.createObjectURL(blob);
                                const newWindow = window.open(url, "_blank");
                                if (newWindow) {
                                  newWindow.document.title = `${viz.title} - Plotly Spec`;
                                }
                                setTimeout(
                                  () => URL.revokeObjectURL(url),
                                  60000
                                );
                              }}
                            >
                              View Raw Spec
                            </Button>

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
                        <p className="text-sm text-muted-foreground">Columns</p>
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
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Right Column - Chat Assistant */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-4">
              <h2 className="text-xl font-semibold mb-4">AI Assistant</h2>
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => downloadReport(msg.html!)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download Report
                        </Button>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="mb-3 bg-muted/30 rounded-lg p-3 text-sm">
                      Analyzing your data...
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </ScrollArea>
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Ask about your data..."
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

      {/* Main Content - Database Sources */}
      {dataset && ["postgres", "mysql", "sqlite"].includes(source) && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Dataset View</h2>
                  <p className="text-sm text-muted-foreground">
                    {source} Source: {dburi}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={resetData}>
                  Reset Data
                </Button>
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
                  <div className="text-sm text-muted-foreground text-center py-8">
                    <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Database connection established</p>
                    <p className="mt-2">
                      Use the AI Assistant to query your data
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="charts">
                  <div className="space-y-4">
                    <Button
                      onClick={requestVisualizations}
                      disabled={vizLoading}
                    >
                      {vizLoading ? "Generating..." : "Generate Visualizations"}
                    </Button>
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
                          className="space-y-2 border-2 border-gray-200 rounded-lg"
                        >
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
                                const specString = JSON.stringify(
                                  spec,
                                  null,
                                  2
                                );
                                const blob = new Blob([specString], {
                                  type: "application/json",
                                });
                                const url = URL.createObjectURL(blob);
                                const newWindow = window.open(url, "_blank");
                                if (newWindow) {
                                  newWindow.document.title = `${viz.title} - Plotly Spec`;
                                }
                                setTimeout(
                                  () => URL.revokeObjectURL(url),
                                  60000
                                );
                              }}
                            >
                              View Raw Spec
                            </Button>

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
                        <p className="text-sm text-muted-foreground">Columns</p>
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
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Right Column - Chat Assistant for Database */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-4">
              <h2 className="text-xl font-semibold mb-4">AI Assistant</h2>
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => downloadReport(msg.html!)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download Report
                        </Button>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="mb-3 bg-muted/30 rounded-lg p-3 text-sm">
                      Analyzing your data...
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </ScrollArea>
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Ask about your data..."
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
