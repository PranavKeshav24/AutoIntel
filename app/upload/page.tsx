"use client";

import React, { useState, useEffect } from "react";
import {
  DataSet,
  OpenRouterConfig,
  VisualizationSpec,
  DataCleaningOptions,
  DataSourceType,
} from "@/lib/types";
import { DataProcessor } from "@/lib/dataProcessor";
import { DataCleaning } from "@/components/upload/DataCleaning";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  Table2,
  BarChart3,
  FileText,
  Database,
} from "lucide-react";
import { PreviewTable } from "@/components/upload/PreviewTable";
import { getUserInfo } from "@/lib/api";

// Import modularized components
import { ApiKeyConfig } from "@/components/upload/APIKeyConfig";
import { AdSenseBanner } from "@/components/upload/AdSenseBanner";
import { DataSourceSelector } from "@/components/upload/DataSourceSelector";
import { DataSourceInput } from "@/components/upload/DataSourceInput";
import { ChatAssistant } from "@/components/upload/ChatAssistant";
import { VisualizationsTab } from "@/components/upload/VisualizationsTab";
import { StatsTab } from "@/components/upload/StatsTab";
import { useSQLOperations } from "@/hooks/use-sql-operations";
import { useReportDownload } from "@/hooks/use-report-download";
import { Message } from "@/lib/types";

export default function UploadPage() {
  const [source, setSource] = useState<DataSourceType>("csv");
  const [dataset, setDataset] = useState<DataSet | null>(null);
  const [dburi, setDburi] = useState<string>("");
  const [dbType, setDbType] = useState<string>("");
  const [originalDataset, setOriginalDataset] = useState<DataSet | null>(null);
  const [error, setError] = useState<string>("");
  const [openRouterKey, setOpenRouterKey] = useState<string>("");
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

  // Visualization states
  const [visualizations, setVisualizations] = useState<VisualizationSpec[]>([]);
  const [vizLoading, setVizLoading] = useState(false);
  const [selectedVizIds, setSelectedVizIds] = useState<Set<string>>(new Set());

  // Active tab
  const [activeTab, setActiveTab] = useState<string>("table");

  // Custom hooks
  const sqlOps = useSQLOperations(dbType);
  const { downloadReport, downloadLoading } = useReportDownload();

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

  const handleSourceChange = (newSource: DataSourceType) => {
    // Reset all state when changing data source
    setSource(newSource);
    setDataset(null);
    setOriginalDataset(null);
    setDburi("");
    setDbType("");
    setSqlTableData([]);
    setSqlColumns([]);
    setError("");
    setMessages([]);
    setVisualizations([]);
    setSelectedVizIds(new Set());
    setInput("");
    setActiveTab("table");
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

          const reportHtml = await sqlOps.generateSQLReport(userMessage);

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
          const vizArray = await sqlOps.requestSQLVisualizations(userMessage);

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
          const data = await sqlOps.fetchSQLData(userMessage);

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
        const vizArray = await sqlOps.requestSQLVisualizations();
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

  const handleDownloadReport = async (html: string, format: "html" | "pdf") => {
    try {
      await downloadReport(html, format);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `✓ Report downloaded successfully as ${format.toUpperCase()}!`,
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error downloading report: ${error.message}`,
        },
      ]);
    }
  };

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
      <div className="mb-6">
        <ApiKeyConfig
          apiKey={openRouterKey}
          onApiKeyChange={setOpenRouterKey}
          onSave={saveApiKey}
        />
      </div>

      {/* AdSense Authentication Success Banner */}
      <AdSenseBanner
        show={showAdSenseBanner}
        onClose={() => setShowAdSenseBanner(false)}
      />

      {/* Data Source Selection */}
      <div className="mb-6">
        <DataSourceSelector
          source={source}
          onSourceChange={handleSourceChange}
        />
      </div>

      {/* Upload/Connect Section - Always show when no dataset OR when dataset exists but user wants to change source */}
      <div className="mb-6">
        <DataSourceInput
          source={source}
          onDataLoaded={handleDataLoaded}
          onError={handleError}
          onUriLoaded={handleUriLoaded}
          userInfo={userInfo}
        />
      </div>

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
                  <VisualizationsTab
                    visualizations={visualizations}
                    selectedVizIds={selectedVizIds}
                    vizLoading={vizLoading}
                    onGenerateVisualizations={requestVisualizations}
                    onToggleSelection={toggleVizSelection}
                  />
                </TabsContent>

                <TabsContent value="stats">
                  <StatsTab
                    dataset={dataset}
                    isSQLSource={isSQLSource}
                    dbType={dbType}
                    dburi={dburi}
                    sqlTableData={sqlTableData}
                    sqlColumns={sqlColumns}
                  />
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Right Column - Chat Assistant */}
          <div className="lg:col-span-1">
            <ChatAssistant
              messages={messages}
              input={input}
              loading={loading}
              downloadLoading={downloadLoading}
              selectedVizCount={selectedVizIds.size}
              isSQLSource={isSQLSource}
              onInputChange={setInput}
              onSendMessage={sendMessage}
              onDownloadReport={handleDownloadReport}
            />
          </div>
        </div>
      )}
    </div>
  );
}
