import { useState, useEffect, useCallback } from "react";

interface DashboardData {
  datasets: any[];
  analyses: any[];
  visualizations: any[];
  lastUpdated: Date;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>({
    datasets: [],
    analyses: [],
    visualizations: [],
    lastUpdated: new Date(),
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(() => {
    try {
      // Load from localStorage
      const datasets = JSON.parse(
        localStorage.getItem("uploaded_datasets") || "[]"
      );
      const analyses = JSON.parse(
        localStorage.getItem("completed_analyses") || "[]"
      );
      const visualizations = JSON.parse(
        localStorage.getItem("created_visualizations") || "[]"
      );

      setData({
        datasets,
        analyses,
        visualizations,
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveDataset = useCallback(
    (dataset: any) => {
      try {
        const existing = JSON.parse(
          localStorage.getItem("uploaded_datasets") || "[]"
        );
        const updated = [
          ...existing,
          { ...dataset, uploadedAt: new Date().toISOString() },
        ];
        localStorage.setItem("uploaded_datasets", JSON.stringify(updated));
        loadData();
      } catch (error) {
        console.error("Error saving dataset:", error);
      }
    },
    [loadData]
  );

  const saveAnalysis = useCallback(
    (analysis: any) => {
      try {
        const existing = JSON.parse(
          localStorage.getItem("completed_analyses") || "[]"
        );
        const updated = [
          ...existing,
          { ...analysis, completedAt: new Date().toISOString() },
        ];
        localStorage.setItem("completed_analyses", JSON.stringify(updated));
        loadData();
      } catch (error) {
        console.error("Error saving analysis:", error);
      }
    },
    [loadData]
  );

  const saveVisualization = useCallback(
    (viz: any) => {
      try {
        const existing = JSON.parse(
          localStorage.getItem("created_visualizations") || "[]"
        );
        const updated = [
          ...existing,
          { ...viz, createdAt: new Date().toISOString() },
        ];
        localStorage.setItem("created_visualizations", JSON.stringify(updated));
        loadData();
      } catch (error) {
        console.error("Error saving visualization:", error);
      }
    },
    [loadData]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    isLoading,
    loadData,
    saveDataset,
    saveAnalysis,
    saveVisualization,
  };
}
