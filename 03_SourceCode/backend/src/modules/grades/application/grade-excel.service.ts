import { addExampleSheet } from "../../../core/excel/examples";
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Workbook, ValueType } from "exceljs";
import { GradeActor, GradeRepository } from "../domain/grade";
import { checkWorkbookArchive } from "../../../core/excel/xlsx-archive";
import { exportSheet } from "../../../core/excel/workbook";
const HEADERS = [
  "ID đăng ký",
  "Mã học viên",
  "Họ tên",
  "Mã môn",
  "Tên môn",
  "Lớp học phần",
  "Trạng thái",
  "Chuyên cần",
  "Giữa kỳ",
  "Thi",
  "Lý do thay đổi",
  "Số hồ sơ",
];
@Injectable()
export class GradeExcelService {
  constructor(
    private readonly repository: GradeRepository,
    private readonly config: ConfigService,
  ) {}
  private sign(value: string) {
    const key = this.config.get<string>("JWT_SECRET");
    if (!key)
      throw new ServiceUnavailableException(
        "Chưa cấu hình khóa xác thực file Excel.",
      );
    return createHmac("sha256", key)
      .update("grade-excel-v1:" + value)
      .digest("hex");
  }
  private context(classId: string, termId: string, a: GradeActor) {
    if (![classId, termId].every((id) => /^[1-9]\d{0,19}$/.test(id || "")))
      throw new BadRequestException("Chọn lớp và học kỳ hợp lệ.");
    return `${a.id}:${classId}:${termId}`;
  }
  options(a: GradeActor) {
    return this.repository.excelOptions(a);
  }
  rows(classId: string, termId: string, a: GradeActor) {
    this.context(classId, termId, a);
    return this.repository.excelRows(classId, termId, a);
  }
  sheetCourses(classId: string, termId: string, a: GradeActor) {
    this.context(classId, termId, a);
    return this.repository.sheetCourses(classId, termId, a);
  }
  openSheet(
    classId: string,
    termId: string,
    courseVersionId: string,
    a: GradeActor,
  ) {
    this.context(classId, termId, a);
    return this.repository.openSheet(classId, termId, courseVersionId, a);
  }
  completeSheet(
    classId: string,
    termId: string,
    courseVersionId: string,
    reason: { note: string; reference: string },
    a: GradeActor,
  ) {
    this.context(classId, termId, a);
    return this.repository.completeSheet(
      classId,
      termId,
      courseVersionId,
      reason,
      a,
    );
  }
  private courseContext(
    classId: string,
    termId: string,
    a: GradeActor,
    courseVersionId?: string,
  ) {
    if (courseVersionId && !/^[1-9]\d{0,19}$/.test(courseVersionId))
      throw new BadRequestException("Chọn môn học hợp lệ.");
    return (
      this.context(classId, termId, a) +
      (courseVersionId ? ":course:" + courseVersionId : "")
    );
  }
  async template(
    classId: string,
    termId: string,
    a: GradeActor,
    courseVersionId?: string,
  ) {
    const context = this.courseContext(classId, termId, a, courseVersionId);
    const rows = (await this.repository.excelRows(classId, termId, a)).filter(
      (row) => !courseVersionId || row.courseVersionId === courseVersionId,
    );
    if (!rows.length)
      throw new BadRequestException(
        "Chưa có học viên cho môn trong học kỳ này. Bấm tải mẫu để hệ thống chuẩn bị bảng điểm.",
      );
    if (rows.length > 5000)
      throw new BadRequestException("Tối đa 5000 dòng mỗi file.");
    const book = new Workbook();
    const sheet = exportSheet(
      book,
      "Bang diem",
      HEADERS,
      [20, 22, 35, 20, 40, 25, 18, 18, 18, 18, 55, 30],
    );
    const meta = book.addWorksheet("_snapshot", { state: "veryHidden" });
    meta.addRow(["grade-excel-v1", context]);
    for (const row of rows) {
      sheet.addRow([
        row.registrationId,
        row.studentCode,
        row.studentName,
        row.courseCode,
        row.courseName,
        row.offeringCode,
        row.state,
        row.attendanceScore,
        row.midtermScore,
        row.examScore,
        "",
        "",
      ]);
      const json = JSON.stringify(row);
      meta.addRow([row.registrationId, json, this.sign(context + ":" + json)]);
    }
    const guide = exportSheet(
      book,
      "Huong dan",
      ["Nội dung", "Hướng dẫn"],
      [30, 110],
    );
    guide.addRows([
      [
        "Dữ liệu mẫu",
        "Bao gồm toàn bộ dữ liệu hiện có của lớp/học kỳ. Chỉ sửa 3 cột điểm, lý do và số hồ sơ; không sửa thông tin định danh.",
      ],
      [
        "Thay đổi",
        "Hệ thống chỉ ghi các ô khác với bản trong file mẫu; dòng không đổi không tăng phiên bản. Bỏ dòng khỏi file không xóa điểm.",
      ],
      [
        "Ô trống",
        "Ô trống là chưa có điểm, khác điểm 0. Xóa điểm đang có bằng cách để trống ô tương ứng.",
      ],
      [
        "Lý do/hồ sơ",
        "Dòng thay đổi cần lý do từ 10 ký tự và số hồ sơ. Điểm đã chốt giữ trạng thái và tính lại theo quy tắc cũ.",
      ],
      [
        "Xung đột",
        "Nếu cùng ô đã được người khác sửa, toàn bộ file bị từ chối. Thay đổi ở ô khác được giữ lại.",
      ],
      [
        "Lịch sử/hủy",
        "Dòng LEGACY/VOIDED chỉ đọc; không tự chuyển thành điểm thành phần.",
      ],
    ]);
    const exampleRows = rows
      .filter(
        (row) =>
          row.registrationStatus === "REGISTERED" &&
          !["LEGACY", "VOIDED"].includes(row.state),
      )
      .slice(0, 2);
    addExampleSheet(
      book,
      sheet,
      exampleRows.map((row) => [
        row.registrationId,
        row.studentCode,
        row.studentName,
        row.courseCode,
        row.courseName,
        row.offeringCode,
        row.state,
        8,
        7.5,
        9,
        "Bổ sung điểm theo hồ sơ đào tạo",
        "VD-HS-2026-001",
      ]),
      [
        "Chỉ sửa Chuyên cần, Giữa kỳ, Thi, Lý do thay đổi và Số hồ sơ tại sheet Bang diem. Giữ nguyên các cột định danh và trạng thái, không xóa sheet _snapshot.",
        "Điểm 8 / 7.5 / 9 chỉ minh họa định dạng 0–10, tối đa 2 số lẻ; thay bằng điểm thực tế. Ô trống khác 0. Số hồ sơ VD-HS-2026-001 phải thay bằng hồ sơ thật.",
        "Nếu chỉ sửa điểm Thi: giữ nguyên hai ô điểm khác từ mẫu cũ, sửa ô Thi và bổ sung lý do/số hồ sơ; chỉ các ô khác biệt được cập nhật.",
        ...(!exampleRows.length
          ? [
              "Chưa có dòng điểm thành phần đủ điều kiện minh họa; không chuyển điểm LEGACY/VOIDED thành điểm mới.",
            ]
          : []),
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
    courseVersionId?: string,
  ) {
    const context = this.courseContext(classId, termId, a, courseVersionId);
    if (
      !file?.buffer?.length ||
      file.size > 5 * 1024 * 1024 ||
      !/\.xlsx$/i.test(file.originalname)
    )
      throw new BadRequestException("Chọn file XLSX tối đa 5MB.");
    checkWorkbookArchive(file.buffer);
    const book = new Workbook();
    try {
      await book.xlsx.load(file.buffer as never);
    } catch {
      throw new BadRequestException("Không đọc được Excel.");
    }
    const sheet = book.getWorksheet("Bang diem"),
      meta = book.getWorksheet("_snapshot");
    if (
      !sheet ||
      !meta ||
      meta.getCell("A1").text !== "grade-excel-v1" ||
      meta.getCell("B1").text !== context ||
      HEADERS.some((h, i) => sheet.getRow(1).getCell(i + 1).text !== h)
    )
      throw new BadRequestException(
        "File mẫu không đúng tài khoản/lớp/học kỳ.",
      );
    const snapshots = new Map<string, any>();
    for (let i = 2; i <= meta.rowCount; i++) {
      const row = meta.getRow(i),
        id = row.getCell(1).text,
        json = row.getCell(2).text,
        signature = row.getCell(3).text;
      const expected = this.sign(context + ":" + json);
      if (
        !/^[a-f0-9]{64}$/.test(signature) ||
        !timingSafeEqual(Buffer.from(expected), Buffer.from(signature)) ||
        snapshots.has(id)
      )
        throw new BadRequestException(
          "Bản dữ liệu gốc trong file đã bị thay đổi.",
        );
      try {
        const original = JSON.parse(json);
        if (original.registrationId !== id) throw Error();
        snapshots.set(id, original);
      } catch {
        throw new BadRequestException("Bản gốc không hợp lệ.");
      }
    }
    const seen = new Set<string>(),
      rows = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      if (!row.hasValues) continue;
      const original = snapshots.get(row.getCell(1).text);
      const fail = (message: string): never => {
        throw new BadRequestException(`Dòng ${i}: ${message}`);
      };
      if (!original || seen.has(original.registrationId))
        fail("Đăng ký không thuộc file mẫu hoặc bị lặp.");
      seen.add(original.registrationId);
      for (let col = 1; col <= 12; col++)
        if (row.getCell(col).type === ValueType.Formula)
          fail("Không hỗ trợ công thức.");
      const identity = [
        original.registrationId,
        original.studentCode,
        original.studentName,
        original.courseCode,
        original.courseName,
        original.offeringCode,
        original.state,
      ];
      if (identity.some((v, j) => row.getCell(j + 1).text !== String(v ?? "")))
        fail("Không được sửa thông tin định danh/trạng thái.");
      const values: any = {};
      for (const [j, key] of [
        "attendanceScore",
        "midtermScore",
        "examScore",
      ].entries()) {
        const text = row
          .getCell(j + 8)
          .text.trim()
          .replace(",", ".");
        if (text && (!/^\d+(?:\.\d{1,2})?$/.test(text) || Number(text) > 10))
          fail("Điểm phải từ 0 đến 10, tối đa 2 số lẻ.");
        values[key] = text ? Number(text) : null;
      }
      const note = row.getCell(11).text.trim(),
        reference = row.getCell(12).text.trim();
      if (note.length > 1000 || reference.length > 255)
        fail("Lý do/số hồ sơ quá dài.");
      rows.push({
        registrationId: original.registrationId,
        original,
        values,
        note,
        reference,
      });
    }
    if (!rows.length) throw new BadRequestException("Tệp không có dòng điểm.");
    return this.repository.importRows(classId, termId, rows, a, apply);
  }
}
