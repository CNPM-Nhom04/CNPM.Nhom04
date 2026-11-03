import { Workbook, Worksheet } from "exceljs";
export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export function exportSheet(
  book: Workbook,
  name: string,
  headers: string[],
  widths?: number[],
): Worksheet {
  const sheet = book.addWorksheet(name);
  sheet.addRow(headers);
  sheet.columns = headers.map((_, i) => ({ width: widths?.[i] || 24 }));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };
  return sheet;
}
