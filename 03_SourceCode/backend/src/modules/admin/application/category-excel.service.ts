import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Workbook, ValueType } from "exceljs";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  Actor,
  AdminRepository,
  CategoryItem,
} from "../domain/admin.repository";
import { CategoryInputDto } from "./admin.dto";
import { exportSheet } from "../../../core/excel/workbook";
import { addExampleSheet } from "../../../core/excel/examples";
import { checkWorkbookArchive } from "../../../core/excel/xlsx-archive";
const HEADERS = [
  "ID danh mục (giữ nguyên)",
  "Mã danh mục",
  "Tên danh mục",
  "Loại danh mục",
  "Mô tả",
  "Trạng thái",
];
const labels = {
  KHOA_QUAN_LY: "Khoa / Đơn vị",
  BAC_DAO_TAO: "Bậc đào tạo",
  KHOI_KIEN_THUC: "Khối kiến thức",
};
@Injectable()
export class CategoryExcelService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly config: ConfigService,
  ) {}
  private sign(context: string, json: string) {
    const secret = this.config.get<string>("JWT_SECRET");
    if (!secret)
      throw new ServiceUnavailableException("Chưa cấu hình khóa file Excel.");
    return createHmac("sha256", secret)
      .update(context + ":" + json)
      .digest("hex");
  }
  async template(actor: Actor, focus?: string) {
    const rows: CategoryItem[] = [];
    for (let page = 1; ; page++) {
      const result = await this.repository.listCategories({
        page,
        limit: 100,
        selectedType: "ALL",
      });
      rows.push(...result.data);
      if (rows.length > 5000)
        throw new BadRequestException("Tối đa 5000 danh mục trong mẫu.");
      if (page >= result.meta.totalPages) break;
    }
    const book = new Workbook(),
      sheet = exportSheet(book, "Danh muc", HEADERS, [30, 24, 60, 28, 70, 22]);
    sheet.getColumn(1).hidden = true;
    const context = "category-excel-v1:" + actor.id,
      meta = book.addWorksheet("_snapshot", { state: "veryHidden" });
    meta.addRow(["category-excel-v1", context]);
    for (const row of rows) {
      const added = sheet.addRow([
        row.id,
        row.maDanhMuc,
        row.tenDanhMuc,
        labels[row.loaiDanhMuc],
        row.moTa,
        row.trangThai ? "Hoạt động" : "Ngừng hoạt động",
      ]);
      if (focus === row.id)
        added.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDBEAFE" },
          };
        });
      const json = JSON.stringify(row);
      meta.addRow([row.id, json, this.sign(context, json)]);
    }
    const validationLastRow = Math.min(
      5001,
      Math.max(101, sheet.rowCount + 20),
    );
    for (let i = 2; i <= validationLastRow; i++) {
      sheet.getCell(i, 4).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: ['"Khoa / Đơn vị,Bậc đào tạo,Khối kiến thức"'],
      };
      sheet.getCell(i, 6).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: ['"Hoạt động,Ngừng hoạt động"'],
      };
    }
    const guide = exportSheet(
      book,
      "Huong dan",
      ["Nội dung", "Cách điền"],
      [30, 110],
    );
    guide.addRows([
      [
        "Dữ liệu hiện có",
        "Sheet Danh muc chứa toàn bộ các dòng đang có trong CSDL, gồm mã/tên khoa, đơn vị, bậc đào tạo và khối kiến thức.",
      ],
      [
        "Sửa",
        "Sửa trực tiếp tên, mô tả, trạng thái của dòng cần đổi. Giữ ID ẩn ở cột A và loại danh mục của dòng cũ. Chỉ các ô khác biệt được cập nhật.",
      ],
      [
        "Thêm",
        "Điền dòng trống ngay dưới danh sách, để trống cột A, điền mã/tên/loại/mô tả/trạng thái. Dùng mã mới chưa tồn tại.",
      ],
      [
        "Giữ nguyên",
        "Không sửa dòng nào thì dòng đó được giữ nguyên. Xóa dòng khỏi file không xóa danh mục.",
      ],
      [
        "Xem trước",
        "Upload để xem danh sách thay đổi, sau đó xác nhận lưu. Nếu cùng ô đã được người khác sửa thì cần tải lại mẫu.",
      ],
    ]);
    addExampleSheet(
      book,
      sheet,
      rows
        .slice(0, 3)
        .map((row) => [
          row.id,
          row.maDanhMuc,
          row.tenDanhMuc,
          labels[row.loaiDanhMuc],
          row.moTa,
          row.trangThai ? "Hoạt động" : "Ngừng hoạt động",
        ]),
      [
        "Đây là các dòng thật từ danh mục hiện có để đối chiếu; sửa ở sheet Danh muc. Thêm mới bằng một dòng có mã mới và ID trống.",
      ],
    );
    return Buffer.from(await book.xlsx.writeBuffer());
  }
  async import(
    file: { buffer: Buffer; size: number; originalname: string } | undefined,
    actor: Actor,
    apply: boolean,
  ) {
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
    const sheet = book.getWorksheet("Danh muc"),
      meta = book.getWorksheet("_snapshot"),
      context = "category-excel-v1:" + actor.id;
    if (
      !sheet ||
      !meta ||
      meta.getCell("A1").text !== "category-excel-v1" ||
      meta.getCell("B1").text !== context ||
      HEADERS.some((h, i) => sheet.getRow(1).getCell(i + 1).text !== h)
    )
      throw new BadRequestException(
        "Hãy tải mẫu danh mục mới của đúng tài khoản.",
      );
    const original = new Map<string, CategoryItem>();
    for (let i = 2; i <= meta.rowCount; i++) {
      const row = meta.getRow(i),
        id = row.getCell(1).text,
        json = row.getCell(2).text,
        signature = row.getCell(3).text,
        expected = this.sign(context, json);
      if (
        !/^[a-f0-9]{64}$/.test(signature) ||
        !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ||
        original.has(id)
      )
        throw new BadRequestException("Dữ liệu gốc trong mẫu đã bị sửa.");
      try {
        const item = JSON.parse(json);
        if (item.id !== id) throw Error();
        original.set(id, item);
      } catch {
        throw new BadRequestException("Dữ liệu gốc không hợp lệ.");
      }
    }
    const seen = new Set<string>(),
      codes = new Set<string>(),
      rows = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      if (!row.hasValues) continue;
      for (let col = 1; col <= 6; col++)
        if (row.getCell(col).type === ValueType.Formula)
          throw new BadRequestException(`Dòng ${i}: không hỗ trợ công thức.`);
      const [id, code, name, type, , status] = [1, 2, 3, 4, 5, 6].map((col) =>
        row.getCell(col).text.trim(),
      );
      const categoryType = Object.entries(labels).find(
        ([key, label]) => key === type || label === type,
      )?.[0];
      const active = ["Hoạt động", "ACTIVE", "true"].includes(status),
        inactive = ["Ngừng hoạt động", "INACTIVE", "false"].includes(status);
      if (!categoryType || (!active && !inactive))
        throw new BadRequestException(
          `Dòng ${i}: chọn loại danh mục và trạng thái trong danh sách.`,
        );
      if (id && (!original.has(id) || seen.has(id)))
        throw new BadRequestException(
          `Dòng ${i}: ID không thuộc mẫu hoặc bị lặp.`,
        );
      if (id) seen.add(id);
      const unique = categoryType + ":" + code.toLowerCase();
      if (codes.has(unique))
        throw new BadRequestException(`Dòng ${i}: mã danh mục bị lặp.`);
      codes.add(unique);
      const input = plainToInstance(CategoryInputDto, {
        maDanhMuc: code,
        tenDanhMuc: name,
        loaiDanhMuc: categoryType,
        moTa: row.getCell(5).text,
        trangThai: active,
      });
      const errors = await validate(input);
      if (errors.length)
        throw new BadRequestException(
          `Dòng ${i}: ` +
            errors
              .flatMap((e) => Object.values(e.constraints || {}))
              .join("; "),
        );
      rows.push({
        id: id || null,
        original: id ? original.get(id)! : null,
        input,
      });
    }
    if (!rows.length)
      throw new BadRequestException("File chưa có dòng danh mục.");
    return this.repository.importCategories(rows, actor, apply);
  }
}
