// import { Core } from "autointel-package";
import {
  suggestVisualizations,
  runAgent as RunAg,
} from "autointel-package/packages/core/src";
import { Core } from "autointel-package";
// Connectors per docs: src/connectors/{csv,excel,sheets}.ts
// We import via package surface; assuming re-exports are available.
import {
  loadCsvFromBlob,
  loadCsvFromString,
} from "autointel-package/src/connectors/csv";
import { loadExcelFromBlob } from "autointel-package/src/connectors/excel";
import {
  csvExportUrlFromIds,
  loadGoogleSheetCsvByUrl,
} from "autointel-package/src/connectors/sheets";

export type Dataset = any;

export const Csv = { loadCsvFromBlob, loadCsvFromString };
export const Excel = { loadExcelFromBlob };
export const Sheets = { csvExportUrlFromIds, loadGoogleSheetCsvByUrl };

export async function suggestCharts(dataset: Dataset) {
  // Returns Vega-Lite specs
  return suggestVisualizations(dataset);
}

export async function runAgent(
  dataset: Dataset,
  userQuery: string,
  aiConfig?: any,
  tools?: any,
  opts?: { includeCharts?: boolean; excludeCharts?: boolean; title?: string }
) {
  return runAgent(dataset, userQuery, aiConfig, tools, opts);
}
