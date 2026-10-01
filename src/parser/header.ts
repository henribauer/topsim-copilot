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
  let periodLine = start;
  for (const [i, line] of lines.slice(start, start + 4).entries()) {
    // "TNB14: Cash-" / "Flow Statement": a line ending in a hyphen continues the word.
    header = !header ? line : header.endsWith("-") ? header + line : `${header} ${line}`;
    periodLine = start + i;
    if (/Period:\s*\d+/.test(line)) break;
  }
  const m = new RegExp(`^${code}:\\s*(.+?)\\s+Period:\\s*(\\d+)`).exec(header);
  if (!m) throw new Error(`Cannot parse header: "${header}"`);

  // The cost reports wrap the other way: "TNB07: Cost Type" / "Period: 0" / "Accounting (TEUR)".
  // Take the tail from the line after the period only when it completes the known report name.
  const wrapped = `${m[1]} ${lines[periodLine + 1] ?? ""}`;
  const cutShort = m[1] !== reportName && reportName.startsWith(m[1]);
  // PDF text order puts the tail before the period: "TNB07: Cost Type" / "Accounting (TEUR)" / "Period: 0".
  const withUnit = m[1].startsWith(`${reportName} (`);
  const title = withUnit || (cutShort && wrapped.startsWith(reportName)) ? reportName : m[1];

  const companyLine = lines.find((l) => l.includes("- Company "));
  return {
    title,
    period: Number(m[2]),
    company: companyLine?.split(" - ").pop() ?? "",
    start,
  };
}
