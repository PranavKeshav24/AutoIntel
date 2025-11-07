// hooks/useSQLOperations.ts
import { VisualizationSpec } from "@/lib/types";

export const useSQLOperations = (dbType: string) => {
  const fetchSQLData = async (question: string) => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Authentication required");
    }

    let endpoint = "";
    switch (dbType) {
      case "postgresql":
        endpoint = `${process.env.NEXT_PUBLIC_API_BASE_URL}/postgresql`;
        break;
      case "sqlite":
        endpoint = `${process.env.NEXT_PUBLIC_API_BASE_URL}/sqlite`;
        break;
      case "mysql":
        endpoint = `${process.env.NEXT_PUBLIC_API_BASE_URL}/mysql`;
        break;
      default:
        throw new Error("Invalid database type");
    }

    const response = await fetch(
      `${endpoint}?question=${encodeURIComponent(question)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to fetch data");
    }

    return await response.json();
  };

  const requestSQLVisualizations = async (question?: string) => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Authentication required");
    }

    let endpoint = "";
    switch (dbType) {
      case "postgresql":
        endpoint = question
          ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/postgresql/visualization`
          : `${process.env.NEXT_PUBLIC_API_BASE_URL}/postgresql/visualization/suggest`;
        break;
      case "sqlite":
        endpoint = question
          ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/sqlite/visualization`
          : `${process.env.NEXT_PUBLIC_API_BASE_URL}/sqlite/visualization/suggest`;
        break;
      case "mysql":
        endpoint = question
          ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/mysql/visualization`
          : `${process.env.NEXT_PUBLIC_API_BASE_URL}/mysql/visualization/suggest`;
        break;
      default:
        throw new Error("Invalid database type");
    }

    const url = question
      ? `${endpoint}?question=${encodeURIComponent(question)}`
      : endpoint;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to generate visualizations");
    }

    const data = await response.json();

    const allVizs: VisualizationSpec[] = [];

    if (data.visualizations && typeof data.visualizations === "object") {
      Object.entries(data.visualizations).forEach(
        ([tableName, tableData]: [string, any]) => {
          if (
            tableData.visualizations &&
            Array.isArray(tableData.visualizations)
          ) {
            tableData.visualizations.forEach((viz: any) => {
              allVizs.push({
                ...viz,
                title: `[${tableName}] ${viz.title}`,
                tableName: tableName,
              });
            });
          }
        }
      );
    } else if (data.data && data.layout) {
      allVizs.push({
        id: `viz-${Date.now()}`,
        title: data.layout.title?.text || "Generated Visualization",
        description: "Visualization generated from your query",
        plotlyData: data.data,
        plotlyLayout: data.layout,
        plotlyConfig: { responsive: true },
      });
    } else if (Array.isArray(data)) {
      allVizs.push(...data);
    }

    return allVizs;
  };

  const generateSQLReport = async (question?: string) => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Authentication required");
    }

    let endpoint = "";
    switch (dbType) {
      case "postgresql":
        endpoint = `${process.env.NEXT_PUBLIC_API_BASE_URL}/postgresql/report`;
        break;
      case "sqlite":
        endpoint = `${process.env.NEXT_PUBLIC_API_BASE_URL}/sqlite/report`;
        break;
      case "mysql":
        endpoint = `${process.env.NEXT_PUBLIC_API_BASE_URL}/mysql/report`;
        break;
      default:
        throw new Error("Invalid database type");
    }

    const url = question
      ? `${endpoint}?question=${encodeURIComponent(question)}`
      : endpoint;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to generate report");
    }

    const data = await response.json();

    let combinedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Database Analysis Report</title>
<style>
body {font-family: Arial, sans-serif; margin: 2rem; line-height: 1.6; color: #333;}
h1, h2, h3 {color: #2c3e50;}
table {width: 100%; border-collapse: collapse; margin-bottom: 1rem;}
th, td {border: 1px solid #ddd; padding: 0.75rem; text-align: left;}
th {background-color: #f2f2f2;}
.table-section {margin-bottom: 4rem; page-break-after: always; border: 2px solid #e0e0e0; padding: 2rem; border-radius: 8px; background: #fafafa;}
.table-header {background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; margin: -2rem -2rem 2rem -2rem; border-radius: 6px 6px 0 0;}
.table-header h2 {color: white; margin: 0; font-size: 1.5rem;}
.metadata {background: #f0f4f8; padding: 1rem; border-left: 4px solid #3498db; margin-bottom: 1.5rem; font-size: 0.9rem;}
.metadata strong {color: #2c3e50;}
footer {text-align: center; margin-top: 3rem; padding: 2rem; background: #f8f9fa; border-top: 2px solid #dee2e6;}
@media print {
  .table-section {page-break-after: always;}
  body {margin: 0;}
}
</style>
</head>
<body>
<h1 style="text-align: center; color: #2c3e50; margin-bottom: 0.5rem;">Comprehensive Database Analysis Report</h1>
<p style="text-align: center; color: #7f8c8d; margin-bottom: 2rem;">Generated on: ${new Date().toLocaleString()}</p>
<hr style="border: 0; height: 2px; background: linear-gradient(90deg, transparent, #3498db, transparent); margin-bottom: 3rem;">
`;

    let tableCount = 0;
    Object.entries(data).forEach(([tableName, tableData]: [string, any]) => {
      if (tableData.htmlMarkdown) {
        tableCount++;
        let bodyContent = tableData.htmlMarkdown;
        const bodyMatch = bodyContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        if (bodyMatch) {
          bodyContent = bodyMatch[1];
        }

        bodyContent = bodyContent.replace(/<h1[^>]*>.*?<\/h1>/gi, "");

        const metadata = tableData.metadata || {};
        const metadataHtml = `
<div class="metadata">
  <strong>Table:</strong> ${tableName} | 
  <strong>Rows Analyzed:</strong> ${metadata.rowsAnalyzed || "N/A"} | 
  <strong>Generated:</strong> ${
    metadata.generatedAt
      ? new Date(metadata.generatedAt).toLocaleString()
      : "N/A"
  }
</div>`;

        combinedHtml += `
<div class="table-section">
<div class="table-header">
<h2>📊 Table ${tableCount}: ${tableName}</h2>
</div>
${metadataHtml}
${bodyContent}
</div>
`;
      }
    });

    combinedHtml += `
<footer>
<p style="margin: 0; font-weight: bold; color: #2c3e50;">Database Analysis Report</p>
<p style="margin: 0.5rem 0 0 0; color: #7f8c8d;">Total Tables Analyzed: ${tableCount}</p>
</footer>
</body>
</html>`;

    return combinedHtml;
  };

  return {
    fetchSQLData,
    requestSQLVisualizations,
    generateSQLReport,
  };
};
