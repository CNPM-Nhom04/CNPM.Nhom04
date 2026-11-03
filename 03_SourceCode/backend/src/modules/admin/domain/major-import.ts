export interface MajorImportRow {
  rowNumber: number;
  majorCode: string;
  majorName: string;
  unitCode: string;
  status: string;
  errors: string[];
  unitId?: string;
  unitName?: string;
}
export interface MajorImportLimits {
  maxFileBytes: number;
  maxRows: number;
}
export interface MajorImportPreview {
  fileHash: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  canImport: boolean;
  rows: MajorImportRow[];
}
export function importPreview(
  rows: MajorImportRow[],
  fileHash: string,
): MajorImportPreview {
  const errorRows = rows.filter((row) => row.errors.length > 0).length;
  return {
    fileHash,
    totalRows: rows.length,
    validRows: rows.length - errorRows,
    errorRows,
    canImport: rows.length > 0 && errorRows === 0,
    rows,
  };
}
