export function getLing1TLLM() {
  // Stub LLM wrapper; replace with real LLM integration (e.g., OpenAI, OpenRouter) as needed
  return {
    async call(prompt: string) {
      // For test: just echo, or replace with API call
      return `Generated query from prompt: ${prompt}`;
    }
  };
}

