/** The header TOPSIM prints at the top of every report page. */
export interface ReportHeader {
  title: string;
  period: number;
  company: string;
  /** Index of the "TNBnn:" line in the given lines. */
  start: number;
}

/**
 * Reads "TNBnn: <title> Period: <n>" plus the company line. TOPSIM may wrap the
 * title over several lines ("TNB11: Profit and" / "Loss Statement" / "Period: 0").
 */
export function readHeader(lines: string[], code: string, reportName: string): ReportHeader {
  const marker = new RegExp(`^${code}:`);
  const start = lines.findIndex((l) => marker.test(l));
  if (start === -1) throw new Error(`Not a ${code} ${reportName} report: missing '${code}:' header`);

  let header = "";
  for (const line of lines.slice(start, start + 4)) {
    header = header ? `${header} ${line}` : line;
    if (/Period:\s*\d+/.test(line)) break;
  }
  const m = new RegExp(`^${code}:\\s*(.+?)\\s+Period:\\s*(\\d+)`).exec(header);
  if (!m) throw new Error(`Cannot parse header: "${header}"`);

  const companyLine = lines.find((l) => l.includes("- Company "));
  return {
    title: m[1],
    period: Number(m[2]),
    company: companyLine?.split(" - ").pop() ?? "",
    start,
  };
}
