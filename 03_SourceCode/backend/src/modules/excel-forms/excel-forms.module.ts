import { addExampleSheet, exampleValue } from "../../core/excel/examples";
import {
  BadRequestException,
  Body,
  Controller,
  Module,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Workbook, ValueType } from "exceljs";
import { JwtAuthGuard } from "../identity/presentation/jwt-auth.guard";
import { IdentityModule } from "../identity/identity.module";
import { checkWorkbookArchive } from "../../core/excel/xlsx-archive";
import { exportSheet, XLSX_MIME } from "../../core/excel/workbook";
export interface ExcelField {
  id: string;
  label: string;
  type: string;
  value: string;
  readonly: boolean;
  required: boolean;
  options?: { value: string; label: string }[];
  min?: string;
  max?: string;
  step?: string;
  minLength?: number;
  maxLength?: number;
}
@Controller("excel-forms")
@UseGuards(JwtAuthGuard)
export class ExcelFormsController {
  @Post("template") async template(
    @Body()
    body: {
      context: string;
      fields: ExcelField[];
      recordLabel?: string;
    },
  ) {
    if (
      typeof body.context !== "string" ||
      body.context.length > 2000 ||
      !Array.isArray(body.fields) ||
      !body.fields.length ||
      body.fields.length > 1000
    )
      throw new BadRequestException("Cấu trúc mẫu không hợp lệ.");
    for (const f of body.fields)
      if (
        !f ||
        typeof f.id !== "string" ||
        typeof f.value !== "string" ||
        typeof f.label !== "string" ||
        f.value.length > 30000 ||
        f.label.length > 1000 ||
        (f.options?.length || 0) > 2000
      )
        throw new BadRequestException("Trường dữ liệu không hợp lệ.");
    const book = new Workbook();
    const fields = body.fields.map((f) => ({
      ...f,
      value: f.type === "password" ? "" : f.value,
    }));
    const display = (f: ExcelField, value: string) =>
      f.options?.find((o) => o.value === value)?.label ??
      (f.type === "checkbox" ? (value === "true" ? "Có" : "Không") : value);
    const data = exportSheet(
      book,
      "Du lieu",
      ["Bản ghi", ...fields.map((f) => f.label)],
      [45, ...fields.map(() => 40)],
    );
    data.addRow([
      body.recordLabel || "Dữ liệu hiện tại",
      ...fields.map((f) => display(f, f.value)),
    ]);
    const guide = exportSheet(
      book,
      "Danh sach chon",
      ["Thông tin", "Giá trị", "Tên hiển thị"],
      [45, 45, 65],
    );
    const meta = book.addWorksheet("_context", { state: "veryHidden" });
    meta.addRow([
      "excel-form-v2",
      body.context,
      body.recordLabel || "Dữ liệu hiện tại",
    ]);
    for (const [index, f] of fields.entries()) {
      meta.addRow([JSON.stringify(f)]);
      const cell = data.getCell(2, index + 2);
      if (f.readonly) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF1F5F9" },
        };
        cell.note = "Thông tin chỉ đọc, giữ nguyên.";
      }
      const options =
        f.options ||
        (f.type === "checkbox"
          ? [
              { value: "true", label: "Có" },
              { value: "false", label: "Không" },
            ]
          : []);
      const begin = guide.rowCount + 1;
      for (const option of options)
        guide.addRow([f.label, option.value, option.label]);
      if (options.length) {
        const name = `LuaChon_${index + 1}`;
        book.definedNames.add(
          `'Danh sach chon'!$C$${begin}:$C$${guide.rowCount}`,
          name,
        );
        cell.dataValidation = {
          type: "list",
          allowBlank: !f.required,
          formulae: [name],
        };
      }
    }
    const help = exportSheet(
      book,
      "Huong dan",
      ["Nội dung", "Hướng dẫn"],
      [30, 115],
    );
    help.addRows([
      [
        "Dữ liệu hiện tại",
        "Mỗi thông tin là một cột. Sửa trực tiếp các ô ở dòng 2 trong sheet Du lieu. Giữ nguyên tên cột và ô nền xám; không thêm dòng thứ hai cho hồ sơ này.",
      ],
      [
        "Danh sách chọn",
        "Chọn tên hiển thị trong danh sách; Có/Không cho ô đánh dấu. Ngày dùng YYYY-MM-DD. Không dùng công thức.",
      ],
      [
        "Kiểm tra",
        "Tải file lên để xem khác biệt trước khi lưu. Sheet Ví dụ điền đúng chỉ để tham khảo, không được nhập vào hệ thống.",
      ],
      [
        "Trường phụ thuộc",
        "Nếu đổi lựa chọn làm xuất hiện trường mới, áp dụng để bổ sung trường phụ thuộc rồi tải mẫu mới trước khi lưu.",
      ],
    ]);
    addExampleSheet(
      book,
      data,
      [
        [
          body.recordLabel || "Hồ sơ minh họa",
          ...fields.map((f) =>
            display(f, f.readonly ? f.value : String(exampleValue(f))),
          ),
        ],
      ],
      [
        "Điền tại dòng 2 của sheet Du lieu; ví dụ chỉ để đối chiếu. Thay nội dung minh họa và số hồ sơ bằng thông tin thực tế.",
      ],
    );
    return new StreamableFile(Buffer.from(await book.xlsx.writeBuffer()), {
      type: XLSX_MIME,
      disposition: 'attachment; filename="Du_lieu.xlsx"',
    });
  }
  @Post("read")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async read(
    @UploadedFile()
    file: { buffer: Buffer; size: number; originalname: string } | undefined,
  ) {
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
    const sheet = book.getWorksheet("Du lieu"),
      meta = book.getWorksheet("_context");
    if (sheet && meta?.getCell("A1").text === "excel-form-v2") {
      if (sheet.rowCount > 1001)
        throw new BadRequestException("File có quá nhiều dòng.");
      for (let i = 3; i <= sheet.rowCount; i++)
        if (sheet.getRow(i).hasValues)
          throw new BadRequestException(
            "Hồ sơ này chỉ có một dòng dữ liệu ở dòng 2. Không nhập ở sheet ví dụ.",
          );
      const fields = [];
      for (let i = 2; i <= meta.rowCount; i++) {
        let f: ExcelField;
        try {
          f = JSON.parse(meta.getCell(i, 1).text);
        } catch {
          throw new BadRequestException("Cấu trúc mẫu không hợp lệ.");
        }
        if (sheet.getCell(1, i).text !== f.label)
          throw new BadRequestException("Không sửa tên cột; hãy tải mẫu mới.");
        const cell = sheet.getCell(2, i);
        if (cell.type === ValueType.Formula)
          throw new BadRequestException("Không hỗ trợ công thức.");
        let value =
          cell.value instanceof Date
            ? cell.value.toISOString().slice(0, 10)
            : cell.text;
        if (f.options) {
          const option = f.options.find(
            (o) => o.label === value || o.value === value,
          );
          if (option) value = option.value;
          else if (value)
            throw new BadRequestException(
              `${f.label}: chọn giá trị trong danh sách.`,
            );
        }
        if (f.type === "checkbox") {
          if (["Có", "true", "1"].includes(value)) value = "true";
          else if (["Không", "false", "0"].includes(value)) value = "false";
          else throw new BadRequestException(`${f.label}: chọn Có hoặc Không.`);
        }
        fields.push({ id: f.id, original: f.value, value });
      }
      return { context: meta.getCell("B1").text, fields };
    }
    if (
      !sheet ||
      !meta ||
      meta.getCell("A1").text !== "excel-form-v1" ||
      sheet.rowCount > 1001
    )
      throw new BadRequestException("Hãy dùng file mẫu của chức năng này.");
    const seen = new Set(),
      fields = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      if (!row.hasValues) continue;
      for (let col = 1; col <= 6; col++)
        if (row.getCell(col).type === ValueType.Formula)
          throw new BadRequestException(`Dòng ${i}: không hỗ trợ công thức.`);
      const id = row.getCell(1).text;
      if (!id || seen.has(id))
        throw new BadRequestException(`Dòng ${i}: mã trường trống/trùng.`);
      seen.add(id);
      fields.push({
        id,
        original: row.getCell(3).text,
        value: row.getCell(4).text,
      });
    }
    return { context: meta.getCell("B1").text, fields };
  }
}
@Module({ imports: [IdentityModule], controllers: [ExcelFormsController] })
export class ExcelFormsModule {}
