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
      apiKey: "AIzaSyAQprJSIwbC9JW7KWeflLaI-9WXifgZbyg",
    });

    // Create tools array
    const tools = [retrieve];

    // System prompt
    const systemPrompt = new SystemMessage(
      `You are a data analysis assistant. You have access to a dataset
      Your task is to:
1. Answer the user's query based on the data
2. Suggest relevant visualizations using Plotly specification, only if the user has asked for it in the query.
3. Provide follow-up questions

Respond in JSON format:
{
  "answer": "Your analysis here",
  "visualizations": [
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
  ],
  "followUps": ["Question 1?", "Question 2?"]
}`
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
