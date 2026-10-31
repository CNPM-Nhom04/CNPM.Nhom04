import { Injectable } from "@nestjs/common";
import { Workbook } from "exceljs";
import {
  ComparisonCourse,
  ComparisonRepository,
  Difference,
} from "../domain/comparison";
import { compareSnapshots } from "../domain/compare";
import { ComparisonDto, ComparisonOptionsDto } from "./comparison.dto";
export const DIFFERENCE_LABELS = {
  SAME: "Giữ nguyên",
  CHANGED: "Thay đổi",
  ONLY_A: "Chỉ có ở A",
  ONLY_B: "Chỉ có ở B",
};
const LABELS: Record<string, string> = {
  programCode: "Mã CTĐT",
  programName: "Tên CTĐT",
  versionCode: "Phiên bản",
  status: "Trạng thái",
  cohortYear: "Năm tuyển sinh",
  unitName: "Đơn vị quản lý",
  levelName: "Bậc đào tạo",
  majorName: "Ngành",
  trackCode: "Mã hướng",
  trackName: "Tên hướng",
  trackStatus: "Trạng thái hướng",
  requiredCredits: "Định mức TC hướng",
  versionRequiredCredits: "Định mức TC chung",
  studyForm: "Hình thức",
  duration: "Thời gian đào tạo",
  cohortLabel: "Khóa áp dụng",
  languageRequirement: "Chuẩn ngoại ngữ",
  itRequirement: "Chuẩn tin học",
  effectiveFrom: "Hiệu lực từ",
  effectiveTo: "Hiệu lực đến",
  name: "Tên",
  englishName: "Tên tiếng Anh",
  versionNumber: "Phiên bản học phần",
  courseVersionId: "ID phiên bản học phần",
  code: "Mã",
  credits: "Tín chỉ",
  theoryHours: "Giờ lý thuyết",
  practiceHours: "Giờ thực hành",
  description: "Mô tả",
  groupCode: "Mã nhóm",
  requirementType: "Bắt buộc/tự chọn",
  semester: "Học kỳ",
  notes: "Ghi chú",
  prerequisites: "Tiên quyết",
  ploMappings: "Ánh xạ PLO",
  parentCode: "Nhóm cha",
  minimumCredits: "TC tối thiểu",
  maximumCredits: "TC tối đa",
};
function cell(key: string, value: unknown): string | number {
  if (value == null) return "";
  if (key === "requirementType")
    return value === "REQUIRED" ? "Bắt buộc" : "Tự chọn";
  if (key === "prerequisites")
    return (value as ComparisonCourse["prerequisites"])
      .map(
        (x) =>
          x.code +
          (x.minimumGrade == null
            ? ""
            : " (điểm tối thiểu: " + x.minimumGrade + ")"),
      )
      .join("; ");
  if (key === "ploMappings")
    return (value as ComparisonCourse["ploMappings"])
      .map(
        (x) =>
          x.code +
          ": " +
          x.description +
          " [" +
          x.status +
          "] — " +
          (x.contributionLevel ?? ""),
      )
      .join("\n");
  return typeof value === "number" ? value : String(value);
}
@Injectable()
export class ComparisonService {
  constructor(private readonly repository: ComparisonRepository) {}
  options(actorId: string, query: ComparisonOptionsDto) {
    return this.repository.options(actorId, query);
  }
  async compare(actorId: string, query: ComparisonDto) {
    const [a, b] = await this.repository.snapshots(
      actorId,
      query.versionA,
      query.trackA,
      query.versionB,
      query.trackB,
    );
    return compareSnapshots(a, b);
  }
  async export(actorId: string, query: ComparisonDto) {
    const result = await this.compare(actorId, query);
    const workbook = new Workbook();
    workbook.creator = "CTDT System";
    // Each field has separate A/B columns. Strings are text cells, never formulas.
    // Split strings longer than Excel's cell limit into continuation rows, preserving all content.
    const add = (
      name: string,
      headers: string[],
      rows: (string | number)[][],
    ) => {
      const sheet = workbook.addWorksheet(name);
      sheet.addRow(headers);
      for (const row of rows) {
        const chunks = row.map((value) =>
          typeof value === "string"
            ? value.match(/[\s\S]{1,32000}/g) || [""]
            : [value],
        );
        for (let i = 0; i < Math.max(...chunks.map((x) => x.length)); i++)
          sheet.addRow(
            chunks.map(
              (part, column) => part[i] ?? (column < 3 ? row[column] : ""),
            ),
          );
      }
      sheet.getRow(1).font = { bold: true };
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      sheet.columns.forEach((column) => (column.width = 25));
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: headers.length },
      };
    };
    const summaryKeys = [
      "programCode",
      "programName",
      "versionCode",
      "status",
      "cohortYear",
      "unitName",
      "levelName",
      "majorName",
      "trackCode",
      "trackName",
      "trackStatus",
      "requiredCredits",
      "versionRequiredCredits",
      "studyForm",
      "duration",
      "cohortLabel",
      "languageRequirement",
      "itRequirement",
      "effectiveFrom",
      "effectiveTo",
    ];
    add(
      "Tong quan",
      ["Tiêu chí", "A", "B"],
      [
        ...summaryKeys.map((key) => [
          LABELS[key],
          cell(key, result.a[key]),
          cell(key, result.b[key]),
        ]),
        [
          "Số học phần trong hướng",
          result.a.courses.length,
          result.b.courses.length,
        ],
        [
          "Tổng TC danh sách (gồm toàn bộ tự chọn)",
          result.summary.listedCreditsA,
          result.summary.listedCreditsB,
        ],
        [
          "Lưu ý",
          "Tổng TC danh sách không phải định mức phải tích lũy. Ô trống là chưa có dữ liệu.",
          "So sánh cấu trúc không xác nhận tương đương tín chỉ.",
        ],
      ],
    );
    const details = <T extends object>(
      name: string,
      rows: Difference<T>[],
      keys: string[],
    ) => {
      add(
        name,
        [
          "Mã",
          "Kết quả",
          "Trường thay đổi",
          ...keys.flatMap((key) => [
            (LABELS[key] || key) + " A",
            (LABELS[key] || key) + " B",
          ]),
        ],
        rows.map((row) => [
          String(row.a?.["code"] || row.b?.["code"] || row.key),
          DIFFERENCE_LABELS[row.status],
          row.changedFields.map((key) => LABELS[key] || key).join(", "),
          ...keys.flatMap((key) => [
            cell(key, row.a?.[key]),
            cell(key, row.b?.[key]),
          ]),
        ]),
      );
    };
    details("Hoc phan", result.courses, [
      "name",
      "englishName",
      "versionNumber",
      "courseVersionId",
      "credits",
      "theoryHours",
      "practiceHours",
      "groupCode",
      "requirementType",
      "semester",
      "description",
      "notes",
      "prerequisites",
      "ploMappings",
    ]);
    details("Nhom kien thuc", result.groups, [
      "name",
      "parentCode",
      "minimumCredits",
      "maximumCredits",
    ]);
    details("Chuan dau ra", result.outcomes, ["description", "status"]);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
