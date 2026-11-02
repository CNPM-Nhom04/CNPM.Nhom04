import { BadRequestException } from "@nestjs/common";
import { Workbook } from "exceljs";
import { Readable } from "node:stream";
import { checkWorkbookArchive as checkMajorArchive } from "../../../core/excel/xlsx-archive";
export { checkWorkbookArchive as checkMajorArchive } from "../../../core/excel/xlsx-archive";
import { MajorImportRow } from "../domain/major-import";
export const MAJOR_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAJOR_HEADERS = [
  "Mã ngành",
  "Tên ngành",
  "Mã đơn vị quản lý",
  "Trạng thái",
];

export async function parseMajorWorkbook(
  buffer: Buffer,
  maxRows: number,
): Promise<MajorImportRow[]> {
  checkMajorArchive(buffer);
  const book = new Workbook();
  try {
    await book.xlsx.read(Readable.from([buffer]));
  } catch {
    throw new BadRequestException(
      "Không đọc được file XLSX. Hãy dùng file mẫu.",
    );
  }
  const sheet = book.getWorksheet("Nganh dao tao");
  if (!sheet)
    throw new BadRequestException(
      'Thiếu sheet "Nganh dao tao". Hãy tải file mẫu.',
    );
  if (sheet.rowCount > maxRows + 1)
    throw new BadRequestException(
      `Sheet dữ liệu vượt ${maxRows} dòng. Xóa các dòng thừa rồi thử lại.`,
    );
  const headers = MAJOR_HEADERS.map((_, i) =>
    String(sheet.getRow(1).getCell(i + 1).value || "").trim(),
  );
  if (
    headers.some((value, i) => value !== MAJOR_HEADERS[i]) ||
    sheet.columnCount > 4
  )
    throw new BadRequestException(
      "Cần giữ nguyên bốn cột tiêu đề trong file mẫu.",
    );
  const rows: MajorImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = [1, 2, 3, 4].map((i) => row.getCell(i).value);
    if (values.every((v) => v == null || (typeof v === "string" && !v.trim())))
      return;
    const errors: string[] = [];
    const text = values.map((value, i) => {
      if (value == null) return "";
      if (typeof value === "string") return value.trim().normalize("NFC");
      if (
        (i === 0 || i === 2) &&
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= 0
      )
        return String(value);
      errors.push(
        MAJOR_HEADERS[i] +
          ": chỉ nhận văn bản (không dùng công thức/liên kết).",
      );
      return "";
    });
    const [majorCode, majorName, unitCode, status] = text;
    if (!/^[A-Za-z0-9_-]{1,50}$/.test(majorCode))
      errors.push("Mã ngành gồm 1–50 chữ không dấu, số, _ hoặc -.");
    if (!majorName || majorName.length > 255)
      errors.push("Tên ngành bắt buộc, tối đa 255 ký tự.");
    if (!unitCode || unitCode.length > 50)
      errors.push("Điền mã đơn vị quản lý từ CSDL.");
    if (!["ACTIVE", "INACTIVE"].includes(status))
      errors.push("Trạng thái phải là ACTIVE hoặc INACTIVE.");
    rows.push({ rowNumber, majorCode, majorName, unitCode, status, errors });
  });
  if (!rows.length || rows.length > maxRows)
    throw new BadRequestException(
      `File phải có từ 1 đến ${maxRows} dòng dữ liệu.`,
    );
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(
      row.majorCode.toUpperCase(),
      (counts.get(row.majorCode.toUpperCase()) || 0) + 1,
    );
  for (const row of rows)
    if (counts.get(row.majorCode.toUpperCase())! > 1)
      row.errors.push("Mã ngành bị trùng trong file.");
  return rows;
}
