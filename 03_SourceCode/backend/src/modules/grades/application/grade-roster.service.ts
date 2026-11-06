import { addExampleSheet } from "../../../core/excel/examples";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Workbook, ValueType } from "exceljs";
import { GradeActor, GradeRepository } from "../domain/grade";
import { checkWorkbookArchive } from "../../../core/excel/xlsx-archive";
import { exportSheet } from "../../../core/excel/workbook";
const HEADERS = [
  "Mã học viên",
  "ID lớp học phần",
  "Lý do lập danh sách",
  "Số hồ sơ",
];
@Injectable()
export class GradeRosterService {
  constructor(private readonly repository: GradeRepository) {}
  private ids(classId: string, termId: string) {
    if (![classId, termId].every((v) => /^[1-9]\d{0,19}$/.test(v || "")))
      throw new BadRequestException("Chọn lớp và học kỳ hợp lệ.");
  }
  data(classId: string, termId: string, a: GradeActor) {
    this.ids(classId, termId);
    return this.repository.preparation(classId, termId, a);
  }
  async template(
    classId: string,
    termId: string,
    a: GradeActor,
    prefill = false,
  ) {
    this.ids(classId, termId);
    if (!a.canPrepare)
      throw new ForbiddenException(
        "Cần quyền REGISTRATION_MANAGE để lập danh sách học.",
      );
    const data = await this.repository.preparation(classId, termId, a);
    if (!data.members.length)
      throw new BadRequestException(
        "Lớp chưa có học viên hoạt động với phân công CTĐT phù hợp trong phạm vi.",
      );
    if (!data.offerings.length)
      throw new BadRequestException(
        "Học kỳ chưa có lớp học phần phù hợp với phiên bản CTĐT của lớp. Cần cấu hình lớp học phần trước.",
      );
    const book = new Workbook(),
      sheet = exportSheet(book, "Danh sach hoc", HEADERS, [25, 25, 70, 35]);
    for (const member of data.members) {
      const existing = data.registrations.filter(
        (r) =>
          r.studentCode === member.studentCode &&
          r.status === "REGISTERED" &&
          data.offerings.some((o) => o.offeringId === r.offeringId),
      );
      if (existing.length)
        for (const registration of existing)
          sheet.addRow([member.studentCode, registration.offeringId, "", ""]);
      else sheet.addRow([member.studentCode, "", "", ""]);
    }
    if (prefill) {
      const pending = Array.from({ length: sheet.rowCount - 1 }, (_, i) =>
        sheet.getRow(i + 2),
      ).filter((row) => !row.getCell(2).text);
      const example = [...data.offerings]
        .sort((a, b) => Number(!!b.policyId) - Number(!!a.policyId))
        .find(
          (offering) =>
            Number(offering.capacity) - Number(offering.enrolled) >=
            pending.length,
        );
      if (pending.length && !example)
        throw new BadRequestException(
          "Không có lớp học phần còn đủ chỗ để điền mẫu cho tất cả học viên. Hãy dùng mẫu thường và chọn môn theo từng học viên.",
        );
      for (const row of pending) {
        row.getCell(2).value = example.offeringId;
        row.getCell(2).note =
          `Môn minh họa: ${example.offeringCode} — ${example.courseName}. Đổi ID nếu học viên học môn khác.`;
        row.getCell(3).value = "Bổ sung danh sách học theo hồ sơ đào tạo";
        row.getCell(4).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFE699" },
        };
        row.getCell(4).note = "Điền số hồ sơ thực tế trước khi nhập.";
      }
    }
    const members = exportSheet(
      book,
      "Hoc vien",
      ["Mã học viên", "Họ tên"],
      [25, 45],
    );
    data.members.forEach((s) => members.addRow([s.studentCode, s.studentName]));
    const offerings = exportSheet(
      book,
      "Lop hoc phan",
      [
        "ID lớp học phần",
        "Mã lớp học phần",
        "Mã môn",
        "Tên môn",
        "Chỗ còn lại",
        "Quy tắc điểm",
      ],
      [25, 30, 20, 50, 20, 25],
    );
    data.offerings.forEach((o) =>
      offerings.addRow([
        o.offeringId,
        o.offeringCode,
        o.courseCode,
        o.courseName,
        Number(o.capacity) - Number(o.enrolled),
        o.policyId ? "Đã cấu hình" : "Chưa cấu hình",
      ]),
    );
    if (
      sheet.rowCount > 5001 ||
      members.rowCount > 5001 ||
      offerings.rowCount > 5001
    )
      throw new BadRequestException(
        "Danh sách vượt giới hạn 5000 dòng của file Excel.",
      );
    book.definedNames.add(
      `'Hoc vien'!$A$2:$A$${members.rowCount}`,
      "MaHocVien",
    );
    book.definedNames.add(
      `'Lop hoc phan'!$A$2:$A$${offerings.rowCount}`,
      "LopHocPhan",
    );
    const validationLastRow = Math.min(
      5001,
      Math.max(101, sheet.rowCount + 20),
    );
    for (let row = 2; row <= validationLastRow; row++) {
      for (const [col, name] of [
        [1, "MaHocVien"],
        [2, "LopHocPhan"],
      ] as const) {
        sheet.getCell(row, col).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [name],
          showErrorMessage: true,
          errorTitle: "Giá trị không hợp lệ",
          error: "Chọn giá trị trong danh sách của lớp và học kỳ này.",
        };
      }
    }
    const meta = book.addWorksheet("_context", { state: "veryHidden" });
    meta.addRow(["roster-v1", classId, termId]);
    const guide = exportSheet(book, "Huong dan", ["Hướng dẫn"], [130]);
    [
      "Chỉ điền sheet Danh sach hoc. Mã học viên đã điền sẵn theo lớp; chọn ID lớp học phần từ sheet Lop hoc phan. Có thể thêm dòng khi một học viên học nhiều môn.",
      "Không tự đăng ký tất cả học viên vào mọi môn. Giữ trống ID lớp học phần để bỏ qua dòng; chỉ những dòng điền rõ ID và hồ sơ mới được thêm.",
      "Mẫu chứa đăng ký đã có; dòng không đổi được giữ nguyên, xóa dòng khỏi file không hủy đăng ký.",
      "Lập danh sách theo hồ sơ của cán bộ đào tạo (khác đăng ký tự phục vụ theo thời hạn). Mỗi dòng thêm mới cần lý do từ 10 ký tự và số hồ sơ.",
      "Xem trước và xác nhận nhập danh sách. Sau đó cấu hình quy tắc điểm của lớp học phần, tải mẫu điểm và nhập điểm. Không ghi điểm hoặc thay đổi CTĐT khi lập danh sách.",
    ].forEach((line) => guide.addRow([line]));
    const sampleOffering =
      data.offerings.find((o) => Number(o.capacity) > Number(o.enrolled)) ||
      data.offerings[0];
    addExampleSheet(
      book,
      sheet,
      data.members
        .slice(
          0,
          Math.min(
            2,
            Math.max(
              0,
              Number(sampleOffering.capacity) - Number(sampleOffering.enrolled),
            ),
          ),
        )
        .map((member) => [
          member.studentCode,
          sampleOffering.offeringId,
          "Bổ sung danh sách học theo hồ sơ đào tạo",
          "VD-HS-2026-001",
        ]),
      [
        `ID ${sampleOffering.offeringId} = ${sampleOffering.offeringCode} — ${sampleOffering.courseName}. Đổi ID theo môn học thực tế; tra sheet Lop hoc phan.`,
        "Cột C: lý do 10–700 ký tự. Cột D: số hồ sơ thực tế, không được để trống, tối đa 255 ký tự; VD-HS-2026-001 chỉ là minh họa.",
        "Ví dụ minh họa cách điền, không xác nhận học viên phải học môn này; hệ thống kiểm tra sức chứa và quyền khi nhập sheet chính.",
      ],
    );
    return Buffer.from(await book.xlsx.writeBuffer());
  }
  async import(
    classId: string,
    termId: string,
    file: { buffer: Buffer; size: number; originalname: string } | undefined,
    a: GradeActor,
    apply: boolean,
  ) {
    this.ids(classId, termId);
    if (!a.canPrepare)
      throw new ForbiddenException(
        "Cần quyền REGISTRATION_MANAGE để lập danh sách học.",
      );
    if (
      !file?.buffer?.length ||
      file.size > 5 * 1024 * 1024 ||
      !/\.xlsx$/i.test(file.originalname)
    )
      throw new BadRequestException("Chọn XLSX tối đa 5MB.");
    checkWorkbookArchive(file.buffer);
    const book = new Workbook();
    try {
      await book.xlsx.load(file.buffer as never);
    } catch {
      throw new BadRequestException("Không đọc được Excel.");
    }
    const sheet = book.getWorksheet("Danh sach hoc"),
      meta = book.getWorksheet("_context");
    if (
      !sheet ||
      !meta ||
      meta.getCell("A1").text !== "roster-v1" ||
      meta.getCell("B1").text !== classId ||
      meta.getCell("C1").text !== termId ||
      HEADERS.some((h, i) => sheet.getRow(1).getCell(i + 1).text !== h)
    )
      throw new BadRequestException("File mẫu không đúng lớp/học kỳ.");
    const rows = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      if (!row.hasValues) continue;
      for (let col = 1; col <= 4; col++)
        if (row.getCell(col).type === ValueType.Formula)
          throw new BadRequestException(`Dòng ${i}: không hỗ trợ công thức.`);
      const [studentCode, offeringId, note, reference] = [1, 2, 3, 4].map(
        (col) => row.getCell(col).text.trim(),
      );
      if (!offeringId) continue;
      if (!studentCode || !/^[1-9]\d{0,19}$/.test(offeringId))
        throw new BadRequestException(
          `Dòng ${i}: nhập mã học viên và ID lớp học phần hợp lệ.`,
        );
      rows.push({ studentCode, offeringId, note, reference });
    }
    if (!rows.length)
      throw new BadRequestException(
        "Chưa chọn lớp học phần trong file. Điền ID từ sheet Lop hoc phan trước khi nhập.",
      );
    return this.repository.prepareRegistrations(
      classId,
      termId,
      rows,
      a,
      apply,
    );
  }
}
