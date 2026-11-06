import { addExampleSheet } from "../../../core/excel/examples";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Workbook, ValueType } from "exceljs";
import { checkWorkbookArchive } from "../../../core/excel/xlsx-archive";
import { exportSheet } from "../../../core/excel/workbook";
import {
  ProgramActor,
  ProgramRepository,
  ProgramTrack,
} from "../domain/program";
import { ProgramUpload } from "./program.service";

const headers = ["Mã học phần", "Mã nhóm", "Tín chỉ", "Tính chất", "Học kỳ"];
const normalize = (value: string) => value.trim().toLocaleUpperCase("vi");
@Injectable()
export class ProgramImportService {
  constructor(private readonly repository: ProgramRepository) {}
  private async track(id: string, trackId: string, actor: ProgramActor) {
    if (!actor.permissions.includes("PROGRAM_EDIT"))
      throw new ForbiddenException();
    if (!/^[1-9]\d{0,19}$/.test(id) || !/^[1-9]\d{0,19}$/.test(trackId || ""))
      throw new BadRequestException("ID phiên bản/hướng không hợp lệ.");
    const program = await this.repository.detail(id, actor);
    const track = program.tracks.find((item) => item.id === trackId);
    if (
      program.sourceReadOnly ||
      !["DRAFT", "RETURNED"].includes(program.status) ||
      !track ||
      track.status === "INACTIVE"
    )
      throw new BadRequestException(
        "Chỉ nhập vào hướng đang hoạt động của CTĐT được phép sửa.",
      );
    return { program, track };
  }
  async template(id: string, trackId: string, actor: ProgramActor) {
    const { track, program } = await this.track(id, trackId, actor);
    let source = track;
    if (!track.courses.length && program.sourceVersionId) {
      const previous = await this.repository.detail(
        program.sourceVersionId,
        actor,
      );
      source =
        previous.tracks.find((item) => item.code === track.code) || track;
    }
    const book = new Workbook();
    const courses = exportSheet(
      book,
      "Nhap hoc phan",
      headers,
      [25, 20, 15, 22, 15],
    );
    for (const course of source.courses)
      courses.addRow([
        course.code,
        source.groups.find((g) => g.id === course.groupId)?.code || "",
        course.credits,
        course.requirementType === "REQUIRED" ? "Bắt buộc" : "Tự chọn",
        course.semester,
      ]);
    const quotas = exportSheet(
      book,
      "Dinh muc nhom",
      ["Mã nhóm", "Tín chỉ tối thiểu"],
      [25, 25],
    );
    for (const group of track.groups)
      quotas.addRow([
        group.code,
        source.courses.length
          ? (source.groups.find((g) => g.code === group.code)?.minimumCredits ??
            group.minimumCredits)
          : null,
      ]);
    const lookup = exportSheet(
      book,
      "Danh sach chon",
      [
        "Mã học phần",
        "Tên học phần",
        "Tín chỉ",
        "Phiên bản",
        "Mã nhóm",
        "Tên nhóm",
      ],
      [25, 60, 15, 20, 20, 45],
    );
    const catalog: {
      code: string;
      name: string;
      credits: number;
      id: string;
    }[] = [];
    for (let page = 1; ; page++) {
      const result = (await this.repository.catalog(
        { page, limit: 100 },
        actor,
      )) as { data: typeof catalog; meta?: { totalPages: number } };
      catalog.push(...result.data);
      if (catalog.length > 5000)
        throw new BadRequestException(
          "Ngân hàng vượt 5000 phiên bản; cần thu hẹp phạm vi trước khi xuất mẫu.",
        );
      if (!result.meta || page >= result.meta.totalPages) break;
    }
    for (
      let index = 0;
      index < Math.max(catalog.length, track.groups.length);
      index++
    ) {
      const course = catalog[index],
        group = track.groups[index];
      lookup.addRow([
        course?.code || "",
        course?.name || "",
        course?.credits ?? "",
        course?.id || "",
        group?.code || "",
        group?.name || "",
      ]);
    }
    if (catalog.length)
      book.definedNames.add(
        `'Danh sach chon'!$A$2:$A$${catalog.length + 1}`,
        "MaHocPhan",
      );
    if (track.groups.length)
      book.definedNames.add(
        `'Danh sach chon'!$E$2:$E$${track.groups.length + 1}`,
        "NhomKienThuc",
      );
    const validationLastRow = Math.min(
      1001,
      Math.max(21, courses.rowCount + 20),
    );
    for (let row = 2; row <= validationLastRow; row++) {
      if (catalog.length)
        courses.getCell(row, 1).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ["MaHocPhan"],
        };
      if (track.groups.length)
        courses.getCell(row, 2).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ["NhomKienThuc"],
        };
      courses.getCell(row, 4).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Bắt buộc,Tự chọn"'],
      };
    }
    const guide = exportSheet(
      book,
      "Huong dan",
      ["Nội dung", "Hướng dẫn"],
      [30, 100],
    );
    guide.addRows([
      [
        "Mã học phần",
        "Chọn mã từ danh sách trong ô hoặc tra sheet Danh sach chon. Danh sách theo phạm vi ngân hàng; cán bộ đối chiếu môn với ngành và hồ sơ CTĐT. Mỗi môn chỉ xuất hiện một lần.",
      ],
      ["Mã nhóm", track.groups.map((g) => `${g.code}: ${g.name}`).join("; ")],
      [
        "Tín chỉ",
        "Có thể để trống để lấy từ ngân hàng; nếu nhập phải khớp phiên bản học phần.",
      ],
      ["Tính chất", "Bắt buộc hoặc Tự chọn; bỏ trống mặc định Bắt buộc."],
      ["Học kỳ", "Số nguyên 1–30 hoặc để trống."],
      [
        "Định mức nhóm",
        "Sửa trong sheet Dinh muc nhom; để trống để tự cộng theo học phần.",
      ],
      [
        "Áp dụng",
        "Xem trước rồi áp dụng để thêm/cập nhật môn trong hướng đang xem. Các môn khác được giữ lại.",
      ],
    ]);
    addExampleSheet(
      book,
      courses,
      source.courses
        .slice(0, 2)
        .map((course) => [
          course.code,
          source.groups.find((g) => g.id === course.groupId)?.code || "",
          course.credits,
          course.requirementType === "REQUIRED" ? "Bắt buộc" : "Tự chọn",
          course.semester || 1,
        ]),
      [
        "Mẫu minh họa dùng học phần đã có trong hướng/phiên bản nguồn. Nhập tại sheet Nhap hoc phan; mã môn, nhóm và tín chỉ phải khớp dữ liệu của CTĐT.",
        "Tính chất: Bắt buộc hoặc Tự chọn; học kỳ: số nguyên 1–30 hoặc trống. Mỗi môn một dòng, không lặp mã.",
        "Định mức nhóm sửa ở sheet Dinh muc nhom: ví dụ Mã nhóm A, Tín chỉ tối thiểu 3 (chỉ minh họa định dạng, phải chọn định mức thật của hướng). Để trống để cộng từ học phần.",
        ...(!source.courses.length
          ? [
              "CTĐT/phiên bản nguồn chưa có học phần để minh họa đúng ngành. Chọn mã thực tế từ ngân hàng học phần rồi điền theo các cột trên; không tự đặt mã môn.",
            ]
          : []),
      ],
    );
    return Buffer.from(await book.xlsx.writeBuffer());
  }
  async preview(
    id: string,
    trackId: string,
    file: ProgramUpload | undefined,
    actor: ProgramActor,
  ) {
    const { track, program } = await this.track(id, trackId, actor);
    if (
      !file?.buffer?.length ||
      file.size > 5 * 1024 * 1024 ||
      !/\.xlsx$/i.test(file.originalname)
    )
      throw new BadRequestException("Chọn tệp .xlsx có nội dung, tối đa 5MB.");
    checkWorkbookArchive(file.buffer);
    const book = new Workbook();
    try {
      await book.xlsx.load(file.buffer as never);
    } catch {
      throw new BadRequestException("Không đọc được tệp Excel.");
    }
    const sheet = book.getWorksheet("Nhap hoc phan");
    if (
      !sheet ||
      headers.some(
        (h, i) =>
          sheet
            .getRow(1)
            .getCell(i + 1)
            .text.trim() !== h,
      )
    )
      throw new BadRequestException(
        "Tệp không đúng định dạng. Hãy tải file mẫu.",
      );
    if (sheet.rowCount > 1001)
      throw new BadRequestException("Tối đa 1000 học phần mỗi lần nhập.");
    const minimums: { id: string; minimumCredits: number }[] = [];
    const quotaSheet = book.getWorksheet("Dinh muc nhom");
    if (quotaSheet) {
      const seen = new Set<string>();
      for (let i = 2; i <= quotaSheet.rowCount; i++) {
        const row = quotaSheet.getRow(i);
        if (!row.hasValues) continue;
        const code = row.getCell(1).text.trim(),
          raw = row.getCell(2).text.trim().replace(",", ".");
        const group = track.groups.find(
          (g) => normalize(g.code) === normalize(code),
        );
        if (!raw && group && !seen.has(group.id)) {
          seen.add(group.id);
          continue;
        }
        if (
          !group ||
          seen.has(group.id) ||
          !/^\d+(?:\.\d{1,2})?$/.test(raw) ||
          Number(raw) > 9999 ||
          row.getCell(2).type === ValueType.Formula ||
          (group.maximumCredits != null && Number(raw) > group.maximumCredits)
        )
          throw new BadRequestException(
            `Định mức nhóm dòng ${i} không hợp lệ.`,
          );
        seen.add(group.id);
        minimums.push({ id: group.id, minimumCredits: Number(raw) });
      }
    }
    const courses: ProgramTrack["courses"] = [];
    const issues: string[] = [];
    const seen = new Set<string>();
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const cells = headers.map((_, i) => row.getCell(i + 1).text.trim());
      if (cells.every((v) => !v)) continue;
      const [code, groupCode, credits, type, semester] = cells;
      const fail = (message: string) =>
        issues.push(`Dòng ${rowNumber}: ${message}`);
      if (
        headers.some((_, i) => row.getCell(i + 1).type === ValueType.Formula)
      ) {
        fail("Không hỗ trợ công thức.");
        continue;
      }
      if (!code || seen.has(normalize(code))) {
        fail("Mã học phần trống hoặc bị lặp.");
        continue;
      }
      seen.add(normalize(code));
      const group = track.groups.find(
        (g) => normalize(g.code) === normalize(groupCode),
      );
      if (!group) {
        fail(`Nhóm ${groupCode || "(trống)"} không thuộc hướng.`);
        continue;
      }
      const result = (await this.repository.catalog(
        { searchTerm: code, page: 1, limit: 100 },
        actor,
      )) as {
        data: {
          id: string;
          courseId: string;
          code: string;
          name: string;
          credits: number;
          theoryHours: number;
          practiceHours: number;
        }[];
      };
      const existing = track.courses.find(
        (c) => normalize(c.code) === normalize(code),
      );
      const candidates = result.data.filter(
        (c) => normalize(c.code) === normalize(code),
      );
      const course =
        existing ||
        (candidates.length === 1
          ? { ...candidates[0], courseVersionId: candidates[0].id }
          : null);
      if (!course) {
        fail(
          `Không xác định được phiên bản môn ${code}; kiểm tra ngân hàng học phần.`,
        );
        continue;
      }
      if (
        credits &&
        (!Number.isFinite(Number(credits.replace(",", "."))) ||
          Math.abs(Number(credits.replace(",", ".")) - course.credits) > 0.0001)
      ) {
        fail(`Tín chỉ ${code} phải bằng ${course.credits}.`);
        continue;
      }
      const requirement = normalize(type);
      if (
        requirement &&
        !["BẮT BUỘC", "TỰ CHỌN", "REQUIRED", "ELECTIVE"].includes(requirement)
      ) {
        fail("Tính chất phải là Bắt buộc hoặc Tự chọn.");
        continue;
      }
      if (
        semester &&
        (!/^\d+$/.test(semester) ||
          Number(semester) < 1 ||
          Number(semester) > 30)
      ) {
        fail("Học kỳ phải từ 1 đến 30.");
        continue;
      }
      courses.push({
        ...course,
        id: existing?.id || `new-${course.courseVersionId}`,
        groupId: group.id,
        requirementType: ["TỰ CHỌN", "ELECTIVE"].includes(requirement)
          ? "ELECTIVE"
          : "REQUIRED",
        semester: semester ? Number(semester) : null,
      });
    }
    const incoming = new Set(courses.map((course) => course.courseId));
    const merged = [
      ...track.courses.filter((course) => !incoming.has(course.courseId)),
      ...courses,
    ];
    function groupTotal(groupId: string, visiting = new Set<string>()): number {
      if (visiting.has(groupId))
        throw new BadRequestException("Nhóm kiến thức tạo vòng lặp.");
      const next = new Set(visiting).add(groupId);
      return (
        merged
          .filter((course) => course.groupId === groupId)
          .reduce((sum, course) => sum + Math.round(course.credits * 100), 0) +
        track.groups
          .filter((group) => group.parentId === groupId)
          .reduce((sum, group) => sum + groupTotal(group.id, next), 0)
      );
    }
    const groups = track.groups.map((group) => ({
      code: group.code,
      credits: groupTotal(group.id) / 100,
    }));
    for (const group of track.groups) {
      if (
        group.maximumCredits != null &&
        groupTotal(group.id) > Math.round(group.maximumCredits * 100)
      )
        issues.push(
          `Nhóm ${group.code}: sau khi nhập vượt giới hạn ${group.maximumCredits} TC.`,
        );
    }
    if (!courses.length && !issues.length) issues.push("Tệp chưa có học phần.");
    return {
      revision: program.revision,
      trackId: track.id,
      groups,
      minimums,
      courses,
      issues,
      valid: !issues.length,
    };
  }
}
