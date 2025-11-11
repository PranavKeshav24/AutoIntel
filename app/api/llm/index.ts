export function getLing1TLLM() {
  // Stub LLM wrapper; replace with real LLM integration (e.g., OpenAI, OpenRouter) as needed
  return {
    async call(prompt: string) {
      // For test: return a valid JSON query object string that can be parsed.
      return JSON.stringify({ operation: "find", collection: "test", query: { filter: { from_prompt: prompt } } });
    }
  };
}



