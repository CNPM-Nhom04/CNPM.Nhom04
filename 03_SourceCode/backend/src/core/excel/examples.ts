import { CellValue, Workbook, Worksheet } from "exceljs";
import { exportSheet } from "./workbook";
export const EXAMPLE_SHEET = "Ví dụ điền đúng";
/** A separate, final worksheet. Importers must continue reading only their named input sheets. */
export function addExampleSheet(
  book: Workbook,
  source: Worksheet,
  rows: CellValue[][],
  notes: string[] = [],
) {
  const headers = Array.from(
    { length: source.columnCount },
    (_, i) => source.getRow(1).getCell(i + 1).text,
  );
  const sheet = exportSheet(
    book,
    EXAMPLE_SHEET,
    headers,
    source.columns.map((c) => c.width || 25),
  );
  sheet.properties.tabColor = { argb: "FFF59E0B" };
  sheet.addRows(rows);
  sheet.addRow([]);
  const notice = sheet.addRow([
    "CHỈ THAM KHẢO — sửa dữ liệu thực tế tại sheet " +
      source.name +
      ". Sheet ví dụ không được nhập vào CSDL.",
  ]);
  notice.font = { bold: true, color: { argb: "FF92400E" } };
  for (const note of notes) sheet.addRow([note]);
  for (let i = 2; i <= sheet.rowCount; i++) {
    sheet.getRow(i).alignment = { vertical: "top", wrapText: true };
    if (i > rows.length + 2) {
      if (headers.length > 1) sheet.mergeCells(i, 1, i, headers.length);
      sheet.getRow(i).height = 45;
    }
  }
  return sheet;
}
export interface ExampleField {
  id: string;
  label: string;
  type: string;
  value: string;
  readonly: boolean;
  required: boolean;
  min?: string;
  max?: string;
  step?: string;
  minLength?: number;
  maxLength?: number;
  options?: { value: string; label: string }[];
}
export function exampleValue(field: ExampleField): string {
  if (field.type === "password")
    return field.required
      ? "ViDu@2026Abc123!"
          .padEnd(Math.max(16, field.minLength || 0), "a")
          .slice(0, field.maxLength || 255)
      : "";
  if (field.readonly) return field.value;
  if (field.value && !["number", "range"].includes(field.type))
    return field.value;
  if (field.options)
    return (
      field.options.find((o) => o.value && o.value !== "__CUSTOM__")?.value ||
      ""
    );
  if (field.type === "checkbox") return "true";
  const key = (field.id + " " + field.label)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
  if (field.type === "number" || field.type === "range") {
    let n = /attendanceweight/.test(key)
      ? 20
      : /midtermweight/.test(key)
        ? 30
        : /examweight/.test(key)
          ? 50
          : /decimalplaces/.test(key)
            ? 2
            : /diem|score|gpa/.test(key)
              ? 7
              : 1;
    const min =
      field.min !== undefined && field.min !== ""
        ? Number(field.min)
        : undefined;
    const max =
      field.max !== undefined && field.max !== ""
        ? Number(field.max)
        : undefined;
    const existing = Number(field.value);
    if (
      field.value !== "" &&
      Number.isFinite(existing) &&
      (min === undefined || existing >= min) &&
      (max === undefined || existing <= max)
    )
      return field.value;
    if (min !== undefined && Number.isFinite(min)) n = Math.max(n, min);
    if (max !== undefined && Number.isFinite(max)) n = Math.min(n, max);
    return String(n);
  }
  if (field.type === "date") {
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    return field.min && today < field.min
      ? field.min
      : field.max && today > field.max
        ? field.max
        : today;
  }
  if (field.type === "time") return "09:00";
  if (field.type === "email" || /email/.test(key))
    return "minh.vidu@example.com";
  if (field.type === "url" || /duong dan|lien ket|url/.test(key))
    return "https://example.com/van-ban.pdf";
  if (/note|ly do|noi dung xac nhan/.test(key))
    return "Bổ sung dữ liệu theo hồ sơ đào tạo";
  if (/reference|ho so|can cu|quyet dinh|bien ban/.test(key))
    return "VD-HS-2026-001";
  if (/khoatuyensinh|nien khoa|khoa tuyen sinh/.test(key)) return "2026 - 2028";
  if (/ho ten|ho va ten/.test(key)) return "Nguyễn Văn Minh";
  if (/dien thoai/.test(key)) return "0901234567";
  if (/username|ten dang nhap/.test(key)) return "vidu2026";
  if (/ma phien ban/.test(key)) return "VD_v2";
  if (/\bma\b|code/.test(key)) return "VD001";
  if (field.type === "search") return "";
  const value = "Nội dung minh họa theo hồ sơ";
  return value
    .padEnd(Math.max(value.length, field.minLength || 0), "x")
    .slice(0, field.maxLength || 1000);
}
