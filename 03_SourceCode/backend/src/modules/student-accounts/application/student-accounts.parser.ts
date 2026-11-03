import { BadRequestException } from "@nestjs/common";
import { Workbook } from "exceljs";
import { Readable } from "node:stream";
import { isEmail } from "class-validator";
import { checkWorkbookArchive } from "../../../core/excel/xlsx-archive";
import { AccountImportRow } from "../domain/student-accounts";
export const STUDENT_HEADERS = [
  "Mã học viên",
  "Họ và tên",
  "Email",
  "Tên đăng nhập",
];
export async function parseStudentAccounts(
  buffer: Buffer,
  maxRows: number,
): Promise<AccountImportRow[]> {
  checkWorkbookArchive(buffer);
  const book = new Workbook();
  try {
    await book.xlsx.read(Readable.from([buffer]));
  } catch {
    throw new BadRequestException(
      "Không đọc được file XLSX. Hãy dùng file mẫu.",
    );
  }
  const sheet = book.getWorksheet("Hoc vien");
  if (
    !sheet ||
    STUDENT_HEADERS.some(
      (h, i) => sheet.getRow(1).getCell(i + 1).value !== h,
    ) ||
    sheet.columnCount > 4
  )
    throw new BadRequestException(
      "Giữ nguyên sheet Hoc vien và bốn tiêu đề trong file mẫu.",
    );
  if (sheet.rowCount > maxRows + 1)
    throw new BadRequestException(
      `Tối đa ${maxRows} dòng mỗi lần nhập; xóa các dòng thừa trong sheet Hoc vien.`,
    );
  const rows: AccountImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = [1, 2, 3, 4].map((i) => row.getCell(i).value);
    if (values.every((v) => v == null || (typeof v === "string" && !v.trim())))
      return;
    const errors: string[] = [];
    const text = values.map((v, i) => {
      if (v == null) return "";
      if (typeof v === "string") return v.trim().normalize("NFC");
      // Excel automatically stores typed email addresses as mailto hyperlinks.
      // Read the visible address only; never follow links or evaluate formulas.
      if (
        i === 2 &&
        typeof v === "object" &&
        "text" in v &&
        "hyperlink" in v &&
        typeof v.text === "string" &&
        typeof v.hyperlink === "string" &&
        v.hyperlink.trim().toLowerCase() ===
          "mailto:" + v.text.trim().toLowerCase()
      )
        return v.text.trim().normalize("NFC");
      if (
        (i === 0 || i === 3) &&
        typeof v === "number" &&
        Number.isSafeInteger(v) &&
        v >= 0
      )
        return String(v);
      errors.push(
        STUDENT_HEADERS[i] +
          ": chỉ nhận văn bản, không nhận công thức/liên kết.",
      );
      return "";
    });
    const [studentCode, fullName, emailValue, login] = text,
      email = emailValue.toLowerCase(),
      username = login || studentCode.toLowerCase();
    if (!/^[A-Za-z0-9_.-]{1,50}$/.test(studentCode))
      errors.push(
        "Mã học viên gồm 1–50 chữ không dấu, số, dấu chấm, _ hoặc -.",
      );
    if (!fullName || fullName.length > 255)
      errors.push("Họ tên bắt buộc, tối đa 255 ký tự.");
    if (
      email.length > 255 ||
      !isEmail(email, { allow_utf8_local_part: false }) ||
      !/^[\x21-\x7E]+$/.test(email)
    )
      errors.push("Email không hợp lệ; dùng địa chỉ email không dấu.");
    if (!/^[A-Za-z0-9_.@-]{3,100}$/.test(username))
      errors.push(
        "Tên đăng nhập gồm 3–100 chữ không dấu, số, . _ @ hoặc -. Nếu bỏ trống sẽ lấy mã học viên viết thường.",
      );
    rows.push({ rowNumber, studentCode, fullName, email, username, errors });
  });
  if (!rows.length)
    throw new BadRequestException("File chưa có dòng học viên.");
  for (const key of ["studentCode", "email", "username"] as const) {
    const counts = new Map<string, number>();
    for (const row of rows)
      counts.set(
        row[key].toLowerCase(),
        (counts.get(row[key].toLowerCase()) || 0) + 1,
      );
    for (const row of rows)
      if ((counts.get(row[key].toLowerCase()) || 0) > 1)
        row.errors.push(
          {
            studentCode: "Mã học viên",
            email: "Email",
            username: "Tên đăng nhập",
          }[key] + " bị trùng trong file.",
        );
  }
  return rows;
}
