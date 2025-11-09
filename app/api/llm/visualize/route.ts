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

    const systemPrompt = `You are a data visualization expert. Analyze this dataset and suggest 6-9 relevant visualizations.

Dataset Schema:
${schemaSummary}

Total rows: ${dataset.schema.rowCount}

Sample data:
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
        content: "Suggest the best 4 visualizations for this dataset",
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
          model: config.model || "openai/gpt-oss-20b:free",
          messages,
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
    const jsonMatch =
      content.match(/```json\s*([\s\S]*?)```/) ||
      content.match(/```\s*([\s\S]*?)```/) ||
      content.match(/\[[\s\S]*\]/);

    let visualizations: VisualizationSpec[] = [];
    try {
      visualizations = JSON.parse(
        jsonMatch ? jsonMatch[1] || jsonMatch[0] : content
      );
    } catch (e) {
      console.error("Failed to parse visualizations:", e);
      visualizations = [];
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
