let llmInstance: any = null;

/**
 * Get or create an LLM instance for MongoDB query generation
 */
export function getLing1TLLM() {
  if (!llmInstance) {
    // Use a simple LLM instance that returns the prompt as-is
    // For production, replace with actual LLM API call
    llmInstance = {
      call: async (prompt: string) => {
        // For now, we'll call OpenRouter API directly
        const apiKey = process.env.OPENROUTER_API_KEY;
        
        if (!apiKey) {
          throw new Error("OPENROUTER_API_KEY is not set");
        }

        try {
          const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://autoIntel.com",
                "X-Title": "AutoIntel - MongoDB Query Generator",
              },
              body: JSON.stringify({
                model: "openai/gpt-4o-mini",
                messages: [
                  {
                    role: "system",
                    content:
                      "You are a MongoDB query generator. Convert natural language to MongoDB queries. Return ONLY valid JSON, no markdown formatting.",
                  },
                  { role: "user", content: prompt },
                ],
              }),
            }
          );

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API error: ${error}`);
          }

          const data = await response.json();
          const content = data.choices[0]?.message?.content || "";

          // Extract JSON if wrapped in markdown code blocks
          const jsonMatch =
            content.match(/```json\s*([\s\S]*?)```/) ||
            content.match(/```\s*([\s\S]*?)```/) ||
            [null, content];

          return jsonMatch[1] || content;
        } catch (error) {
          console.error("Error calling LLM:", error);
          throw error;
        }
      },
    };
  }

  return llmInstance;
}

