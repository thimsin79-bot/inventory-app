/**
 * Dependency-free RFC 4180 CSV helpers.
 *
 * `parseCsv` handles quoted fields, doubled quotes, CRLF/LF line endings and a
 * UTF-8 BOM (Excel writes one). It throws on an unclosed quote — a malformed
 * file should be rejected loudly, not half-imported.
 *
 * `toCsv` quotes only what needs quoting and terminates with CRLF, which Excel
 * and Sheets both accept.
 */

export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let sawAny = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      sawAny = true
      continue
    }

    if (ch === '"' && field === '') {
      inQuotes = true
      sawAny = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
      sawAny = true
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      sawAny = false
    } else {
      field += ch
      sawAny = true
    }
  }

  if (inQuotes) throw new Error('The file has an unclosed quote — it may be truncated or corrupted.')

  if (sawAny || field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Blank separator lines carry no data; drop them.
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined): string => {
    const s = value === null || value === undefined ? '' : String(value)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map((r) => r.map(escape).join(',')).join('\r\n') + '\r\n'
}
