import type { Workbook } from 'exceljs';
import { parseCsv } from './csv';

export interface Table {
  headers: string[];
  rows: string[][];
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Converteix una matriu en taula: la primera fila és la capçalera. */
export function tableFromMatrix(matrix: string[][]): Table {
  if (matrix.length === 0) throw new Error('El fitxer està buit.');
  const width = Math.max(...matrix.map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => (matrix[0][i] ?? '').trim() || `Columna ${i + 1}`);
  const rows = matrix.slice(1).map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? '').toString()));
  return { headers, rows };
}

export function readFileAs<T extends 'text' | 'buffer'>(file: Blob, as: T): Promise<T extends 'text' ? string : ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No s’ha pogut llegir el fitxer.'));
    reader.onload = () => resolve(reader.result as never);
    if (as === 'text') reader.readAsText(file, 'utf-8');
    else reader.readAsArrayBuffer(file);
  });
}

type WorkbookCtor = new () => Workbook;

async function workbookCtor(): Promise<WorkbookCtor> {
  const mod = (await import('exceljs')) as unknown as { Workbook?: WorkbookCtor; default?: { Workbook?: WorkbookCtor } };
  const ctor = mod.Workbook ?? mod.default?.Workbook;
  if (!ctor) throw new Error('No s’ha pogut carregar el lector d’Excel.');
  return ctor;
}

export async function tableFromXlsx(data: ArrayBuffer | Uint8Array): Promise<Table> {
  const wb = new (await workbookCtor())();
  await wb.xlsx.load(data as never);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('El fitxer Excel no té cap full.');
  const matrix: string[][] = [];
  const width = ws.columnCount;
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= width; c += 1) cells.push(row.getCell(c).text ?? '');
    matrix.push(cells);
  });
  return tableFromMatrix(matrix.filter((r) => r.some((c) => c.trim() !== '')));
}

export async function readTableFromFile(file: File): Promise<Table> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.numbers')) {
    throw new Error(
      'Els fitxers de Numbers no es poden llegir directament. A Numbers: Arxiu → Exporta a → CSV (o Excel) i carrega aquest fitxer.',
    );
  }
  if (name.endsWith('.xlsx')) return tableFromXlsx(await readFileAs(file, 'buffer'));
  if (name.endsWith('.xls')) throw new Error('El format .xls antic no és compatible. Desa el fitxer com a .xlsx o CSV.');
  return tableFromMatrix(parseCsv(await readFileAs(file, 'text')));
}

export async function xlsxBuffer(headers: string[], rows: (string | number | null)[][], sheetName = 'Samarretes') {
  const wb = new (await workbookCtor())();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  for (const r of rows) ws.addRow(r);
  ws.columns.forEach((col, i) => {
    const longest = Math.max(headers[i]?.length ?? 8, ...rows.map((r) => String(r[i] ?? '').length));
    col.width = Math.min(Math.max(longest + 2, 8), 50);
  });
  return wb.xlsx.writeBuffer();
}

export async function xlsxBlob(headers: string[], rows: (string | number | null)[][]): Promise<Blob> {
  return new Blob([(await xlsxBuffer(headers, rows)) as BlobPart], { type: XLSX_MIME });
}
