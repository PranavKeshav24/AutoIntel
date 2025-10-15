"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Database,
  Activity,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
  LineChart,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import PlotlyRenderer from "@/components/PlotlyRenderer";
import { DataSet } from "@/lib/types";

interface DashboardStats {
  totalDatasets: number;
  totalRows: number;
  totalAnalyses: number;
  totalVisualizations: number;
  avgProcessingTime: number;
  successRate: number;
  recentActivity: Activity[];
  dataGrowth: number;
  activeConnections: number;
}

interface Activity {
  id: string;
  type: "upload" | "analysis" | "visualization" | "export";
  description: string;
  timestamp: Date;
  status: "success" | "failed" | "pending";
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalDatasets: 24,
    totalRows: 125430,
    totalAnalyses: 89,
    totalVisualizations: 156,
    avgProcessingTime: 2.4,
    successRate: 97.8,
    recentActivity: [],
    dataGrowth: 23.5,
    activeConnections: 5,
  });

  const [selectedPeriod, setSelectedPeriod] = useState<
    "24h" | "7d" | "30d" | "all"
  >("7d");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [datasets, setDatasets] = useState<any[]>([]);

  useEffect(() => {
    // Load datasets from localStorage or API
    loadDashboardData();

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadDashboardData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = () => {
    try {
      // Load from localStorage
      const stored = localStorage.getItem("dashboard_data");
      if (stored) {
        const data = JSON.parse(stored);
        setStats(data.stats || stats);
        setDatasets(data.datasets || []);
      }

      // Generate activity feed
      generateActivityFeed();
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  };

  const generateActivityFeed = () => {
    const activities: Activity[] = [
      {
        id: "1",
        type: "upload",
        description: "Sales_Data_2024.csv uploaded",
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        status: "success",
      },
      {
        id: "2",
        type: "analysis",
        description: "Customer segmentation analysis completed",
        timestamp: new Date(Date.now() - 1000 * 60 * 15),
        status: "success",
      },
      {
        id: "3",
        type: "visualization",
        description: "4 charts generated for revenue data",
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        status: "success",
      },
      {
        id: "4",
        type: "export",
        description: "Monthly report exported as PDF",
        timestamp: new Date(Date.now() - 1000 * 60 * 45),
        status: "success",
      },
      {
        id: "5",
        type: "upload",
        description: "Employee_Performance.xlsx uploaded",
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
        status: "success",
      },
    ];

    setStats((prev) => ({ ...prev, recentActivity: activities }));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    loadDashboardData();
    setIsRefreshing(false);
  };

  const StatCard = ({
    title,
    value,
    change,
    icon: Icon,
    trend,
  }: {
    title: string;
    value: string | number;
    change?: string;
    icon: any;
    trend?: "up" | "down";
  }) => (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <h3 className="text-3xl font-bold mb-2">{value}</h3>
          {change && (
            <div className="flex items-center gap-1">
              {trend === "up" ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              )}
              <span
                className={`text-sm font-medium ${
                  trend === "up" ? "text-green-500" : "text-red-500"
                }`}
              >
                {change}
              </span>
              <span className="text-sm text-muted-foreground">
                vs last period
              </span>
            </div>
          )}
        </div>
        <div className="p-3 bg-primary/10 rounded-lg">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </Card>
  );

  // Generate sample data for visualizations
  const activityTimelineData = [
    {
      x: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      y: [12, 19, 15, 25, 22, 18, 20],
      type: "scatter",
      mode: "lines+markers",
      name: "Uploads",
      line: { color: "#3b82f6", width: 3 },
      marker: { size: 8 },
    },
    {
      x: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      y: [8, 12, 10, 18, 15, 12, 14],
      type: "scatter",
      mode: "lines+markers",
      name: "Analyses",
      line: { color: "#10b981", width: 3 },
      marker: { size: 8 },
    },
  ];

  const dataSourcesData = [
    {
      labels: ["CSV", "Excel", "Google Sheets", "JSON", "Databases", "APIs"],
      values: [35, 25, 15, 10, 10, 5],
      type: "pie",
      hole: 0.4,
      marker: {
        colors: [
          "#3b82f6",
          "#10b981",
          "#f59e0b",
          "#ef4444",
          "#8b5cf6",
          "#ec4899",
        ],
      },
    },
  ];

  const processingTimeData = [
    {
      x: ["Upload", "Parse", "Clean", "Analyze", "Visualize"],
      y: [0.5, 1.2, 0.8, 2.1, 1.5],
      type: "bar",
      marker: {
        color: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"],
      },
    },
  ];

  const dataGrowthData = [
    {
      x: Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`),
      y: Array.from({ length: 30 }, (_, i) =>
        Math.floor(1000 + i * 150 + Math.random() * 500)
      ),
      type: "scatter",
      mode: "lines",
      fill: "tozeroy",
      line: { color: "#3b82f6", width: 2 },
      fillcolor: "rgba(59, 130, 246, 0.1)",
    },
  ];

  return (
    <div className="container mx-auto px-6 md:px-12 py-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time insights into your data analysis activities
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Period Filter */}
      <div className="flex gap-2 mb-6">
        {(["24h", "7d", "30d", "all"] as const).map((period) => (
          <Button
            key={period}
            variant={selectedPeriod === period ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedPeriod(period)}
          >
            {period === "24h" && "Last 24 Hours"}
            {period === "7d" && "Last 7 Days"}
            {period === "30d" && "Last 30 Days"}
            {period === "all" && "All Time"}
          </Button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Datasets"
          value={stats.totalDatasets}
          change="+12.5%"
          icon={Database}
          trend="up"
        />
        <StatCard
          title="Total Rows Processed"
          value={stats.totalRows.toLocaleString()}
          change="+23.5%"
          icon={FileText}
          trend="up"
        />
        <StatCard
          title="Analyses Completed"
          value={stats.totalAnalyses}
          change="+8.2%"
          icon={Activity}
          trend="up"
        />
        <StatCard
          title="Visualizations Created"
          value={stats.totalVisualizations}
          change="+15.7%"
          icon={BarChart3}
          trend="up"
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Avg Processing Time</h3>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-3xl font-bold mb-2">
            {stats.avgProcessingTime}s
          </div>
          <div className="flex items-center gap-1 text-sm">
            <TrendingDown className="h-4 w-4 text-green-500" />
            <span className="text-green-500">-12%</span>
            <span className="text-muted-foreground">faster than average</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Success Rate</h3>
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-3xl font-bold mb-2">{stats.successRate}%</div>
          <div className="flex items-center gap-1 text-sm">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-green-500">+2.1%</span>
            <span className="text-muted-foreground">improvement</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Active Connections</h3>
            <Zap className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-3xl font-bold mb-2">
            {stats.activeConnections}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="secondary">CSV</Badge>
            <Badge variant="secondary">Excel</Badge>
            <Badge variant="secondary">Sheets</Badge>
            <Badge variant="secondary">Reddit</Badge>
            <Badge variant="secondary">JSON</Badge>
          </div>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="sources">Data Sources</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PlotlyRenderer
              data={activityTimelineData}
              layout={{
                title: "Weekly Activity Trends",
                xaxis: { title: "Day of Week" },
                yaxis: { title: "Count" },
                showlegend: true,
                legend: { x: 0, y: 1.1, orientation: "h" },
              }}
              title="Activity Timeline"
              description="Upload and analysis trends over the past week"
              className="border-2 border-gray-200 rounded-lg"
            />

            <PlotlyRenderer
              data={dataGrowthData}
              layout={{
                title: "Data Growth Trend",
                xaxis: { title: "Timeline" },
                yaxis: { title: "Total Rows" },
              }}
              title="Data Volume"
              description="Cumulative data processed over the last 30 days"
              className="border-2 border-gray-200 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PlotlyRenderer
              data={dataSourcesData}
              layout={{
                title: "Data Source Distribution",
              }}
              title="Source Breakdown"
              description="Distribution of data sources used"
              className="border-2 border-gray-200 rounded-lg"
            />

            <PlotlyRenderer
              data={processingTimeData}
              layout={{
                title: "Average Processing Time by Stage",
                xaxis: { title: "Stage" },
                yaxis: { title: "Time (seconds)" },
              }}
              title="Pipeline Performance"
              description="Time spent in each processing stage"
              className="border-2 border-gray-200 rounded-lg"
            />
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {stats.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="p-2 rounded-lg bg-primary/10">
                    {activity.type === "upload" && (
                      <Database className="h-5 w-5 text-primary" />
                    )}
                    {activity.type === "analysis" && (
                      <Activity className="h-5 w-5 text-primary" />
                    )}
                    {activity.type === "visualization" && (
                      <BarChart3 className="h-5 w-5 text-primary" />
                    )}
                    {activity.type === "export" && (
                      <Download className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{activity.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatTimeAgo(activity.timestamp)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      activity.status === "success"
                        ? "default"
                        : activity.status === "failed"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {activity.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">System Health</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">API Response Time</span>
                    <span className="text-sm font-medium">245ms</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full w-[75%] bg-green-500" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Memory Usage</span>
                    <span className="text-sm font-medium">62%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full w-[62%] bg-blue-500" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">CPU Load</span>
                    <span className="text-sm font-medium">38%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full w-[38%] bg-yellow-500" />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Error Log</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded border border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900">
                      Rate limit warning
                    </p>
                    <p className="text-xs text-yellow-700">
                      OpenRouter API - 2 hours ago
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded border border-red-200 bg-red-50">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-900">
                      Failed to load sheet
                    </p>
                    <p className="text-xs text-red-700">
                      Invalid permissions - 5 hours ago
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="sources" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                name: "CSV Files",
                count: 12,
                icon: FileText,
                color: "bg-blue-500",
              },
              {
                name: "Excel Files",
                count: 8,
                icon: FileText,
                color: "bg-green-500",
              },
              {
                name: "Google Sheets",
                count: 5,
                icon: LineChart,
                color: "bg-yellow-500",
              },
              {
                name: "JSON Files",
                count: 4,
                icon: FileText,
                color: "bg-red-500",
              },
              {
                name: "Databases",
                count: 3,
                icon: Database,
                color: "bg-purple-500",
              },
              { name: "APIs", count: 2, icon: Zap, color: "bg-pink-500" },
            ].map((source) => (
              <Card key={source.name} className="p-6">
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-lg ${source.color} bg-opacity-10`}
                  >
                    <source.icon
                      className={`h-6 w-6 ${source.color.replace(
                        "bg-",
                        "text-"
                      )}`}
                    />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {source.name}
                    </p>
                    <p className="text-2xl font-bold">{source.count}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds} seconds ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}
