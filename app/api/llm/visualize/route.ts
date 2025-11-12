import { NextRequest, NextResponse } from "next/server";
import { DataSet, VisualizationSpec } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { dataset, config } = await request.json();

    if (!dataset || !config?.apiKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const schemaSummary = dataset.schema.fields
      .map((f: any) => `- ${f.name} (${f.type})`)
      .join("\n");

    const sampleData = dataset.schema.sampleRows || dataset.rows.slice(0, 10);

    const systemPrompt = `You are a data visualization expert. Analyze this dataset and suggest 4 diverse visualizations using Plotly.

Dataset Schema:
${schemaSummary}

Total rows: ${dataset.schema.rowCount}

Sample data (first 10 rows):
${JSON.stringify(sampleData, null, 2)}

Create 6-10 diverse visualizations (bar, line, scatter, pie, box, histogram, etc.) that best represent the data patterns.

Respond with a JSON array of visualization specs. Each spec should have:
{
  "id": "unique-id",
  "title": "Chart Title",
  "description": "What this chart shows",
  "plotlyData": [
    {
      "x": [...],
      "y": [...],
      "type": "bar|scatter|line|pie|box|histogram|heatmap",
      "mode": "lines|markers|lines+markers",
      "name": "Series Name",
      "marker": { "color": "blue" }
    }
  ],
  "plotlyLayout": {
    "xaxis": { "title": "X Axis Label" },
    "yaxis": { "title": "Y Axis Label" },
    "title": "Chart Title"
  }
}

IMPORTANT: 
- Include actual data values in the plotlyData arrays, not empty arrays
- Use the actual column names from the schema
- Choose appropriate chart types for the data
- For categorical data, use bar or pie charts
- For time series, use line charts
- For distributions, use histograms or box plots
- Keep the data arrays reasonable (sample if needed)

Return ONLY a JSON array, no markdown formatting.`;

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: "Suggest the best 6-10 visualizations for this dataset",
      },
    ];

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": config.referer || "https://your-app.com",
          "X-Title": config.title || "Data Analysis App",
        },
        body: JSON.stringify({
          model: config.model || "meta-llama/llama-4-maverick:free",
          messages,
          temperature: 0.7,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";

    // Extract JSON array
    let visualizations: VisualizationSpec[] = [];
    try {
      // Try to parse as JSON directly
      const jsonMatch =
        content.match(/```json\s*([\s\S]*?)```/) ||
        content.match(/```\s*([\s\S]*?)```/) ||
        content.match(/\[[\s\S]*\]/);

      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
      visualizations = JSON.parse(jsonStr);

      // Validate and ensure proper structure
      visualizations = visualizations.map((viz: any, idx: number) => ({
        id: viz.id || `viz-${idx + 1}`,
        title: viz.title || `Visualization ${idx + 1}`,
        description: viz.description || "",
        plotlyData: viz.plotlyData || [],
        plotlyLayout: viz.plotlyLayout || {},
        plotlyConfig: viz.plotlyConfig || {},
      }));

      // If no visualizations were generated, create defaults
      if (visualizations.length === 0) {
        visualizations = createDefaultVisualizations(dataset);
      }
    } catch (e) {
      console.error("Failed to parse visualizations:", e);
      // Fall back to default visualizations
      visualizations = createDefaultVisualizations(dataset);
    }

    return NextResponse.json({ visualizations });
  } catch (error: any) {
    console.error("Error in LLM visualize API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to create default visualizations
function createDefaultVisualizations(dataset: DataSet): VisualizationSpec[] {
  const visualizations: VisualizationSpec[] = [];
  const fields = dataset.schema.fields;
  const rows = dataset.rows.slice(0, 50); // Use first 50 rows

  // Find numeric and categorical columns
  const numericCols = fields.filter((f: any) => f.type === "number");
  const categoricalCols = fields.filter((f: any) => f.type === "string");
  const dateCols = fields.filter((f: any) => f.type === "date");

  // 1. Bar chart - first categorical vs first numeric
  if (categoricalCols.length > 0 && numericCols.length > 0) {
    const catCol = categoricalCols[0].name;
    const numCol = numericCols[0].name;

    const grouped: Record<string, number> = {};
    rows.forEach((row: any) => {
      const cat = String(row[catCol] || "Unknown");
      const val = Number(row[numCol]) || 0;
      grouped[cat] = (grouped[cat] || 0) + val;
    });

    visualizations.push({
      id: "viz-1",
      title: `${numCol} by ${catCol}`,
      description: `Bar chart showing ${numCol} aggregated by ${catCol}`,
      plotlyData: [
        {
          x: Object.keys(grouped),
          y: Object.values(grouped),
          type: "bar",
          marker: { color: "#3b82f6" },
        },
      ],
      plotlyLayout: {
        xaxis: { title: catCol },
        yaxis: { title: numCol },
      },
    });
  }

  // 2. Line chart - time series or first two numerics
  if (dateCols.length > 0 && numericCols.length > 0) {
    const dateCol = dateCols[0].name;
    const numCol = numericCols[0].name;

    visualizations.push({
      id: "viz-2",
      title: `${numCol} over Time`,
      description: `Time series of ${numCol}`,
      plotlyData: [
        {
          x: rows.map((r: any) => r[dateCol]),
          y: rows.map((r: any) => Number(r[numCol]) || 0),
          type: "scatter",
          mode: "lines+markers",
          marker: { color: "#10b981" },
        },
      ],
      plotlyLayout: {
        xaxis: { title: dateCol },
        yaxis: { title: numCol },
      },
    });
  } else if (numericCols.length >= 2) {
    const col1 = numericCols[0].name;
    const col2 = numericCols[1].name;

    visualizations.push({
      id: "viz-2",
      title: `${col1} vs ${col2}`,
      description: `Scatter plot of ${col1} vs ${col2}`,
      plotlyData: [
        {
          x: rows.map((r: any) => Number(r[col1]) || 0),
          y: rows.map((r: any) => Number(r[col2]) || 0),
          type: "scatter",
          mode: "markers",
          marker: { color: "#10b981", size: 8 },
        },
      ],
      plotlyLayout: {
        xaxis: { title: col1 },
        yaxis: { title: col2 },
      },
    });
  }

  // 3. Histogram - first numeric column
  if (numericCols.length > 0) {
    const numCol = numericCols[0].name;

    visualizations.push({
      id: "viz-3",
      title: `Distribution of ${numCol}`,
      description: `Histogram showing the distribution of ${numCol}`,
      plotlyData: [
        {
          x: rows.map((r: any) => Number(r[numCol]) || 0),
          type: "histogram",
          marker: { color: "#f59e0b" },
        },
      ],
      plotlyLayout: {
        xaxis: { title: numCol },
        yaxis: { title: "Frequency" },
      },
    });
  }

  // 4. Pie chart - first categorical column count
  if (categoricalCols.length > 0) {
    const catCol = categoricalCols[0].name;

    const counts: Record<string, number> = {};
    rows.forEach((row: any) => {
      const cat = String(row[catCol] || "Unknown");
      counts[cat] = (counts[cat] || 0) + 1;
    });

    visualizations.push({
      id: "viz-4",
      title: `Distribution of ${catCol}`,
      description: `Pie chart showing the distribution of ${catCol}`,
      plotlyData: [
        {
          labels: Object.keys(counts),
          values: Object.values(counts),
          type: "pie",
        },
      ],
      plotlyLayout: {},
    });
  }

  return visualizations;
}
