import { addExampleSheet } from "../../../core/excel/examples";
import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Workbook } from "exceljs";
import { Actor, AdminRepository } from "../domain/admin.repository";
import { importPreview } from "../domain/major-import";
import { MAJOR_HEADERS, parseMajorWorkbook } from "./major-import.parser";
export interface MajorUpload {
  originalname: string;
  buffer: Buffer;
}
@Injectable()
export class MajorImportService {
  constructor(private readonly repository: AdminRepository) {}
  limits() {
    return this.repository.majorImportLimits();
  }
  async template() {
    const [limits, options] = await Promise.all([
      this.limits(),
      this.repository.majorOptions(),
    ]);
    const book = new Workbook();
    const sheet = book.addWorksheet("Nganh dao tao");
    sheet.addRow(MAJOR_HEADERS);
    sheet.columns = [
      { width: 22 },
      { width: 48 },
      { width: 28 },
      { width: 18 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    for (let i = 1; i <= 4; i++) sheet.getColumn(i).numFmt = "@";
    for (let row = 2; row <= Math.min(limits.maxRows + 1, 1001); row++)
      sheet.getCell(row, 4).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: ['"ACTIVE,INACTIVE"'],
        showErrorMessage: true,
        error: "Chọn ACTIVE hoặc INACTIVE",
      };
    const units = book.addWorksheet("Don vi tu CSDL");
    units.addRow(["Mã đơn vị", "Tên đơn vị"]);
    options.units.forEach((unit) => units.addRow([unit.code, unit.name]));
    units.columns = [{ width: 25 }, { width: 65 }];
    const previous = book.addWorksheet("Du lieu hien co");
    previous.addRow(MAJOR_HEADERS);
    previous.columns = [
      { width: 22 },
      { width: 48 },
      { width: 28 },
      { width: 18 },
    ];
    for (let page = 1; ; page++) {
      const result = await this.repository.listMajors({
        page,
        limit: 100,
        searchTerm: "",
        status: "ALL",
        unitId: "",
      });
      for (const major of result.data)
        previous.addRow([
          major.majorCode,
          major.majorName,
          major.unitCode,
          major.status,
        ]);
      if (page >= result.meta.totalPages) break;
    }
    const guide = book.addWorksheet("Huong dan");
    [
      "Mẫu chứa danh mục phiên bản hiện có trong sheet Du lieu hien co để đối chiếu; sheet này không bị ghi đè khi thêm mới.",
      "Nhập ngành mới vào sheet Nganh dao tao, giữ nguyên bốn tiêu đề. Sửa ngành có sẵn bằng chức năng sửa qua Excel của từng ngành.",
      "Mã đơn vị quản lý: lấy từ sheet Don vi tu CSDL. Backend kiểm tra lại CSDL khi lưu.",
      "Chỉ thêm ngành mới; mã đã có không bị ghi đè. Mã có số 0 đầu phải giữ định dạng Text.",
      "Trạng thái: ACTIVE (hoạt động) hoặc INACTIVE (ngừng sử dụng). Không dùng công thức.",
      `Tối đa ${limits.maxRows} dòng, ${limits.maxFileBytes / 1024 / 1024} MB. Toàn bộ file chỉ lưu khi không có dòng lỗi.`,
    ].forEach((line) => guide.addRow([line]));
    guide.getColumn(1).width = 120;
    addExampleSheet(
      book,
      sheet,
      options.units.length
        ? [["VD_NGANH_001", "Ngành minh họa", options.units[0].code, "ACTIVE"]]
        : [],
      [
        "Nhập ngành mới tại sheet Nganh dao tao. Mã ngành VD_NGANH_001 và tên ngành chỉ minh họa; thay bằng mã/tên ngành thực tế chưa tồn tại.",
        "Mã đơn vị phải lấy từ sheet Don vi tu CSDL; trạng thái chỉ ACTIVE hoặc INACTIVE. Không dùng tên đơn vị thay cho mã.",
        ...(!options.units.length
          ? [
              "Chưa có đơn vị quản lý hợp lệ; cấu hình khoa trước khi nhập ngành.",
            ]
          : []),
      ],
    );
    return Buffer.from(await book.xlsx.writeBuffer());
  }
  private async parse(file?: MajorUpload) {
    if (!file || !/\.xlsx$/i.test(file.originalname))
      throw new BadRequestException("Chọn file .xlsx theo mẫu.");
    const limits = await this.limits();
    if (file.buffer.length > limits.maxFileBytes)
      throw new PayloadTooLargeException(
        "File vượt giới hạn dung lượng trong CSDL.",
      );
    const rows = await parseMajorWorkbook(file.buffer, limits.maxRows);
    const fileHash = createHash("sha256").update(file.buffer).digest("hex");
    return { rows, fileHash };
  }
  async preview(file?: MajorUpload) {
    const parsed = await this.parse(file);
    return importPreview(
      await this.repository.checkMajorImport(parsed.rows),
      parsed.fileHash,
    );
  }
  async commit(
    file: MajorUpload | undefined,
    expectedHash: string,
    actor: Actor,
  ) {
    const parsed = await this.parse(file);
    if (parsed.fileHash !== expectedHash)
      throw new BadRequestException(
        "File đã thay đổi. Hãy kiểm tra file lại trước khi nhập.",
      );
    return this.repository.commitMajorImport(parsed.rows, actor);
  }
}
