/**
 * Secure Excel Parser using ExcelJS
 * Replaces vulnerable xlsx package with ExcelJS for safer parsing
 */

import ExcelJS from 'exceljs';

export interface ParsedRow {
  [key: string]: unknown;
}

/**
 * Parse an Excel/CSV file and return JSON data
 * @param file - The file to parse (xlsx, xls, csv)
 * @returns Promise<ParsedRow[]> - Array of row objects with header keys
 */
export async function parseExcelFile(file: File): Promise<ParsedRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  
  // Handle different file types
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.csv')) {
    // For CSV, read as text and parse
    const text = new TextDecoder().decode(arrayBuffer);
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('Empty CSV file');
    }
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows: ParsedRow[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const rowObj: ParsedRow = {};
      headers.forEach((header, index) => {
        rowObj[header] = values[index] ?? '';
      });
      rows.push(rowObj);
    }
    return rows;
  }
  
  // For xlsx files
  await workbook.xlsx.load(arrayBuffer);
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in file');
  }
  
  const rows: ParsedRow[] = [];
  let headers: string[] = [];
  
  worksheet.eachRow((row, rowNumber) => {
    const values = row.values as (string | number | boolean | Date | null | undefined)[];
    // ExcelJS row.values is 1-indexed, first element is undefined
    const cleanValues = values.slice(1);
    
    if (rowNumber === 1) {
      // First row is headers
      headers = cleanValues.map(v => String(v ?? '').trim());
    } else {
      // Data rows
      const rowObj: ParsedRow = {};
      cleanValues.forEach((value, index) => {
        const header = headers[index];
        if (header) {
          // Handle different value types
          if (value instanceof Date) {
            rowObj[header] = value.toISOString().split('T')[0];
          } else {
            rowObj[header] = value ?? '';
          }
        }
      });
      rows.push(rowObj);
    }
  });
  
  return rows;
}

/**
 * Find a value in a row object using flexible column matching
 * @param row - The row object
 * @param possibleKeys - Array of possible column names to match
 * @returns The found value or undefined
 */
export function findColumnValue(row: ParsedRow, possibleKeys: string[]): unknown {
  for (const key of Object.keys(row)) {
    const normalizedKey = key.toLowerCase().replace(/[\s_-]/g, '');
    for (const searchKey of possibleKeys) {
      if (normalizedKey.includes(searchKey.toLowerCase().replace(/[\s_-]/g, ''))) {
        return row[key];
      }
    }
  }
  return undefined;
}

/**
 * Parse a price value from various formats
 * @param value - The value to parse
 * @returns Numeric price or 0
 */
export function parsePrice(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.]/g, '');
    return parseFloat(cleaned) || 0;
  }
  return 0;
}
