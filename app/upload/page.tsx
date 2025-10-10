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
import { PreviewTable } from "@/components/upload/PreviewTable";
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
} from "lucide-react";
import VegaLiteRenderer from "@/components/VegaLiteRenderer";

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
  const [originalDataset, setOriginalDataset] = useState<DataSet | null>(null);
  const [error, setError] = useState<string>("");
  const [openRouterKey, setOpenRouterKey] = useState<string>("");

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

  const config: OpenRouterConfig = {
    apiKey: openRouterKey || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || "",
    model: process.env.NEXT_PUBLIC_OPENROUTER_MODEL,
    referer: process.env.NEXT_PUBLIC_OPENROUTER_REFERER,
    title: process.env.NEXT_PUBLIC_OPENROUTER_TITLE,
  };

  const handleDataLoaded = (ds: DataSet) => {
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

  // const saveApiKey = () => {
  //   try {
  //     localStorage.setItem("OPENROUTER_API_KEY", openRouterKey);
  //     alert("API key saved!");
  //   } catch {
  //     alert("Failed to save API key");
  //   }
  // };

  const sendMessage = async () => {
    if (!input.trim() || !dataset) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      // Determine if this is a visualization, report, or query request
      const isVizRequest = /chart|graph|plot|visual|show me/i.test(userMessage);
      const isReportRequest = /report|summary|document|pdf/i.test(userMessage);

      if (isReportRequest) {
        // Generate report
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
            content: "I've generated a comprehensive report for you.",
            html: data.htmlMarkdown,
          },
        ]);
      } else {
        // Regular analysis
        const response = await fetch("/api/llm/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataset, query: userMessage, config }),
        });

        if (!response.ok) throw new Error("Failed to analyze data");

        const data = await response.json();

        if (data.visualizations && data.visualizations.length > 0) {
          setVisualizations(data.visualizations);
        }

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.answer },
        ]);
      }

      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}` },
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

  const renderDataSourceInput = () => {
    const props = { onDataLoaded: handleDataLoaded, onError: handleError };

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
      case "mysql":
      case "sqlite":
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
    <div className="container mx-auto px-4 py-8">
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
                    columns={dataset.schema.fields.map((f: any) => f.name)}
                  />
                </TabsContent>

                <TabsContent value="charts">
                  <div className="mb-4 flex gap-2 items-center">
                    <Button
                      onClick={requestVisualizations}
                      disabled={vizLoading}
                    >
                      {vizLoading ? "Generating..." : "Generate Visualizations"}
                    </Button>
                    <div className="text-sm text-muted-foreground">
                      {visualizations.length > 0
                        ? `${visualizations.length} suggestion(s)`
                        : ""}
                    </div>
                  </div>

                  {visualizations.length > 0 ? (
                    <div className="space-y-6 max-h-[50vh] overflow-auto">
                      {visualizations.map((viz) => (
                        <Card key={viz.id} className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold mb-1">
                                {viz.title}
                              </h3>
                              {viz.description && (
                                <p className="text-sm text-muted-foreground mb-2">
                                  {viz.description}
                                </p>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Vega-Lite spec
                            </div>
                          </div>

                          <div className="mt-3">
                            {/* Render the actual Vega-Lite visualization */}
                            <VegaLiteRenderer spec={viz.vegaLiteSpec} />
                          </div>

                          <div className="mt-3 flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // open raw spec in new window (stringified)
                                const s = JSON.stringify(
                                  viz.vegaLiteSpec || {},
                                  null,
                                  2
                                );
                                const blob = new Blob([s], {
                                  type: "application/json",
                                });
                                const url = URL.createObjectURL(blob);
                                window.open(url, "_blank");
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
                                // copy spec to clipboard
                                navigator.clipboard
                                  .writeText(
                                    JSON.stringify(
                                      viz.vegaLiteSpec || {},
                                      null,
                                      2
                                    )
                                  )
                                  .then(() => alert("Spec copied to clipboard"))
                                  .catch(() => alert("Failed to copy"));
                              }}
                            >
                              Copy Spec
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      No visualizations yet. Click the button above to generate.
                    </p>
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
                        {dataset.schema.fields.map((field: any) => (
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
    </div>
  );
}
