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
      query ||
      "Generate a detailed, comprehensive analytical report of this dataset";

    const systemPrompt = `You are a data analyst creating professional reports. Generate a comprehensive HTML report based on the dataset.

Dataset Schema:
${schemaSummary}

Total rows: ${dataset.schema.rowCount}

Sample data:
${JSON.stringify(sampleData, null, 2)}

Create a very detailed beautiful HTML report that includes:
1. Executive Summary
2. Data Overview (schema, row counts, data types)
3. Key Findings and Insights
4. Statistical Analysis
5. Trends and Patterns
6. Recommendations
7. Interactive charts and visualizations using Chart.js to summarize the dataset, with observations and inferences drawn
8. Watermark the HTML with the name AutoIntel and the time of generation

CRITICAL CHART RENDERING INSTRUCTIONS:
- For PDF compatibility, wrap ALL chart initialization code in a DOMContentLoaded event listener
- Each chart MUST have a unique ID
- Place all chart scripts at the END of the body, just before </body>
- Use this exact pattern for EVERY chart:

<div class="chart-container" style="position: relative; height: 400px; margin: 30px 0;">
  <canvas id="uniqueChartId"></canvas>
</div>

And at the end of the document, inside a single script tag:
<script>
document.addEventListener('DOMContentLoaded', function() {
  // Wait for Chart.js to load
  if (typeof Chart !== 'undefined') {
    const ctx1 = document.getElementById('uniqueChartId').getContext('2d');
    new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: ['Label1', 'Label2'],
        datasets: [{
          label: 'Dataset Label',
          data: [12, 19],
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
          title: { display: true, text: 'Chart Title' }
        }
      }
    });
    
    // More charts follow the same pattern
  }
});
</script>

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
      const currentDate = new Date().toLocaleString();
      htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Data Analysis Report - AutoIntel</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            padding: 40px; 
            max-width: 1200px; 
            margin: 0 auto; 
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { 
            color: #2c3e50; 
            border-bottom: 3px solid #3498db; 
            padding-bottom: 10px; 
            margin-bottom: 30px;
        }
        h2 { 
            color: #34495e; 
            margin-top: 40px; 
            margin-bottom: 20px;
            border-left: 4px solid #3498db;
            padding-left: 15px;
        }
        h3 {
            color: #555;
            margin-top: 25px;
            margin-bottom: 15px;
        }
        table { 
            border-collapse: collapse; 
            width: 100%; 
            margin: 20px 0; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        th, td { 
            border: 1px solid #ddd; 
            padding: 12px; 
            text-align: left; 
        }
        th { 
            background-color: #3498db; 
            color: white; 
            font-weight: 600;
        }
        tr:nth-child(even) { 
            background-color: #f9f9f9; 
        }
        tr:hover {
            background-color: #f0f0f0;
        }
        .chart-container {
            margin: 30px 0;
            padding: 20px;
            background: #fafafa;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            position: relative;
            height: 400px;
        }
        .chart-container canvas {
            width: 100% !important;
            height: 100% !important;
        }
        .watermark {
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #eee;
            color: #999;
            font-size: 14px;
        }
        .watermark strong {
            color: #3498db;
            font-size: 16px;
        }
        .section {
            margin-bottom: 40px;
        }
        ul, ol {
            margin: 15px 0;
            padding-left: 25px;
        }
        li {
            margin: 8px 0;
        }
        p {
            margin: 10px 0;
        }
        @media print {
            body { 
                background: white;
                padding: 20px;
            }
            .container { 
                box-shadow: none;
                padding: 0;
            }
            .chart-container {
                page-break-inside: avoid;
                break-inside: avoid;
            }
        }
        @page {
            margin: 20mm;
        }
    </style>
</head>
<body>
    <div class="container">
        ${htmlContent}
        <div class="watermark">
            <strong>AutoIntel</strong><br>
            Generated on ${currentDate}
        </div>
    </div>
</body>
</html>`;
    } else {
      // If HTML structure exists, ensure Chart.js is included
      if (!htmlContent.includes("chart.js")) {
        htmlContent = htmlContent.replace(
          "</head>",
          '    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>\n</head>'
        );
      }

      // Ensure proper chart container styling exists
      if (!htmlContent.includes(".chart-container")) {
        htmlContent = htmlContent.replace(
          "</style>",
          `
        .chart-container {
            margin: 30px 0;
            padding: 20px;
            background: #fafafa;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            position: relative;
            height: 400px;
        }
        .chart-container canvas {
            width: 100% !important;
            height: 100% !important;
        }
        @media print {
            .chart-container {
                page-break-inside: avoid;
                break-inside: avoid;
            }
        }
        </style>`
        );
      }
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
