// components/ChatAssistant.tsx
import React, { useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Download } from "lucide-react";
import { Message } from "@/lib/types";
import { SQLResultDisplay } from "./SQLResultDisplay";

type ChatAssistantProps = {
  messages: Message[];
  input: string;
  loading: boolean;
  downloadLoading: boolean;
  selectedVizCount: number;
  isSQLSource: boolean;
  isTextSource?: boolean;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onDownloadReport: (html: string, format: "html" | "pdf") => void;
};

export const ChatAssistant: React.FC<ChatAssistantProps> = ({
  messages,
  input,
  loading,
  downloadLoading,
  selectedVizCount,
  isSQLSource,
  isTextSource,
  onInputChange,
  onSendMessage,
  onDownloadReport,
}) => {
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Card className="p-6 sticky top-4">
      <h2 className="text-xl font-semibold mb-4">AI Assistant</h2>
      {selectedVizCount > 0 && (
        <div className="mb-4 p-3 bg-primary/10 rounded-lg">
          <p className="text-sm font-medium">
            📊 {selectedVizCount} visualization
            {selectedVizCount > 1 ? "s" : ""} selected
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
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

              {/* SQL Result Display */}
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
