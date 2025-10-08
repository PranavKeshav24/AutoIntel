// UploadPageWithLLMVisualizations.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { SourcePicker, type DataSourceType } from "@/components/upload/SourcePicker";
import {
  CsvExcelDrop,
  GoogleSheetsInput,
  FileInputGeneric,
} from "@/components/upload/FileInputs";
import { PreviewTable } from "@/components/upload/PreviewTable";
import { ChartSuggestions } from "@/components/upload/ChartSuggestions";
import { Csv, ExcelConnector, SheetsConnector, runAutoIntel, aiChat } from "@/lib/connectors";
import { TextInputLoader } from "@/components/upload/TextInput";
import {
  Upload,
  FileSpreadsheet,
  Table as TableIcon,
  AlertCircle,
  Send,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { queryPostgres, querySqlite, queryMysql } from "@/lib/api";
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type Message = { role: "user" | "assistant"; content: string };

type ChartType = "bar" | "line" | "pie";

type VizSeries = {
  key: string;
  name?: string;
  type?: "bar" | "line" | "area";
  color?: string;
};

type VizSchema = {
  chartType: ChartType;
  data?: any[];
  xKey?: string; // for bar/line -> x axis key
  nameKey?: string; // for pie: category key
  series?: VizSeries[]; // series for bar/line OR for pie series[0].key == value
  options?: Record<string, any>;
  description?: string;
  code?: string; // js snippet string (for display only)
};

const DEFAULT_COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7f50",
  "#a4de6c",
  "#d0ed57",
];

export default function UploadPageWithLLMVisualizations() {
  // Data states
  const [data, setData] = useState<any[]>([]);
  const [originalData, setOriginalData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("table");

  // Chat/assistant states
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const sqlSources = new Set<DataSourceType>(["postgres", "sqlite", "mysql"] as any);

  // Visualization states
  const [vizSchema, setVizSchema] = useState<VizSchema | null>(null);
  const [vizError, setVizError] = useState<string | null>(null);
  const [vizLoading, setVizLoading] = useState(false);
  const [vegaSpecs, setVegaSpecs] = useState<any[]>([]);
  const [source, setSource] = useState<DataSourceType>("csv");
  const [openRouterKey, setOpenRouterKey] = useState<string>("");

  /* ---------------------------- Parsing & cleaning ------------------------- */

  const normalizeRows = (rows: any[]) => {
    if (!rows || rows.length === 0) return { rows: [], cols: [] };

    // handle arrays where first row is header
    if (Array.isArray(rows[0])) {
      const header = rows[0].map((h: any, i: number) =>
        h === undefined || h === null || String(h).trim() === ""
          ? `col_${i}`
          : String(h).trim()
      );
      const dataRows = rows.slice(1).map((r: any[]) => {
        const obj: any = {};
        header.forEach((h: string, i: number) => {
          const v = r[i];
          obj[h] = v === "" || v === undefined ? null : v;
        });
        return obj;
      });
      return { rows: dataRows, cols: header };
    }

    // objects -> union keys
    const colsSet = new Set<string>();
    rows.forEach((r) => {
      if (r && typeof r === "object") {
        Object.keys(r).forEach((k) => colsSet.add(String(k).trim()));
      }
    });
    const cols = Array.from(colsSet);

    const normalized = rows.map((r) => {
      const obj: any = {};
      cols.forEach((c) => {
        const raw = (r as any)[c];
        obj[c] = raw === "" || raw === undefined ? null : raw;
      });
      return obj;
    });

    return { rows: normalized, cols };
  };

  const cleanData = (rawData: any[]) => {
    return rawData
      .map((row) => {
        const out: any = {};
        Object.keys(row).forEach((k) => {
          let v = row[k];

          if (v === undefined || (typeof v === "string" && v.trim() === "")) {
            out[k] = null;
            return;
          }

          if (typeof v === "string") v = v.trim();

          if (typeof v === "string") {
            const lower = v.toLowerCase();
            if (lower === "true") {
              out[k] = true;
              return;
            } else if (lower === "false") {
              out[k] = false;
              return;
            }
            // numeric with commas
            const maybeNum = v.replace(/,/g, "");
            if (!isNaN(Number(maybeNum))) {
              out[k] = Number(maybeNum);
              return;
            }
            // dates
            if (!isNaN(Date.parse(v))) {
              out[k] = new Date(v).toISOString();
              return;
            }
          }

          out[k] = v;
        });
        return out;
      })
      .filter((row) =>
        Object.values(row).some((v) => v !== null && v !== undefined)
      );
  };

  /* ------------------------------- LLM call -------------------------------- */

  const callLLM = async (
    messagesForLLM: { role: string; content: string }[]
  ) => {
    const key = openRouterKey || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
    return aiChat(messagesForLLM as any, {
      apiKey: key,
      model: process.env.NEXT_PUBLIC_OPENROUTER_MODEL,
      referer: process.env.NEXT_PUBLIC_OPENROUTER_REFERER,
      title: process.env.NEXT_PUBLIC_OPENROUTER_TITLE,
    });
  };

  /* ----------------------- Extract JSON & code from text ------------------- */

  const extractJSONFromText = (
    text: string
  ): { json: any | null; leftover: string } => {
    if (!text) return { json: null, leftover: text };

    // 1) fenced json block
    const fencedJsonMatch = text.match(/```json\s*([\s\S]*?)```/i);
    if (fencedJsonMatch && fencedJsonMatch[1]) {
      try {
        const parsed = JSON.parse(fencedJsonMatch[1]);
        return { json: parsed, leftover: text.replace(fencedJsonMatch[0], "") };
      } catch (e) {
        // continue
      }
    }

    // 2) any fenced block
    const fencedAnyMatch = text.match(/```([\s\S]*?)```/);
    if (fencedAnyMatch && fencedAnyMatch[1]) {
      try {
        const parsed = JSON.parse(fencedAnyMatch[1]);
        return { json: parsed, leftover: text.replace(fencedAnyMatch[0], "") };
      } catch (e) {
        // continue
      }
    }

    // 3) find first balanced braces substring
    const firstBrace = text.indexOf("{");
    if (firstBrace === -1) return { json: null, leftover: text };
    let stack = 0;
    for (let i = firstBrace; i < text.length; i++) {
      const ch = text[i];
      if (ch === "{") stack++;
      else if (ch === "}") {
        stack--;
        if (stack === 0) {
          const substr = text.slice(firstBrace, i + 1);
          try {
            const parsed = JSON.parse(substr);
            return { json: parsed, leftover: text.slice(i + 1) };
          } catch (e) {
            break;
          }
        }
      }
    }

    return { json: null, leftover: text };
  };

  const extractCodeFromText = (text: string): string | null => {
    if (!text) return null;
    const match = text.match(/```(?:javascript|js|jsx)\s*([\s\S]*?)```/i);
    if (match && match[1]) return match[1].trim();
    const anyMatch = text.match(/```([\s\S]*?)```/);
    if (anyMatch && anyMatch[1]) return anyMatch[1].trim();
    return null;
  };

  /* --------------------------- Prompt builders ----------------------------- */

  const sampleRows = (rows: any[], max = 10) => {
    if (!rows) return [];
    if (rows.length <= max) return rows;
    return rows.slice(0, max);
  };

  const summarizeForVizPrompt = (rows: any[], cols: string[]) => {
    const numericCols = cols.filter((c) =>
      rows.some(
        (r) => r[c] !== null && r[c] !== undefined && !isNaN(Number(r[c]))
      )
    );
    const sample = sampleRows(rows, 10).map((r) =>
      cols.reduce((acc: any, c: string) => {
        acc[c] = r[c];
        return acc;
      }, {} as any)
    );

    return `DATA SUMMARY:
- rows: ${rows.length}
- columns: ${cols.length}
- numeric columns: ${numericCols.join(", ") || "(none)"}

SAMPLE (first up to 10 rows):
${JSON.stringify(sample, null, 2)}

INSTRUCTION:
Produce a JSON object (inside a \`\`\`json block) conforming strictly to the schema below. Also include a JavaScript React snippet in a \`\`\`javascript block that shows a React component using recharts that renders the same visualization. Return ONLY those code blocks (no extra exposition).

Schema:
{
  "chartType": "bar" | "line" | "pie",
  "xKey": "columnName for x axis (for bar/line)",
  "nameKey": "category column for pie (optional)",
  "series": [
    { "key": "columnName", "name": "display name (optional)", "type": "bar|line (optional)", "color": "#hex (optional)"}
  ],
  "data": optional array of objects (if omitted, use full dataset on client),
  "options": optional object for chart options,
  "description": optional short text
}

Rules:
- If chartType is 'pie', include series as a single entry with key pointing to value column and nameKey set to category column.
- Keep JSON minimal and valid (no comments). Use ISO strings for dates if returning explicit data.
- The JavaScript snippet should import Recharts components and show a simple React functional component named VizComponent that uses the same keys as your JSON.
- Do not include any external libraries in the snippet beyond Recharts.
- Prefer numeric columns for series.`;
  };

  /* ---------------------------- File processing ---------------------------- */

  const processData = async (rawData: any[]) => {
    try {
      if (!rawData || rawData.length === 0) {
        setError("No data found in the file");
        return;
      }

      const { rows: normalizedRows, cols } = normalizeRows(rawData);
      const cleaned = cleanData(normalizedRows);

      if (cleaned.length === 0) {
        setError("No usable data after cleaning");
        return;
      }

      setOriginalData(normalizedRows);
      setColumns(cols);
      setData(cleaned);
      setError("");

      setMessages([
        { role: "assistant", content: "Dataset loaded. Ask a question or generate charts." },
      ]);
    } catch (err) {
      console.error(err);
      setError("Error processing file");
    }
  };

  const handleCSV = async (file: File) => {
    try {
      const dataset = await Csv.loadCsvFromBlob(file, file.name as any);
      await processData((dataset as any).rows || (dataset as any));
    } catch (e) {
      setError("Error parsing CSV file");
    }
  };

  const handleExcel = async (file: File) => {
    try {
      const dataset = await ExcelConnector.loadExcelFromBlob(file, { name: file.name } as any);
      await processData((dataset as any).rows || (dataset as any));
    } catch (e) {
      setError("Error parsing Excel file");
    }
  };

  // Replaced by modular inputs

  /* -------------------- Visualization request & parsing ------------------- */

  const requestVisualizationFromLLM = async () => {
    setVizError(null);
    setVizLoading(true);
    try {
      const aiConfig = {
        apiKey: process.env.NEXT_PUBLIC_OPENROUTER_API_KEY,
        model: "openai/gpt-oss-120b:free",
      } as any;
      const result = await runAutoIntel(
        { rows: data, name: "uploaded" } as any,
        "Suggest the best 4 charts for this dataset",
        aiConfig
      );
      setVegaSpecs(Array.isArray(result.specs) ? result.specs : []);
    } catch (e: any) {
      setVizError(e?.message || "Failed to suggest charts.");
    } finally {
      setVizLoading(false);
    }
  };

  /* --------------------------- Chart rendering ---------------------------- */

  const ChartRenderer: React.FC<{ schema: VizSchema }> = ({ schema }) => {
    const chartData = schema.data ?? [];
    // safe sampling for performance
    const dataForRender =
      chartData.length > 1000
        ? chartData.filter(
            (_: any, i: number) => i % Math.ceil(chartData.length / 1000) === 0
          )
        : chartData;

    if (schema.chartType === "bar") {
      const xKey = schema.xKey!;
      const series = schema.series ?? [];

      return (
        <div style={{ width: "100%", height: 420 }}>
          <ResponsiveContainer>
            <BarChart data={dataForRender}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {series.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.name || s.key}
                  fill={s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (schema.chartType === "line") {
      const xKey = schema.xKey!;
      const series = schema.series ?? [];

      return (
        <div style={{ width: "100%", height: 420 }}>
          <ResponsiveContainer>
            <LineChart data={dataForRender}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {series.map((s, i) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name || s.key}
                  stroke={s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (schema.chartType === "pie") {
      const categoryKey = schema.nameKey ?? schema.xKey;
      const valueKey =
        schema.series && schema.series[0] ? schema.series[0].key : undefined;
      if (!valueKey || !categoryKey)
        return <div>Pie schema missing category or value key.</div>;
      // aggregate
      const agg: Record<string, number> = {};
      dataForRender.forEach((r: any) => {
        const cat = String(r[categoryKey] ?? "Unknown");
        const val = Number(r[valueKey]) || 0;
        agg[cat] = (agg[cat] || 0) + val;
      });
      const pieData = Object.entries(agg).map(([name, value]) => ({
        name,
        value,
      }));

      return (
        <div style={{ width: "100%", height: 420 }}>
          <ResponsiveContainer>
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie data={pieData} dataKey="value" nameKey="name" label>
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      (schema.series &&
                        schema.series[0] &&
                        schema.series[0].color) ||
                      DEFAULT_COLORS[index % DEFAULT_COLORS.length]
                    }
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    return <div>Unsupported chart type: {String(schema.chartType)}</div>;
  };

  /* ------------------------ Stats & correlation --------------------------- */

  const getNumericColumns = () => {
    if (data.length === 0) return [];
    return columns.filter((col) =>
      data.some(
        (r) => r[col] !== null && r[col] !== undefined && !isNaN(Number(r[col]))
      )
    );
  };

  const calculateCorrelationBetween = (col1: string, col2: string) => {
    const pairs = data
      .map((r) => ({ x: Number(r[col1]), y: Number(r[col2]) }))
      .filter((p) => !isNaN(p.x) && !isNaN(p.y));
    if (pairs.length === 0) return 0;
    const n = pairs.length;
    const meanX = pairs.reduce((a, b) => a + b.x, 0) / n;
    const meanY = pairs.reduce((a, b) => a + b.y, 0) / n;
    const cov = pairs.reduce((a, b) => a + (b.x - meanX) * (b.y - meanY), 0);
    const varX = pairs.reduce((a, b) => a + Math.pow(b.x - meanX, 2), 0);
    const varY = pairs.reduce((a, b) => a + Math.pow(b.y - meanY, 2), 0);
    if (varX === 0 || varY === 0) return 0;
    return cov / Math.sqrt(varX * varY);
  };

  /* ------------------------- Chat with LLM (free text) -------------------- */

  const sendUserMessageToLLM = async (userMessage: string) => {
    if (!userMessage || userMessage.trim() === "") return;
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setLoadingAnalysis(true);

    try {
      if (sqlSources.has(source)) {
        let reply = "";
        if (source === ("postgres" as DataSourceType)) reply = await queryPostgres(userMessage);
        else if (source === ("sqlite" as DataSourceType)) reply = await querySqlite(userMessage);
        else if (source === ("mysql" as DataSourceType)) reply = await queryMysql(userMessage);
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      } else {
        if (!data || data.length === 0) {
          setMessages((prev) => [...prev, { role: "assistant", content: "Load a dataset first (CSV/Excel/Sheets) to ask questions about it." }]);
        } else {
          const aiKey = openRouterKey || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
          const result = await runAutoIntel(
            { rows: data, name: "uploaded" } as any,
            userMessage,
            { apiKey: aiKey, model: process.env.NEXT_PUBLIC_OPENROUTER_MODEL as any }
          );
          setVegaSpecs(Array.isArray(result.specs) ? result.specs : []);
          const report = (result as any)?.report || "";
          setMessages((prev) => [...prev, { role: "assistant", content: report || "" }]);
        }
      }
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to fetch analysis from LLM." },
      ]);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleUserMessage = () => {
    if (!input.trim()) return;
    sendUserMessageToLLM(input.trim());
  };

  /* ------------------------------ Render UI ------------------------------- */

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8">Upload Your Data</h1>

      <div className="mb-6">
        <SourcePicker value={source} onChange={setSource} />
      </div>
      <Card className="p-4 mb-6">
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="text-sm text-muted-foreground">OpenRouter API Key</label>
            <Input
              placeholder="sk-or-v1-..."
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
            />
          </div>
          <div>
            <Button onClick={() => {
              try { localStorage.setItem("OPENROUTER_API_KEY", openRouterKey || ""); } catch {}
            }} className="w-full">Save Key</Button>
          </div>
        </div>
      </Card>
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {(source === "csv" || source === "excel") && (
          <CsvExcelDrop onCsv={handleCSV} onExcel={handleExcel} />
        )}
        {source === "sheets" && (
          <GoogleSheetsInput
            onSubmit={async (url) => {
              try {
                const dataset = await SheetsConnector.loadGoogleSheetCsvByUrl(url);
                await processData((dataset as any).rows || (dataset as any));
              } catch (e) {
                setError("Failed to load Google Sheet");
              }
            }}
          />
        )}
        {source === "json" && (
          <FileInputGeneric
            accept="application/json"
            onFile={async (f) => {
              try {
                const text = await f.text();
                const parsed = JSON.parse(text);
                const rows = Array.isArray(parsed) ? parsed : parsed.rows || [];
                await processData(rows);
              } catch {
                setError("Invalid JSON file");
              }
            }}
          />
        )}
        {source === "pdf" && (
          <FileInputGeneric
            accept="application/pdf"
            onFile={async () => setError("PDF preview not yet implemented")}
          />
        )}
        {source === "text" && (
          <TextInputLoader
            onSubmit={async (rows) => {
              await processData(rows as any[]);
            }}
          />
        )}
        {source === ("mongodb" as DataSourceType) && (
          <Card className="p-4">
            MongoDB integration will use autointel-package docs.
          </Card>
        )}
        {(source === ("postgres" as DataSourceType) || source === ("sqlite" as DataSourceType) || source === ("mysql" as DataSourceType)) && (
          <Card className="p-4">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Connected to {String(source).toUpperCase()} via your Profile settings. Ask a question below.
              </div>
            </div>
          </Card>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-8">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {(data.length > 0 || sqlSources.has(source)) && (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: table / charts / stats */}
          {sqlSources.has(source as any) ? null : (
          <Card className="p-6">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(String(v))}
            >
              <TabsList className="mb-4">
                <TabsTrigger value="table">Table View</TabsTrigger>
                <TabsTrigger value="chart">Chart View</TabsTrigger>
                <TabsTrigger value="stats">Statistics</TabsTrigger>
              </TabsList>

              <TabsContent value="table">
                <PreviewTable rows={data} columns={columns} />
              </TabsContent>

              <TabsContent value="chart">
                <div className="mb-4">
                  <Button
                    onClick={requestVisualizationFromLLM}
                    disabled={vizLoading}
                  >
                    {vizLoading ? "Generating..." : "Suggest Visualizations"}
                  </Button>
                </div>
                {vizError && (
                  <div className="text-destructive mb-4">{vizError}</div>
                )}
                <ChartSuggestions specs={vegaSpecs as any[]} />
              </TabsContent>

              <TabsContent value="stats">
                <div className="grid md:grid-cols-2 gap-4">
                  {getNumericColumns().map((col) => {
                    const values = data
                      .map((r) => Number(r[col]))
                      .filter((v) => !isNaN(v));
                    const sum = values.reduce((a, b) => a + b, 0);
                    const avg = values.length ? sum / values.length : 0;
                    const max = values.length ? Math.max(...values) : 0;
                    const min = values.length ? Math.min(...values) : 0;
                    return (
                      <Card key={col} className="p-4">
                        <h3 className="font-semibold mb-2">{col}</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">
                              Average:{" "}
                            </span>
                            {avg.toFixed(2)}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Sum: </span>
                            {sum.toFixed(2)}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Max: </span>
                            {max.toFixed(2)}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Min: </span>
                            {min.toFixed(2)}
                          </div>
                        </div>
                      </Card>
                    );
                  })}

                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">
                      Correlations (numeric columns)
                    </h3>
                    <div className="text-sm whitespace-pre-wrap">
                      {(() => {
                        const numericCols = getNumericColumns();
                        if (numericCols.length < 2)
                          return "Not enough numeric columns to compute correlations.";
                        let s = "";
                        for (let i = 0; i < numericCols.length - 1; i++) {
                          for (let j = i + 1; j < numericCols.length; j++) {
                            const corr = calculateCorrelationBetween(
                              numericCols[i],
                              numericCols[j]
                            );
                            s += `- ${numericCols[i]} vs ${
                              numericCols[j]
                            }: ${corr.toFixed(2)}\n`;
                          }
                        }
                        return s;
                      })()}
                    </div>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
          )}

          {/* Right: Data assistant / chat */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Data Assistant</h2>
            {sqlSources.has(source as any) && (
              <div className="mb-3 text-sm text-muted-foreground">Chatting with your {source.toUpperCase()} database.</div>
            )}
            <div className="flex flex-col h-[600px]">
              <ScrollArea className="flex-1 mb-4 p-4 border rounded-lg">
                {loadingAnalysis && (
                  <div className="mb-4 bg-muted/30 rounded-lg p-3">
                    Generating analysis...
                  </div>
                )}
                {messages.map((message, idx) => (
                  <div
                    key={idx}
                    className={`mb-4 ${
                      message.role === "assistant"
                        ? "bg-muted/50 rounded-lg p-3"
                        : "bg-primary/5 rounded-lg p-3"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </ScrollArea>
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleUserMessage()}
                  placeholder="Ask about your data..."
                  className="flex-1"
                />
                <Button onClick={handleUserMessage}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
