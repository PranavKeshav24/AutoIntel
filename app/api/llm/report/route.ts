import { NextRequest, NextResponse } from "next/server";
import { DataSet, LLMReportResponse } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { dataset, query, config } = await request.json();

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

    const reportQuery =
      query || "Generate a comprehensive analytical report of this dataset";

    const systemPrompt = `You are a data analyst creating professional reports. Generate a comprehensive HTML report based on the dataset.

Dataset Schema:
${schemaSummary}

Total rows: ${dataset.schema.rowCount}

Sample data:
${JSON.stringify(sampleData, null, 2)}

Create a detailed HTML report that includes:
1. Executive Summary
2. Data Overview (schema, row counts, data types)
3. Key Findings and Insights
4. Statistical Analysis
5. Trends and Patterns
6. Recommendations

Format the response as valid HTML that can be converted to PDF. Use proper semantic HTML with headers, paragraphs, tables, and lists. Make it professional and well-structured.

Return ONLY the HTML content (no markdown code blocks, just pure HTML).`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: reportQuery },
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
    let htmlContent = data.choices[0]?.message?.content || "";

    // Remove markdown code blocks if present
    htmlContent = htmlContent
      .replace(/```html\s*/g, "")
      .replace(/```\s*$/g, "");

    // Wrap in basic HTML structure if not present
    if (!htmlContent.includes("<!DOCTYPE") && !htmlContent.includes("<html")) {
      htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Data Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; padding: 40px; max-width: 900px; margin: 0 auto; }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #3498db; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
    </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
    }

    const result: LLMReportResponse = {
      htmlMarkdown: htmlContent,
      metadata: {
        generatedAt: new Date().toISOString(),
        rowsAnalyzed: dataset.schema.rowCount,
      },
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in LLM report API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
