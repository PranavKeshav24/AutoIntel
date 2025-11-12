// app/api/text/report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { createAgent } from "langchain";
import { getVectorStore, getDebugInfo } from "@/lib/vector-store-manager";
import { CohereEmbeddings } from "@langchain/cohere";
import * as z from "zod";

// Define the retrieval tool schema
const retrieveSchema = z.object({
  query: z.string(),
});

interface ReportRequest {
  datasetId: string;
  query: string;
  config?: {
    apiKey?: string;
    model?: string;
  };
  selectedVisualizations?: Array<{
    id: string;
    title: string;
    description: string;
    plotlyData: any[];
    plotlyLayout: any;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const body: ReportRequest = await req.json();
    const { datasetId, query, config, selectedVisualizations } = body;

    console.log(
      `[Report] Received request for datasetId: ${datasetId}, query: ${query.substring(
        0,
        50
      )}...`
    );

    if (!datasetId || !query) {
      return NextResponse.json(
        { error: "Missing required fields: datasetId and query" },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_API_KEY && !process.env.GOOGLE_GEMINI_API_KEY) {
      throw new Error(
        "GOOGLE_API_KEY or GOOGLE_GEMINI_API_KEY is not configured."
      );
    }

    if (!process.env.COHERE_API_KEY) {
      throw new Error("COHERE_API_KEY is not configured.");
    }

    const normalizedDatasetId = datasetId.trim();
    console.log(
      `[Report] Looking up vector store for datasetId: "${normalizedDatasetId}"`
    );

    // Initialize embeddings
    const embeddings = new CohereEmbeddings({
      apiKey: process.env.COHERE_API_KEY,
      model: "embed-english-v3.0",
    });

    // Get vector store
    const vectorStore = await getVectorStore(normalizedDatasetId, embeddings);

    if (!vectorStore) {
      const debugInfo = getDebugInfo();
      console.error(
        `[Report] Vector store not found for datasetId: "${normalizedDatasetId}"`
      );

      return NextResponse.json(
        {
          error:
            "Vector store not found for this dataset. Please index the document first.",
          details: `Dataset ID: ${normalizedDatasetId}. Available: ${
            debugInfo.datasetIds.join(", ") || "none"
          }`,
        },
        { status: 404 }
      );
    }

    console.log(`[Report] Vector store found, generating report...`);

    // Create retrieval tool
    const retrieve = tool(
      async ({ query }) => {
        console.log(`[Report] Retrieving documents for: ${query}`);
        const retrievedDocs = await vectorStore.similaritySearch(query, 6);
        console.log(`[Report] Retrieved ${retrievedDocs.length} documents`);

        const serialized = retrievedDocs
          .map(
            (doc, idx) =>
              `[Document ${idx + 1}]\nSource: ${
                doc.metadata.source || "Unknown"
              }\nContent: ${doc.pageContent}\n---`
          )
          .join("\n\n");
        return [serialized, retrievedDocs];
      },
      {
        name: "retrieve",
        description:
          "Retrieve comprehensive information from the document for report generation.",
        schema: retrieveSchema,
        responseFormat: "content_and_artifact",
      }
    );

    // Initialize chat model
    const apiKey =
      config?.apiKey ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY;
    const model = new ChatGoogleGenerativeAI({
      model: config?.model || "gemini-2.5-flash-lite",
      apiKey: apiKey!,
      temperature: 0.5,
    });

    // Create tools array
    const tools = [retrieve];

    // Build visualization context for the prompt if provided
    const vizContext =
      selectedVisualizations && selectedVisualizations.length > 0
        ? `\n\nINCLUDE THESE VISUALIZATIONS IN THE REPORT:
${selectedVisualizations
  .map(
    (viz, idx) => `
${idx + 1}. ${viz.title}
   Description: ${viz.description}
   Chart ID: ${viz.id}
`
  )
  .join("\n")}`
        : "";

    // System prompt
    const systemPromptText = `You are a professional report writer. You have access to a retrieval tool that fetches information from documents.

TASK: Generate a comprehensive HTML report based on the retrieved data.

REPORT STRUCTURE:
1. **Executive Summary** - Key findings and overview (2-3 paragraphs)
2. **Document Overview** - What the document contains, scope, purpose
3. **Key Findings** - Main insights discovered (bullet points or paragraphs)
4. **Detailed Analysis** - In-depth examination of the content
5. **Statistical Insights** - Any patterns, trends, or notable data points
6. **Visualizations** - Charts that illustrate key data (use Chart.js)
7. **Recommendations** - Actionable suggestions based on findings
8. **Conclusion** - Summary and final thoughts

${vizContext}

CRITICAL CHART.JS REQUIREMENTS:
- Load Chart.js from CDN: <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
- Wrap ALL chart initialization in DOMContentLoaded event
- Each chart needs a unique canvas ID
- Place scripts at the END of <body>, just before </body>

EXACT PATTERN FOR CHARTS:

<div class="chart-container" style="position: relative; height: 400px; margin: 30px 0;">
  <canvas id="chart1"></canvas>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
  if (typeof Chart !== 'undefined') {
    const ctx1 = document.getElementById('chart1').getContext('2d');
    new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: ['Label1', 'Label2', 'Label3'],
        datasets: [{
          label: 'Dataset',
          data: [12, 19, 15],
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top' },
          title: { display: true, text: 'Chart Title' }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }
});
</script>

STYLING:
- Use clean, professional CSS
- Include a header with "AutoIntel Report" and generation timestamp
- Use proper typography (headers, paragraphs, spacing)
- Add subtle colors and borders
- Make it print-friendly

OUTPUT: Return ONLY the complete HTML (no markdown code blocks, just pure HTML starting with <!DOCTYPE html>).`;

    // Create agent
    const agent = createAgent({ model, tools, systemPrompt: systemPromptText });

    // Prepare agent inputs
    const agentInputs = {
      messages: [{ role: "user", content: query }],
    };

    console.log(`[Report] Starting agent execution...`);

    // Stream agent execution
    const stream = await agent.stream(agentInputs, {
      streamMode: "values",
    });

    let finalAnswer = "";

    for await (const step of stream) {
      const lastMessage = step.messages[step.messages.length - 1];

      // Extract final answer from AI messages
      if (
        (lastMessage.role === "ai" || lastMessage._getType?.() === "ai") &&
        typeof lastMessage.content === "string"
      ) {
        finalAnswer = lastMessage.content;
      }
    }

    console.log(`[Report] Report generation complete`);

    // Clean up the HTML if it has markdown code blocks
    let cleanedHtml = finalAnswer
      .replace(/```html\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Ensure it starts with DOCTYPE
    if (!cleanedHtml.toLowerCase().startsWith("<!doctype")) {
      console.warn(
        "[Report] Response doesn't start with DOCTYPE, may not be valid HTML"
      );
    }

    return NextResponse.json({
      answer: cleanedHtml || "No report generated.",
    });
  } catch (error: any) {
    console.error("[Report] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate report",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
