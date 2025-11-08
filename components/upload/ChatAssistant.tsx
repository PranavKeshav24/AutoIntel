import React, { useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Download, Presentation, FileText } from "lucide-react";
import { Message } from "@/lib/types";
import { SQLResultDisplay } from "./SQLResultDisplay";

type ChatAssistantProps = {
  messages: Message[];
  input: string;
  loading: boolean;
  downloadLoading: boolean;
  selectedVizCount: number;
  selectedReportCount: number;
  reports: Array<{ id: string; title: string; content: string; html: string }>;
  isSQLSource: boolean;
  storyLoading?: boolean;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onDownloadReport: (html: string, format: "html" | "pdf") => void;
  onGenerateStory?: () => void;
  onToggleReportSelection: (reportId: string) => void;
  selectedReportIds: Set<string>;
};

export const ChatAssistant: React.FC<ChatAssistantProps> = ({
  messages,
  input,
  loading,
  downloadLoading,
  selectedVizCount,
  selectedReportCount,
  reports,
  isSQLSource,
  storyLoading = false,
  onInputChange,
  onSendMessage,
  onDownloadReport,
  onGenerateStory,
  onToggleReportSelection,
  selectedReportIds,
}) => {
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const totalSelected = selectedVizCount + selectedReportCount;

  return (
    <Card className="p-6 sticky top-4">
      <h2 className="text-xl font-semibold mb-4">AI Assistant</h2>

      {/* Selection Summary */}
      {totalSelected > 0 && (
        <div className="mb-4 space-y-2">
          <div className="mb-4 p-3 bg-primary/10 rounded-lg">
            <p className="text-sm font-medium">
              📊 {selectedVizCount} visualization
              {selectedVizCount !== 1 ? "s" : ""}
              {selectedReportCount > 0 &&
                ` • 📄 ${selectedReportCount} report${
                  selectedReportCount !== 1 ? "s" : ""
                }`}{" "}
              selected
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              These will be included in your story presentation
            </p>
          </div>

          {onGenerateStory && (
            <Button
              onClick={onGenerateStory}
              disabled={storyLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              size="lg"
            >
              {storyLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Story...
                </>
              ) : (
                <>
                  <Presentation className="h-4 w-4 mr-2" />
                  Generate Story Presentation
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Report Selection */}
      {reports.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Generated Reports
          </h3>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {reports.map((report) => (
              <div
                key={report.id}
                onClick={() => onToggleReportSelection(report.id)}
                className={`p-2 rounded-lg cursor-pointer transition-all ${
                  selectedReportIds.has(report.id)
                    ? "bg-blue-100 border-2 border-blue-500"
                    : "bg-slate-50 border-2 border-transparent hover:border-slate-300"
                }`}
              >
                <div className="flex items-start gap-2">
                  <div
                    className={`w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center ${
                      selectedReportIds.has(report.id)
                        ? "bg-blue-600 border-blue-600"
                        : "border-slate-300"
                    }`}
                  >
                    {selectedReportIds.has(report.id) && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">
                      {report.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {report.content.substring(0, 50)}...
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex flex-col h-[600px]">
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
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

              {msg.sqlData && <SQLResultDisplay sqlData={msg.sqlData} />}

              {/* Report Download Buttons */}
              {msg.html && (
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => onDownloadReport(msg.html!, "pdf")}
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
                    onClick={() => onDownloadReport(msg.html!, "html")}
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
              {isSQLSource ? "Querying database..." : "Analyzing your data..."}
            </div>
          )}
          <div ref={chatEndRef} />
        </ScrollArea>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !loading && onSendMessage()}
            placeholder={
              isSQLSource
                ? "Ask a question about your database..."
                : "Ask about your data..."
            }
            disabled={loading}
          />
          <Button onClick={onSendMessage} disabled={loading} size="icon">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};
