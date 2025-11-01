"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Send,
  Loader2,
  Sparkles,
  Database,
  Plus,
  Trash2,
  Copy,
  Check,
  Download,
  BarChart3,
  FileText,
} from "lucide-react";
import { VectorService } from "@/lib/vector-service";
import { DatasetIndex, ChatSession, ChatMessage } from "@/lib/types";
import PlotlyRenderer from "@/components/PlotlyRenderer";
import ReactMarkdown from "react-markdown";

export default function MultiSourceChatPage() {
  const [datasets, setDatasets] = useState<DatasetIndex[]>([]);
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(
    null
  );
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visualizations, setVisualizations] = useState<any[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadData = () => {
    // Load indexed datasets
    const indexedDatasets = VectorService.getDatasetIndices();
    setDatasets(indexedDatasets);

    // Load API key
    try {
      const stored = localStorage.getItem("OPENROUTER_API_KEY");
      if (stored) setApiKey(stored);
    } catch {}

    // Load chat sessions
    const chatSessions = VectorService.getChatSessions();
    setSessions(chatSessions);

    // Auto-select all datasets
    setSelectedDatasets(indexedDatasets.map((d) => d.id));
  };

  const handleNewSession = () => {
    if (selectedDatasets.length === 0) {
      alert("Please select at least one dataset");
      return;
    }

    const title = `Chat ${sessions.length + 1}`;
    const newSession = VectorService.createChatSession(title, selectedDatasets);
    setCurrentSession(newSession);
    setMessages([]);
    setSessions([...sessions, newSession]);
  };

  const handleSelectSession = (session: ChatSession) => {
    setCurrentSession(session);
    setMessages(session.messages);
    setSelectedDatasets(session.datasetIds);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !currentSession || !apiKey) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    // Add user message
    const userMsg: Omit<ChatMessage, "id" | "timestamp"> = {
      role: "user",
      content: userMessage,
    };

    setMessages((prev) => [
      ...prev,
      { ...userMsg, id: `temp_${Date.now()}`, timestamp: new Date() },
    ]);
    VectorService.addMessageToSession(currentSession.id, userMsg);

    try {
      // Perform semantic search
      const searchResults = await VectorService.search(
        userMessage,
        selectedDatasets,
        apiKey,
        5
      );

      // Build context
      const context = searchResults
        .map((result, idx) => {
          return `[Source ${idx + 1}: ${result.chunk.metadata.datasetName}]\n${
            result.chunk.text
          }`;
        })
        .join("\n\n");

      // Call LLM with context
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin,
            "X-Title": "AutoIntel Multi-Source Chat",
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-20b:free",
            messages: [
              {
                role: "system",
                content: `You are a helpful data analyst assistant. Answer questions based on the provided context from multiple data sources.

Context from data sources:
${context}

Instructions:
- Answer based on the context provided
- Cite sources when possible (mention dataset names)
- If asked to create visualizations, respond with a JSON object containing Plotly spec
- Be concise and accurate
- If the answer is not in the context, say so`,
              },
              { role: "user", content: userMessage },
            ],
            temperature: 0.7,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      const answer = data.choices[0]?.message?.content || "No response";

      // Check if response contains visualization spec
      const vizMatch = answer.match(/```json\s*([\s\S]*?)```/);
      if (vizMatch) {
        try {
          const vizSpec = JSON.parse(vizMatch[1]);
          if (vizSpec.plotlyData) {
            setVisualizations((prev) => [...prev, vizSpec]);
          }
        } catch {}
      }

      // Add assistant message
      const assistantMsg: Omit<ChatMessage, "id" | "timestamp"> = {
        role: "assistant",
        content: answer,
        sources: searchResults.map((r) => r.chunk.metadata.datasetId),
        contexts: searchResults.map((r) => r.chunk.text.substring(0, 200)),
      };

      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.id.startsWith("temp_"));
        return [
          ...filtered,
          { ...assistantMsg, id: `msg_${Date.now()}`, timestamp: new Date() },
        ];
      });
      VectorService.addMessageToSession(currentSession.id, assistantMsg);

      // Reload session
      const updatedSession = VectorService.getChatSession(currentSession.id);
      if (updatedSession) setCurrentSession(updatedSession);
    } catch (error: any) {
      console.error("Chat error:", error);
      const errorMsg: Omit<ChatMessage, "id" | "timestamp"> = {
        role: "assistant",
        content: `Error: ${error.message}. Please try again.`,
      };
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.id.startsWith("temp_"));
        return [
          ...filtered,
          { ...errorMsg, id: `msg_${Date.now()}`, timestamp: new Date() },
        ];
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleCopyMessage = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (confirm("Delete this chat session?")) {
      VectorService.deleteChatSession(sessionId);
      setSessions(sessions.filter((s) => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }
    }
  };

  const exportSession = () => {
    if (!currentSession) return;

    const content = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}\n`)
      .join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r flex flex-col bg-muted/20">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Multi-Source Chat</h2>
              <p className="text-xs text-muted-foreground">
                Chat with multiple datasets
              </p>
            </div>
          </div>
          <Button
            onClick={handleNewSession}
            className="w-full"
            disabled={selectedDatasets.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chat Session
          </Button>
        </div>

        {/* Available Datasets */}
        <div className="p-4 border-b">
          <h3 className="text-sm font-semibold mb-3 flex items-center justify-between">
            <span>Available Datasets</span>
            <Badge variant="secondary">
              {selectedDatasets.length}/{datasets.length}
            </Badge>
          </h3>
          {datasets.length === 0 ? (
            <div className="text-center py-4">
              <Database className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="text-xs text-muted-foreground">
                No datasets indexed yet. Upload and index a dataset first.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {datasets.map((ds) => (
                  <div
                    key={ds.id}
                    className="flex items-start gap-2 p-2 rounded hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedDatasets((prev) =>
                        prev.includes(ds.id)
                          ? prev.filter((id) => id !== ds.id)
                          : [...prev, ds.id]
                      );
                    }}
                  >
                    <Checkbox
                      checked={selectedDatasets.includes(ds.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {ds.datasetName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {ds.sourceType}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {ds.chunkCount} chunks
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Chat Sessions */}
        <div className="flex-1 p-4 overflow-auto">
          <h3 className="text-sm font-semibold mb-3">Chat History</h3>
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No chat sessions yet. Start a new chat above.
            </p>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group p-3 rounded-lg transition-colors cursor-pointer ${
                    currentSession?.id === session.id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => handleSelectSession(session)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {session.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.messages.length} messages ·{" "}
                        {session.datasetIds.length} sources
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(session.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4 border-t bg-muted/30">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>💡 Select multiple datasets to query across all of them</p>
            <p>🔍 AI uses semantic search to find relevant data</p>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="h-16 border-b flex items-center justify-between px-6 bg-muted/10">
          <div>
            {currentSession ? (
              <div>
                <h2 className="font-semibold">{currentSession.title}</h2>
                <p className="text-xs text-muted-foreground">
                  Active sources:{" "}
                  {currentSession.datasetIds
                    .map((id) => {
                      const ds = datasets.find((d) => d.id === id);
                      return ds?.datasetName;
                    })
                    .filter(Boolean)
                    .join(", ") || "None"}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Select or create a chat session
              </p>
            )}
          </div>
          {currentSession && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportSession}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-6">
          {!currentSession ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-4 bg-primary/10 rounded-full mb-4">
                <Sparkles className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2">
                Multi-Source Intelligence
              </h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Select datasets from the sidebar and start a new chat session to
                query across multiple data sources simultaneously.
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-2xl">
                {[
                  { icon: Database, text: "Connect multiple datasets" },
                  { icon: Sparkles, text: "AI-powered semantic search" },
                  { icon: BarChart3, text: "Generate visualizations" },
                  { icon: FileText, text: "Export conversations" },
                ].map((feature, idx) => (
                  <Card key={idx} className="p-4 text-left">
                    <feature.icon className="h-5 w-5 text-primary mb-2" />
                    <p className="text-sm font-medium">{feature.text}</p>
                  </Card>
                ))}
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Start Your Conversation
              </h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Ask questions about your data. The AI will search across all
                selected sources to provide comprehensive answers.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
                {[
                  "What patterns do you see in the data?",
                  "Compare trends across sources",
                  "Summarize key insights",
                  "Show me correlations",
                ].map((suggestion, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    className="h-auto py-3 px-4 text-left justify-start"
                    onClick={() => setInput(suggestion)}
                  >
                    <span className="text-sm">{suggestion}</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-4xl mx-auto">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-4 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                  )}
                  <Card
                    className={`p-4 max-w-[80%] ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {message.role === "assistant" ? (
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>

                    {/* Sources Used */}
                    {message.sources && message.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border/50">
                        <span className="text-xs text-muted-foreground mr-1">
                          Sources:
                        </span>
                        {message.sources.map((sourceId) => {
                          const ds = datasets.find((d) => d.id === sourceId);
                          return ds ? (
                            <Badge
                              key={sourceId}
                              variant="secondary"
                              className="text-xs"
                            >
                              {ds.datasetName}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}

                    {/* Context Preview */}
                    {message.contexts && message.contexts.length > 0 && (
                      <details className="mt-3 pt-3 border-t border-border/50">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          View retrieved context ({message.contexts.length}{" "}
                          chunks)
                        </summary>
                        <div className="mt-2 space-y-2">
                          {message.contexts.map((ctx, idx) => (
                            <div
                              key={idx}
                              className="text-xs bg-background/50 p-2 rounded border"
                            >
                              {ctx}...
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() =>
                          handleCopyMessage(message.content, message.id)
                        }
                      >
                        {copiedId === message.id ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </Card>
                  {message.role === "user" && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                        U
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Visualizations */}
              {visualizations.length > 0 && (
                <div className="space-y-4">
                  {visualizations.map((viz, idx) => (
                    <PlotlyRenderer
                      key={idx}
                      data={viz.plotlyData}
                      layout={viz.plotlyLayout}
                      config={viz.plotlyConfig}
                      title={viz.title}
                      description={viz.description}
                    />
                  ))}
                </div>
              )}

              {loading && (
                <div className="flex gap-4 justify-start">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <Card className="p-4 bg-muted">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">
                        Searching across {selectedDatasets.length} dataset
                        {selectedDatasets.length !== 1 ? "s" : ""}...
                      </span>
                    </div>
                  </Card>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t p-4 bg-muted/10">
          <div className="max-w-4xl mx-auto">
            {!apiKey && (
              <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-900 dark:text-yellow-200">
                ⚠️ Please set your OpenRouter API key in the upload page
                settings to enable chat.
              </div>
            )}
            {!currentSession && (
              <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-900 dark:text-blue-200">
                💡 Create a new chat session to start asking questions about
                your data.
              </div>
            )}
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  !currentSession
                    ? "Create a chat session first..."
                    : selectedDatasets.length === 0
                    ? "Select at least one dataset..."
                    : "Ask a question across all selected datasets..."
                }
                disabled={
                  loading ||
                  !currentSession ||
                  selectedDatasets.length === 0 ||
                  !apiKey
                }
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={
                  !input.trim() ||
                  loading ||
                  !currentSession ||
                  selectedDatasets.length === 0 ||
                  !apiKey
                }
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send • Shift + Enter for new line • AI searches
              across all selected sources
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
