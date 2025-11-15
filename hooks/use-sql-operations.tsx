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

    let data = await response.json();

    // Extract the HTML report directly from the response
    let reportHtml = data.report || "";

    // Extract body content if it exists
    const bodyMatch = reportHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    let bodyContent = bodyMatch ? bodyMatch[1] : reportHtml;

    // Add metadata section at the top
    const metadata = data.metadata || {};
    const metadataHtml = `
<div class="metadata" style="background: #f0f4f8; padding: 1rem; border-left: 4px solid #3498db; margin-bottom: 2rem; font-size: 0.9rem;">
  <strong>Summary:</strong> ${data.summary || "N/A"}<br>
  <strong>Rows Analyzed:</strong> ${metadata.rowsAnalyzed || "N/A"} | 
  <strong>Generated:</strong> ${
    metadata.generatedAt
      ? new Date(metadata.generatedAt).toLocaleString()
      : "N/A"
  }
</div>`;

    // Build the complete HTML
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
.metadata {background: #f0f4f8; padding: 1rem; border-left: 4px solid #3498db; margin-bottom: 1.5rem; font-size: 0.9rem;}
.metadata strong {color: #2c3e50;}
footer {text-align: center; margin-top: 3rem; padding: 2rem; background: #f8f9fa; border-top: 2px solid #dee2e6;}
@media print {
  body {margin: 0;}
}
</style>
</head>
<body>
<div style="text-align: center; margin-bottom: 2rem;">
<h1 style="color: #2c3e50; margin-bottom: 0.5rem;">Comprehensive Database Analysis Report</h1>
<p style="color: #7f8c8d;">Generated on: ${new Date().toLocaleString()}</p>
</div>
<hr style="border: 0; height: 2px; background: linear-gradient(90deg, transparent, #3498db, transparent); margin-bottom: 2rem;">
${metadataHtml}
${bodyContent}
<footer>
<p style="margin: 0; font-weight: bold; color: #2c3e50;">Database Analysis Report</p>
<p style="margin: 0.5rem 0 0 0; color: #7f8c8d;">Report generated successfully</p>
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
