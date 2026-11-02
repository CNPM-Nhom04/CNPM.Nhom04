import { Injectable } from "@nestjs/common";
import { Workbook } from "exceljs";
import { exportSheet } from "../../../core/excel/workbook";
import { CourseActor, CourseQuery, CourseRepository } from "../domain/course";
@Injectable()
export class CourseExportService {
  constructor(private readonly repository: CourseRepository) {}
  async export(query: CourseQuery, actor: CourseActor) {
    const result = await this.repository.list(query, actor, true);
    const book = new Workbook();
    const info = exportSheet(book, "Bo loc", ["Tiêu chí", "Giá trị"], [35, 90]);
    [
      ["Từ khóa", query.search || ""],
      ["Trạng thái", query.status || "ALL"],
      ["ID đơn vị", query.unitId || ""],
      ["Số học phần", result.data.length],
      ["Phạm vi", "Theo quyền SQL của tài khoản xuất"],
      [
        "Phiên bản",
        "Cột phiên bản mới nhất và phiên bản ACTIVE tách riêng, giống danh sách",
      ],
      [
        "Phân trang",
        "Xuất tất cả kết quả khớp bộ lọc, không giới hạn trang đang xem",
      ],
    ].forEach((row) => info.addRow(row));
    const sheet = exportSheet(
      book,
      "Danh muc hoc phan",
      [
        "Mã học phần",
        "Tên phiên bản mới nhất",
        "Tên tiếng Anh",
        "Số phiên bản mới nhất",
        "Trạng thái phiên bản",
        "Tín chỉ mới nhất",
        "Tiết lý thuyết",
        "Tiết thực hành",
        "Mã đơn vị",
        "Tên đơn vị",
        "Trạng thái học phần",
        "Hiệu lực từ",
        "Hiệu lực đến",
        "Phiên bản ACTIVE",
        "Tên bản ACTIVE",
        "Tín chỉ ACTIVE",
        "Mô tả",
      ],
      [22, 50, 45, 24, 24, 20, 20, 20, 20, 50, 24, 20, 20, 24, 50, 20, 70],
    );
    result.data.forEach((row) =>
      sheet.addRow([
        row.courseCode,
        row.courseName,
        row.englishName,
        row.versionNo,
        row.versionStatus,
        row.credits,
        row.theoryHours,
        row.practiceHours,
        row.unitCode,
        row.unitName,
        row.status,
        row.effectiveFrom,
        row.effectiveTo,
        row.activeVersionNo,
        row.activeCourseName,
        row.activeCredits,
        row.description,
      ]),
    );
    return Buffer.from(await book.xlsx.writeBuffer());
  }
}
