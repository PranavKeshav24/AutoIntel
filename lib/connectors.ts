import { CSV, Excel, Sheets, Core, type VisualizationSpec } from "autointel-package";

export type Dataset = any;

export const Csv = {
  loadCsvFromBlob: CSV.loadCsvFromBlob,
  loadCsvFromString: CSV.loadCsvFromString,
};

export const ExcelConnector = {
  loadExcelFromBlob: Excel.loadExcelFromBlob,
};

export const SheetsConnector = {
  csvExportUrlFromIds: Sheets.csvExportUrlFromIds,
  loadGoogleSheetCsvByUrl: Sheets.loadGoogleSheetCsvByUrl,
};

export async function runAutoIntel(
  dataset: Dataset,
  question: string,
  aiConfig?: { apiKey?: string; model?: string },
  includeCharts?: string[]
): Promise<{ specs: VisualizationSpec[]; report: string }> {
  const ds = toDataSet(dataset);
  const config = {
    apiKey: aiConfig?.apiKey || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY,
    model:
      aiConfig?.model ||
      ((process.env.NEXT_PUBLIC_OPENROUTER_MODEL as string) || "openai/gpt-oss-120b:free"),
  };
  const runAgentFn: any = (Core as any).runAgent;
  if (typeof runAgentFn === "function") {
    const result = await runAgentFn(ds, question, config, [], { includeCharts });
    return {
      specs: (result as any)?.selectedVisualizations || [],
      report: (result as any)?.report || "",
    };
  }

  // Last-resort fallback to heuristic visualizations (no AI)
  const suggest = (Core as any).suggestVisualizations || (Core as any).visualize?.suggestVisualizations;
  if (suggest) {
    const specs = await suggest(ds);
    return { specs: specs || [], report: "" };
  }
  throw new Error("autointel-package runAgent is unavailable in this build");
}

export async function aiChat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  aiConfig?: { apiKey?: string; model?: string; referer?: string; title?: string }
): Promise<string> {
  const config = {
    apiKey: aiConfig?.apiKey || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY,
    model: aiConfig?.model || (process.env.NEXT_PUBLIC_OPENROUTER_MODEL as string) || "openai/gpt-oss-20b:free",
    referer: aiConfig?.referer || process.env.NEXT_PUBLIC_OPENROUTER_REFERER,
    title: aiConfig?.title || process.env.NEXT_PUBLIC_OPENROUTER_TITLE || "AutoIntel",
  } as any;

  const chat = (Core as any).openRouterChat || (Core as any).default?.openRouterChat;
  if (!chat) return "AI chat is unavailable in this build.";
  try {
    const resp = await chat(messages, config);
    const content = (resp as any)?.choices?.[0]?.content || (resp as any)?.choices?.[0]?.message?.content;
    return content || JSON.stringify(resp);
  } catch (e: any) {
    return e?.message || "Failed to contact AI service.";
  }
}

function toDataSet(input: any): any {
  if (!input) return { schema: { fields: [] }, rows: [] };
  // Already a DataSet shape
  if (input.schema && input.rows) return input;
  // If only rows present
  const rows = Array.isArray(input) ? input : input.rows || [];
  const normalizeRows = (Core as any).normalizeRows || (Core as any).preprocess?.normalizeRows;
  const inferSchema = (Core as any).inferSchema || (Core as any).preprocess?.inferSchema;
  const norm = normalizeRows ? normalizeRows(rows) : rows;
  const schema = inferSchema ? inferSchema(norm) : { fields: Object.keys(norm[0] || {}).map((k) => ({ name: k })) };
  return { schema, rows: norm, source: { kind: "inmemory", name: input?.name || "dataset" } };
}
