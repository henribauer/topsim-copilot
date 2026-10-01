import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Plain text of a TOPSIM report PDF: one line per printed line (pdf.js marks line ends with
 * `hasEOL`), pages in order. Runs in the browser and in Node (tests); the browser entry sets the
 * worker URL (see pdfWorker.ts). Everything stays local — no upload anywhere.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  // pdf.js takes ownership of the buffer, so hand it a copy.
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  const doc = await task.promise;
  const lines: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    let line = "";
    for (const item of (await page.getTextContent()).items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      }
    }
    if (line) lines.push(line);
  }
  await task.destroy();
  return lines.join("\n") + "\n";
}
