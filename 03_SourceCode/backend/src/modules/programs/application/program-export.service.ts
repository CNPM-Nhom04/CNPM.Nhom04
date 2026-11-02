import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Workbook } from "exceljs";
import { exportSheet } from "../../../core/excel/workbook";
import { ProgramActor, ProgramRepository } from "../domain/program";
@Injectable()
export class ProgramExportService {
  constructor(private readonly repository: ProgramRepository) {}
  async export(id: string, trackId: string | undefined, actor: ProgramActor) {
    if (
      !actor.permissions.includes("PROGRAM_READ") ||
      !actor.permissions.includes("PROGRAM_EXPORT")
    )
      throw new ForbiddenException("Cần quyền PROGRAM_READ và PROGRAM_EXPORT.");
    if (
      !/^[1-9]\d{0,19}$/.test(id) ||
      (trackId !== undefined && !/^[1-9]\d{0,19}$/.test(trackId))
    )
      throw new BadRequestException("ID phiên bản/hướng không hợp lệ.");
    const item = await this.repository.exportDetail(id, actor);
    const tracks = trackId
      ? item.tracks.filter((track) => track.id === trackId)
      : item.tracks;
    if (trackId && !tracks.length)
      throw new NotFoundException("Hướng không thuộc phiên bản CTĐT này.");
    const book = new Workbook();
    const info = exportSheet(
      book,
      "Thong tin CTDT",
      ["Tiêu chí", "Giá trị"],
      [40, 95],
    );
    [
      ["ID phiên bản", item.id],
      ["Mã CTĐT", item.maCTDT],
      ["Mã phiên bản", item.maPhienBan],
      ["Tên CTĐT", item.tenCTDT],
      ["Bậc đào tạo", item.levelName],
      ["Ngành", item.majorName],
      ["Đơn vị quản lý", item.unitName],
      ["Trạng thái", item.status],
      ["Niên khóa", item.khoaTuyenSinh],
      ["Định mức chung", item.storedRequiredCredits ?? null],
      ["Hình thức", item.hinhThucDaoTao],
      ["Thời gian đào tạo", item.thoiGianDaoTao],
      ["Hiệu lực từ", item.effectiveFrom],
      ["Hiệu lực đến", item.effectiveTo],
      ["Số quyết định", item.soQuyetDinhBanHanh],
      ["Ngày ban hành", item.ngayBanHanh],
      ["Ngoại ngữ", item.chuanDauRaTiengAnh],
      ["Tin học", item.chuanDauRaTinHoc],
      ["Hướng xuất", trackId ? tracks[0].name : "Tất cả hướng"],
      ["Revision", item.revision],
      [
        "Lưu ý",
        "Tổng TC danh sách bao gồm các lựa chọn tự chọn, có thể lớn hơn định mức hướng. Xuất dữ liệu đã lưu trong SQL.",
      ],
    ].forEach((row) => info.addRow(row));
    const directions = exportSheet(book, "Huong dao tao", [
      "ID hướng",
      "Mã hướng",
      "Tên hướng",
      "Trạng thái",
      "Định mức tín chỉ",
      "Số môn trong danh sách",
      "Tổng TC danh sách",
    ]);
    const groups = exportSheet(
      book,
      "Nhom kien thuc",
      [
        "ID hướng",
        "Mã hướng",
        "Tên hướng",
        "ID nhóm",
        "Mã nhóm",
        "Tên nhóm",
        "Mã nhóm cha",
        "TC tối thiểu",
        "TC tối đa",
      ],
      [20, 24, 35, 20, 20, 50, 25, 22, 22],
    );
    const courses = exportSheet(
      book,
      "Khung hoc phan",
      [
        "ID hướng",
        "Mã hướng",
        "Tên hướng",
        "ID dòng khung",
        "Mã nhóm",
        "Tên nhóm",
        "ID phiên bản học phần",
        "Mã học phần",
        "Tên học phần",
        "Phiên bản học phần",
        "Tín chỉ",
        "Tiết lý thuyết",
        "Tiết thực hành",
        "Tính chất",
        "Học kỳ",
        "Tiên quyết",
        "Ghi chú",
      ],
      [20, 24, 35, 20, 20, 45, 25, 22, 50, 24, 15, 20, 20, 22, 18, 65, 50],
    );
    const prerequisites = exportSheet(
      book,
      "Tien quyet",
      [
        "ID hướng",
        "Mã hướng",
        "ID dòng khung",
        "Mã học phần",
        "ID dòng tiên quyết",
        "Mã môn tiên quyết",
        "Tên môn tiên quyết",
        "Điểm tối thiểu",
      ],
      [20, 24, 22, 22, 25, 25, 55, 22],
    );
    for (const track of tracks) {
      directions.addRow([
        track.id,
        track.code,
        track.name,
        track.status,
        track.requiredCredits,
        track.courses.length,
        track.courses.reduce((sum, c) => sum + c.credits, 0),
      ]);
      for (const group of track.groups)
        groups.addRow([
          track.id,
          track.code,
          track.name,
          group.id,
          group.code,
          group.name,
          track.groups.find((g) => g.id === group.parentId)?.code ?? null,
          group.minimumCredits,
          group.maximumCredits ?? null,
        ]);
      for (const course of track.courses) {
        const group = track.groups.find((g) => g.id === course.groupId);
        courses.addRow([
          track.id,
          track.code,
          track.name,
          course.id,
          group?.code ?? null,
          group?.name ?? null,
          course.courseVersionId,
          course.code,
          course.name,
          course.versionNumber ?? null,
          course.credits,
          course.theoryHours ?? null,
          course.practiceHours ?? null,
          course.requirementType === "REQUIRED" ? "Bắt buộc" : "Tự chọn",
          course.semester,
          course.prerequisites
            ?.map(
              (p) =>
                p.code +
                (p.minimumGrade == null
                  ? ""
                  : " (điểm ≥ " + p.minimumGrade + ")"),
            )
            .join("; ") || null,
          course.notes ?? null,
        ]);
        for (const pre of course.prerequisites || [])
          prerequisites.addRow([
            track.id,
            track.code,
            course.id,
            course.code,
            pre.courseEntryId,
            pre.code,
            pre.name,
            pre.minimumGrade == null ? null : Number(pre.minimumGrade),
          ]);
      }
    }
    return Buffer.from(await book.xlsx.writeBuffer());
  }
}
