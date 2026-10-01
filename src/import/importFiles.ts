import { extractPdfText } from "./pdfText";
import { previewPaste, type PastePreview } from "./previewPaste";
import { listZipReports } from "./reportsZip";

export interface DroppedFile {
  name: string;
  bytes: Uint8Array;
}

/** One report ready for review. `text` is what gets saved, exactly as if it had been pasted. */
export interface ImportItem {
  /** "reports.zip › Report1_Executive Summary.pdf" or the PDF's own name. */
  source: string;
  text: string;
  preview: PastePreview;
  /** Set when parsed: "TNB01", period 0. */
  code?: string;
  period?: number;
}

export interface ImportResult {
  /** Parsed reports oldest period first, then by report code; unreadable files last. */
  items: ImportItem[];
  /** Files left out because the same report (code + period) was already in the list. */
  skipped: string[];
}

const COLLECTIVE =
  "The collective report bundles all reports in one file — drop the ZIP or the individual report PDFs instead.";

/** Any mix of TOPSIM ZIPs ("download all reports") and single report PDFs → one ordered list. */
export async function importFiles(files: DroppedFile[]): Promise<ImportResult> {
  // `at` = position in the drop, so unreadable files are listed in the order Henri dropped them.
  const pdfs: (DroppedFile & { at: number })[] = [];
  const failed: (ImportItem & { at: number })[] = [];
  const fail = (at: number, source: string, message: string) =>
    failed.push({ at, source, text: "", preview: { status: "error", message } });

  for (const [at, f] of files.entries()) {
    if (/\.zip$/i.test(f.name)) {
      try {
        for (const r of listZipReports(f.bytes)) pdfs.push({ at, name: `${f.name} › ${r.fileName}`, bytes: r.bytes });
      } catch (e) {
        fail(at, f.name, errorText(e));
      }
    } else if (/^Collective report/i.test(f.name)) {
      fail(at, f.name, COLLECTIVE);
    } else {
      pdfs.push({ ...f, at });
    }
  }

  const parsed: ImportItem[] = [];
  for (const f of pdfs) {
    let text: string;
    try {
      text = await extractPdfText(f.bytes);
    } catch (e) {
      fail(f.at, f.name, `Could not read this PDF: ${errorText(e)}`);
      continue;
    }
    const preview = previewPaste(text);
    if (preview.status !== "ok") {
      fail(f.at, f.name, preview.status === "error" ? preview.message : "The PDF has no text.");
      continue;
    }
    parsed.push({ source: f.name, text, preview, code: preview.report.reportCode, period: preview.report.period });
  }

  const { items, skipped } = orderReports(parsed);
  failed.sort((a, b) => a.at - b.at);
  return { items: [...items, ...failed.map(({ at: _, ...item }) => item)], skipped };
}

/** Parsed reports oldest period first, then by report code; a second copy of the same report is skipped. */
export function orderReports(parsed: ImportItem[]): ImportResult {
  const sorted = [...parsed].sort((a, b) => a.period! - b.period! || a.code!.localeCompare(b.code!));
  const items: ImportItem[] = [];
  const skipped: string[] = [];
  for (const item of sorted) {
    const first = items.find((i) => i.code === item.code && i.period === item.period);
    if (first) skipped.push(`${item.source}: same report as ${first.source} (${item.code}, period ${item.period})`);
    else items.push(item);
  }
  return { items, skipped };
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
