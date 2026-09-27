// A minimal, dependency-free CSV parser — good enough for flat wearable/
// health export files (no nested structures), and deterministic (no LLM,
// no format-guessing beyond "is this comma-separated with a header row").

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

export function parseCsv(content: string): ParsedCsv {
  const lines = content.split(/\r\n|\n|\r/).filter((line) => line.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

export function looksLikeCsv(content: string): boolean {
  const firstLine = content.split(/\r\n|\n|\r/, 1)[0] ?? "";
  return firstLine.includes(",") && firstLine.length < 5000;
}
