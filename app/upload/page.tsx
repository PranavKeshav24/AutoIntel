"use client";

import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileSpreadsheet,
  Table,
  AlertCircle,
  Send,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function UploadPage() {
  const [data, setData] = useState<any[]>([]);
  const [originalData, setOriginalData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const [activeTab, setActiveTab] = useState("table");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const cleanData = (rawData: any[]) => {
    return rawData
      .map((row) => {
        const cleanRow = { ...row };
        Object.keys(cleanRow).forEach((key) => {
          if (typeof cleanRow[key] === "string") {
            cleanRow[key] = cleanRow[key].trim();
          }

          if (cleanRow[key] === "") {
            cleanRow[key] = null;
          }

          if (
            typeof cleanRow[key] === "string" &&
            !isNaN(Number(cleanRow[key]))
          ) {
            cleanRow[key] = Number(cleanRow[key]);
          }

          if (
            typeof cleanRow[key] === "string" &&
            !isNaN(Date.parse(cleanRow[key]))
          ) {
            cleanRow[key] = new Date(cleanRow[key]).toISOString();
          }
        });
        return cleanRow;
      })
      .filter((row) => Object.values(row).some((value) => value !== null));
  };

  const processData = (rawData: any[]) => {
    if (rawData.length === 0) {
      setError("No data found in the file");
      return;
    }

    const headers = Object.keys(rawData[0]);
    const cleanedData = cleanData(rawData);
    setOriginalData(rawData);
    setColumns(headers);
    setData(cleanedData);
    setError("");

    const analysisMessage = generateDataAnalysis(cleanedData);
    setMessages([{ role: "assistant", content: analysisMessage }]);
  };

  const generateDataAnalysis = (data: any[]) => {
    const numRows = data.length;
    const numCols = Object.keys(data[0]).length;
    const numericCols = getNumericColumns();

    let analysis = `I've analyzed your dataset. Here's what I found:\n\n`;
    analysis += `📊 Dataset Overview:\n`;
    analysis += `- ${numRows} rows of data\n`;
    analysis += `- ${numCols} columns\n`;
    analysis += `- ${numericCols.length} numeric columns\n\n`;

    if (numericCols.length > 0) {
      analysis += `📈 Numeric Columns Analysis:\n`;
      numericCols.forEach((col) => {
        const values = data.map((row) => Number(row[col]));
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        analysis += `- ${col}: Average = ${avg.toFixed(2)}\n`;
      });
    }

    analysis += `\nYou can ask me questions about the data or request specific visualizations!`;
    return analysis;
  };

  const handleUserMessage = () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");

    const response = generateResponse(userMessage);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response },
      ]);
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 500);
  };

  const generateResponse = (message: string) => {
    const lowercaseMsg = message.toLowerCase();
    let response = "";

    if (
      lowercaseMsg.includes("correlation") ||
      lowercaseMsg.includes("relationship")
    ) {
      const numericCols = getNumericColumns();
      if (numericCols.length >= 2) {
        response = `I've analyzed the relationships between numeric columns. Here's what I found:\n\n`;
        for (let i = 0; i < numericCols.length - 1; i++) {
          for (let j = i + 1; j < numericCols.length; j++) {
            const correlation = calculateCorrelation(
              numericCols[i],
              numericCols[j]
            );
            response += `- ${numericCols[i]} vs ${numericCols[j]}: ${
              Math.abs(correlation) > 0.7
                ? "Strong"
                : Math.abs(correlation) > 0.3
                ? "Moderate"
                : "Weak"
            } correlation (${correlation.toFixed(2)})\n`;
          }
        }
      } else {
        response =
          "I couldn't find enough numeric columns to analyze correlations.";
      }
    } else if (
      lowercaseMsg.includes("summary") ||
      lowercaseMsg.includes("overview")
    ) {
      response = generateDataAnalysis(data);
    } else if (
      lowercaseMsg.includes("missing") ||
      lowercaseMsg.includes("null")
    ) {
      response = analyzeMissingValues();
    } else {
      response =
        "I can help you analyze the data! You can ask about:\n- Correlations between variables\n- Summary statistics\n- Missing values\n- Specific columns or patterns";
    }

    return response;
  };

  const calculateCorrelation = (col1: string, col2: string) => {
    const values1 = data.map((row) => Number(row[col1]));
    const values2 = data.map((row) => Number(row[col2]));

    const mean1 = values1.reduce((a, b) => a + b, 0) / values1.length;
    const mean2 = values2.reduce((a, b) => a + b, 0) / values2.length;

    const variance1 = values1.reduce((a, b) => a + Math.pow(b - mean1, 2), 0);
    const variance2 = values2.reduce((a, b) => a + Math.pow(b - mean2, 2), 0);

    const covariance = values1.reduce(
      (a, b, i) => a + (b - mean1) * (values2[i] - mean2),
      0
    );

    return covariance / Math.sqrt(variance1 * variance2);
  };

  const analyzeMissingValues = () => {
    let response = "Here's an analysis of missing values:\n\n";

    columns.forEach((col) => {
      const nullCount = data.filter((row) => row[col] === null).length;
      const percentage = ((nullCount / data.length) * 100).toFixed(1);
      response += `- ${col}: ${nullCount} missing values (${percentage}%)\n`;
    });

    return response;
  };

  const handleCSV = (file: File) => {
    Papa.parse(file, {
      complete: (results) => {
        if (results.errors.length > 0) {
          setError("Error parsing CSV file");
          return;
        }
        processData(results.data);
      },
      header: true,
      skipEmptyLines: true,
    });
  };

  const handleExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        processData(jsonData);
      } catch (err) {
        setError("Error parsing Excel file");
      }
    };
    reader.readAsBinaryString(file);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setError("");
    const fileType = file.name.split(".").pop()?.toLowerCase();

    switch (fileType) {
      case "csv":
        handleCSV(file);
        break;
      case "xlsx":
      case "xls":
        handleExcel(file);
        break;
      default:
        setError("Unsupported file format. Please upload CSV or Excel files.");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
  });

  const getNumericColumns = () => {
    if (data.length === 0) return [];
    return columns.filter(
      (col) =>
        !isNaN(Number(data[0][col])) &&
        data.every((row) => !isNaN(Number(row[col])))
    );
  };

  const generateChartData = () => {
    const numericColumns = getNumericColumns();
    if (numericColumns.length < 2) return [];

    return data.slice(0, 10).map((row) => {
      const chartRow: any = {};
      numericColumns.forEach((col) => {
        chartRow[col] = Number(row[col]);
      });
      return chartRow;
    });
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8">Upload Your Data</h1>

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">File Upload</h2>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed border-primary/20 rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? "bg-primary/5" : ""}`}
          >
            <input {...getInputProps()} />
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground mb-4">
              {isDragActive
                ? "Drop the file here"
                : "Drag and drop your CSV or Excel file here, or click to select"}
            </p>
            <Button>
              <Upload className="mr-2" />
              Select File
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Google Sheets</h2>
          <div className="border-2 border-dashed border-primary/20 rounded-lg p-8 text-center">
            <Table className="w-12 h-12 mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground mb-4">
              Connect your Google Sheets document
            </p>
            <Button variant="outline">Connect Google Sheets</Button>
          </div>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-8">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data.length > 0 && (
        <div className="grid md:grid-cols-2 gap-8">
          <Card className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="table">Table View</TabsTrigger>
                <TabsTrigger value="chart">Chart View</TabsTrigger>
                <TabsTrigger value="stats">Statistics</TabsTrigger>
              </TabsList>

              <TabsContent value="table">
                <div className="overflow-x-auto">
                  <UITable>
                    <TableHeader>
                      <TableRow>
                        {columns.map((column) => (
                          <TableHead key={column}>{column}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.slice(0, 10).map((row, i) => (
                        <TableRow key={i}>
                          {columns.map((column) => (
                            <TableCell key={column}>{row[column]}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </UITable>
                </div>
              </TabsContent>

              <TabsContent value="chart">
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={generateChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey={getNumericColumns()[0]} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {getNumericColumns()
                        .slice(1)
                        .map((col, index) => (
                          <Bar
                            key={col}
                            dataKey={col}
                            fill={`hsl(var(--chart-${(index % 5) + 1}))`}
                          />
                        ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="stats">
                <div className="grid md:grid-cols-2 gap-4">
                  {getNumericColumns().map((col) => {
                    const values = data.map((row) => Number(row[col]));
                    const sum = values.reduce((a, b) => a + b, 0);
                    const avg = sum / values.length;
                    const max = Math.max(...values);
                    const min = Math.min(...values);

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
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Data Assistant</h2>
            <div className="flex flex-col h-[600px]">
              <ScrollArea className="flex-1 mb-4 p-4 border rounded-lg">
                {messages.map((message, index) => (
                  <div
                    key={index}
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
