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
    const guide = book.addWorksheet("Huong dan");
    [
      "Nhập dữ liệu vào sheet Nganh dao tao, giữ nguyên bốn tiêu đề.",
      "Mã đơn vị quản lý: lấy từ sheet Don vi tu CSDL. Backend kiểm tra lại CSDL khi lưu.",
      "Chỉ thêm ngành mới; mã đã có không bị ghi đè. Mã có số 0 đầu phải giữ định dạng Text.",
      "Trạng thái: ACTIVE (hoạt động) hoặc INACTIVE (ngừng sử dụng). Không dùng công thức.",
      `Tối đa ${limits.maxRows} dòng, ${limits.maxFileBytes / 1024 / 1024} MB. Toàn bộ file chỉ lưu khi không có dòng lỗi.`,
    ].forEach((line) => guide.addRow([line]));
    guide.getColumn(1).width = 120;
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
