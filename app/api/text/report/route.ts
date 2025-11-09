// app/api/text/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { CohereEmbeddings } from "@langchain/cohere";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import * as z from "zod";

// Define the retrieval tool schema
const retrieveSchema = z.object({
  query: z.string().describe("The search query to find relevant information"),
});

interface AnalyzeRequest {
  datasetId: string;
  query: string;
  config?: {
    apiKey?: string;
    model?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: AnalyzeRequest = await req.json();
    const { datasetId, query, config } = body;

    if (!datasetId || !query) {
      return NextResponse.json(
        { error: "Missing required fields: datasetId and query" },
        { status: 400 }
      );
    }

    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const pineconeIndex = pinecone.Index(
      process.env.PINECONE_INDEX_NAME || "datasets"
    );

    // Initialize embeddings
    const embeddings = new CohereEmbeddings({
      apiKey: process.env.COHERE_API_KEY!,
      model: "embed-english-v3.0",
    });

    // Get vector store for this specific dataset (using namespace)
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
      namespace: datasetId,
      maxConcurrency: 5,
    });

    // Create retrieval tool
    const retrieve = tool(
      async ({ query }) => {
        try {
          const retrievedDocs = await vectorStore.similaritySearch(query, 4);

          if (retrievedDocs.length === 0) {
            return ["No relevant information found.", []];
          }

          const serialized = retrievedDocs
            .map(
              (doc, idx) =>
                `[Document ${idx + 1}]\n` +
                `Source: ${doc.metadata.source || "Unknown"}\n` +
                `Content: ${doc.pageContent}\n` +
                `---`
            )
            .join("\n\n");

          return [serialized, retrievedDocs];
        } catch (error) {
          console.error("Retrieval error:", error);
          return ["Error retrieving documents.", []];
        }
      },
      {
        name: "retrieve",
        description: "Retrieve information related to a query.",
        schema: retrieveSchema,
        responseFormat: "content_and_artifact",
      }
    );

    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash-lite",
      apiKey: "your-api-key",
    });

    // Create tools array
    const tools = [retrieve];

    // System prompt
    const systemPrompt = new SystemMessage(
      `You are a data analyst creating professional reports. Generate a comprehensive HTML report based on the dataset.
Use Chart.js for charts. Ensure charts are compatible with PDF rendering as per instructions.;

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

Return ONLY the HTML content (no markdown code blocks, just pure HTML).`
    );

    // Create agent
    const agent = createReactAgent({
      llm: model,
      tools,
    });

    // Prepare agent inputs
    const agentInputs = {
      messages: [systemPrompt, new HumanMessage(query)],
    };

    // Stream agent execution
    const stream = await agent.stream(agentInputs, {
      streamMode: "values",
    });

    let finalAnswer = "";
    let retrievedSources: string[] = [];
    const conversationLog: Array<{ role: string; content: string }> = [];

    for await (const step of stream) {
      const lastMessage = step.messages[step.messages.length - 1];

      // Log the conversation
      conversationLog.push({
        role: lastMessage._getType(),
        content:
          typeof lastMessage.content === "string"
            ? lastMessage.content
            : JSON.stringify(lastMessage.content),
      });

      console.log(`[${lastMessage._getType()}]: ${lastMessage.content}`);
      console.log("-----\n");

      // Extract final answer from AI messages
      if (
        lastMessage._getType() === "ai" &&
        typeof lastMessage.content === "string"
      ) {
        finalAnswer = lastMessage.content;
      }

      // Track sources from tool calls
      //   if (lastMessage.tool_calls && Array.isArray(lastMessage.tool_calls)) {
      //     retrievedSources.push(
      //       ...lastMessage.tool_calls.map((tc: any) => tc.args?.query || "")
      //     );
      //   }
    }

    return NextResponse.json({
      answer: finalAnswer || "No answer generated.",
      sources: retrievedSources.filter(Boolean),
      conversationLog,
    });
  } catch (error: any) {
    console.error("Text analysis error:", error);
    return NextResponse.json(
      {
        error: "Failed to analyze text",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
