/**
 * CSV helpers with formula-injection protection for spreadsheet clients.
 *
 * Dangerous prefixes (=, +, -, @) and leading whitespace / tabs / CR / LF
 * are neutralized by prefixing a single quote so Excel/Sheets treat the
 * cell as text rather than an executable formula.
 */

const FORMULA_PREFIX = /^[\t\r\n ]*[=+\-@]/;

/**
 * Escape a single CSV cell value.
 * @param {*} value
 * @returns {string}
 */
const escapeCsvCell = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  let str = String(value);

  // Neutralize formula injection (including after leading whitespace)
  if (FORMULA_PREFIX.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes by doubling them; quote if special chars present
  const needsQuotes =
    str.includes('"') ||
    str.includes(",") ||
    str.includes("\n") ||
    str.includes("\r");

  if (str.includes('"')) {
    str = str.replace(/"/g, '""');
  }

  return needsQuotes ? `"${str}"` : str;
};

/**
 * Build a CSV document from headers and row objects/arrays.
 * @param {string[]} headers
 * @param {Array<Object|Array>} rows
 * @returns {string} UTF-8 CSV with BOM for Excel compatibility
 */
const buildCsv = (headers, rows) => {
  const headerLine = headers.map(escapeCsvCell).join(",");
  const dataLines = rows.map((row) => {
    if (Array.isArray(row)) {
      return row.map(escapeCsvCell).join(",");
    }
    return headers.map((h) => escapeCsvCell(row[h])).join(",");
  });

  // BOM helps Excel recognize UTF-8
  return `\uFEFF${[headerLine, ...dataLines].join("\r\n")}\r\n`;
};

/**
 * Send a CSV download response.
 */
const sendCsvDownload = (res, filename, csvContent) => {
  const safeName = String(filename).replace(/[^\w.\-]+/g, "_");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeName}"`
  );
  res.status(200).send(csvContent);
};

module.exports = {
  escapeCsvCell,
  buildCsv,
  sendCsvDownload,
  FORMULA_PREFIX,
};
