import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { Workbook, ValueType, Cell as ExcelCell } from "exceljs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AuthSecurityRepository } from "../identity/domain/auth-security.repository";
import { adapterFor } from "./adapters";
import { Account, Adapter, Cell, Column, RecordRow } from "./types";
import { transactionDataSource } from "./transaction-data-source";
import { exportSheet } from "../../core/excel/workbook";
import { addExampleSheet, exampleValue } from "../../core/excel/examples";
import { checkWorkbookArchive } from "../../core/excel/xlsx-archive";
const VERSION = "excel-records-v1";
const text = (cell: ExcelCell) =>
  cell.value instanceof Date
    ? cell.value.toISOString().slice(0, 10)
    : cell.text;
export function displayCell(column: Column, value: Cell): string | number {
  if (column.secret) return "";
  const choice = column.choices?.find(
    (item) => item.value === value || String(item.value) === String(value),
  );
  if (choice) return choice.label;
  if (column.kind === "bool")
    return value === true ? "Có" : value === false ? "Không" : "";
  return value == null
    ? ""
    : typeof value === "boolean"
      ? String(value)
      : value;
}
export function readCell(
  column: Column,
  cell: ExcelCell,
  original?: { value: Cell; display: string },
): Cell {
  const raw = text(cell);
  if (original && raw === original.display) return original.value;
  if (column.choices) {
    const choice = column.choices.find(
      (item) => item.label === raw || String(item.value) === raw,
    );
    if (choice) return choice.value;
    if (!raw) return column.default ?? "";
    throw new BadRequestException(
      `${column.label}: chọn giá trị trong sheet Danh sach chon.`,
    );
  }
  if (column.kind === "number") {
    if (!raw.trim()) return column.default ?? null;
    const value =
      typeof cell.value === "number"
        ? cell.value
        : Number(raw.trim().replace(",", "."));
    if (!Number.isFinite(value) || !/^[-+]?\d+(?:[.,]\d+)?$/.test(raw.trim()))
      throw new BadRequestException(`${column.label}: nhập số hợp lệ.`);
    return value;
  }
  if (column.kind === "bool") {
    if (["Có", "true", "1"].includes(raw.trim())) return true;
    if (["Không", "false", "0"].includes(raw.trim())) return false;
    if (!raw.trim()) return column.default ?? null;
    throw new BadRequestException(`${column.label}: chọn Có hoặc Không.`);
  }
  return raw || column.default || "";
}
@Injectable()
export class ExcelRecordsService {
  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
    private readonly security: AuthSecurityRepository,
  ) {}
  private sign(context: string, value: string) {
    const secret = this.config.get<string>("JWT_SECRET");
    if (!secret)
      throw new ServiceUnavailableException(
        "Chưa cấu hình khóa xác thực Excel.",
      );
    return createHmac("sha256", secret)
      .update(context + ":" + value)
      .digest("hex");
  }
  async account(
    id: string,
    ip: string,
    db: DataSource = this.db,
  ): Promise<Account> {
    const [user] = await db.query(
      "SELECT CAST(id AS CHAR) id,username FROM users WHERE id=? AND account_status='ACTIVE' AND deleted_at IS NULL AND must_change_password=0",
      [id],
    );
    if (!user)
      throw new UnauthorizedException(
        "Tài khoản không còn hoạt động hoặc cần đổi mật khẩu.",
      );
    const roles = await db.query(
      "SELECT DISTINCT r.role_code code FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=? AND r.status='ACTIVE'",
      [id],
    );
    const permissions = await db.query(
      "SELECT DISTINCT p.permission_code code FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=? AND r.status='ACTIVE'",
      [id],
    );
    return {
      ...user,
      ip,
      roles: roles.map((r) => r.code),
      permissions: permissions.map((p) => p.code),
    };
  }
  private async adapter(
    resource: string,
    userId: string,
    ip: string,
    db = this.db,
    baseId?: string,
  ) {
    return adapterFor(
      resource,
      db,
      await this.account(userId, ip, db),
      this.security,
      baseId,
    );
  }
  async template(
    resource: string,
    userId: string,
    ip: string,
    focus?: string,
    baseId?: string,
  ) {
    const adapter = await this.adapter(resource, userId, ip, this.db, baseId),
      rows = await adapter.load();
    const book = new Workbook(),
      sheet = exportSheet(
        book,
        "Du lieu",
        ["ID bản ghi (giữ nguyên)", ...adapter.columns.map((col) => col.label)],
        [
          25,
          ...adapter.columns.map((col) =>
            col.key.toLowerCase().includes("description") || col.key === "moTa"
              ? 65
              : 35,
          ),
        ],
      );
    sheet.getColumn(1).hidden = true;
    const context = `${VERSION}:${resource}:${userId}`,
      meta = book.addWorksheet("_snapshot", { state: "veryHidden" });
    meta.addRow([VERSION, resource, userId]);
    const schema = JSON.stringify(
      adapter.columns.map((c) => ({
        key: c.key,
        label: c.label,
        kind: c.kind || "text",
      })),
    );
    meta.addRow(["_schema", schema, this.sign(context, schema)]);
    for (const row of rows) {
      const values = adapter.columns.map((col) =>
        displayCell(col, row.values[col.key]),
      );
      const added = sheet.addRow([row.id, ...values]);
      for (const [index, col] of adapter.columns.entries())
        if (col.readonly || col.immutable || row.locked?.includes(col.key)) {
          const cell = added.getCell(index + 2);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF1F5F9" },
          };
          cell.note = "Trường chỉ đọc của bản ghi hiện có.";
        }
      if (row.id === focus)
        added.font = { bold: true, color: { argb: "FF1D4ED8" } };
      const original = JSON.stringify({
        id: row.id,
        label: row.label,
        values: row.values,
        display: Object.fromEntries(
          adapter.columns.map((col, i) => [col.key, String(values[i])]),
        ),
      });
      if (original.length > 30000)
        throw new BadRequestException(
          "Nội dung một bản ghi quá dài để xuất Excel.",
        );
      meta.addRow([row.id, original, this.sign(context, original)]);
    }
    const seed = await adapter.seed?.();
    if (seed)
      sheet.addRow([
        "",
        ...adapter.columns.map((col) =>
          displayCell(col, seed[col.key] ?? col.default ?? ""),
        ),
      ]);
    const lookups = exportSheet(
      book,
      "Danh sach chon",
      ["Cột cần điền", "Giá trị", "Tên hiển thị"],
      [45, 25, 80],
    );
    const lastRow = Math.min(5001, Math.max(101, sheet.rowCount + 20));
    for (const [index, col] of adapter.columns.entries()) {
      const begin = lookups.rowCount + 1;
      if (col.choices?.length)
        for (const choice of col.choices)
          lookups.addRow([col.label, choice.value, choice.label]);
      else if (col.kind === "bool")
        lookups.addRows([
          [col.label, "true", "Có"],
          [col.label, "false", "Không"],
        ]);
      if (col.secret) continue;
      const values =
        col.choices?.map((c) => c.label) ||
        (col.kind === "bool" ? ["Có", "Không"] : []);
      if (values.length) {
        for (let row = 2; row <= lastRow; row++)
          sheet.getCell(row, index + 2).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: [`'Danh sach chon'!$C$${begin}:$C$${lookups.rowCount}`],
          };
      }
    }
    if (lookups.rowCount > 5001)
      throw new BadRequestException("Danh sách lựa chọn vượt giới hạn Excel.");
    const guide = exportSheet(
      book,
      "Huong dan",
      ["Nội dung", "Cách sử dụng"],
      [30, 115],
    );
    guide.addRows([
      [
        "Dữ liệu thật",
        `Mẫu ${adapter.title} chứa tất cả bản ghi trong phạm vi tài khoản, mỗi bản ghi một dòng.`,
      ],
      [
        "Sửa",
        "Sửa trực tiếp các ô cần đổi. Ô nền xám chỉ đọc; dòng bị khóa được giữ để đối chiếu. Dòng không sửa không bị ghi lại.",
      ],
      [
        "Thêm",
        "Điền vào dòng trống ngay dưới danh sách. Chỉ sao chép các cột dữ liệu, không sao chép ID ẩn ở cột A. Hệ thống tự cấp ID cho bản ghi mới.",
      ],
      [
        "Giữ dữ liệu",
        "Xóa dòng khỏi file không xóa dữ liệu. Giữ sheet _snapshot để đối chiếu bản gốc. Nếu cùng ô đã được sửa trên máy chủ, tải lại mẫu.",
      ],
      [
        "Lựa chọn",
        "Các cột khoa, ngành, học viên, giảng viên… điền tên hiển thị từ sheet Danh sach chon; cũng có thể dùng mã ID tương ứng.",
      ],
      [
        "Xác nhận",
        "Upload để xem khác biệt rồi xác nhận. Cả file lưu trong một transaction qua các quy tắc nghiệp vụ và quyền hiện có.",
      ],
    ]);
    for (const note of adapter.notes || [])
      guide.addRow(["Lưu ý nghiệp vụ", note]);
    addExampleSheet(
      book,
      sheet,
      rows.length
        ? rows
            .slice(0, 2)
            .map((row) => [
              row.id,
              ...adapter.columns.map((col) =>
                displayCell(col, row.values[col.key]),
              ),
            ])
        : [
            [
              "",
              ...adapter.columns.map((col) =>
                col.readonly
                  ? displayCell(col, col.default ?? "")
                  : (col.choices?.[0]?.label ??
                    exampleValue({
                      id: col.key,
                      label: col.label,
                      type:
                        col.kind === "number"
                          ? "number"
                          : col.kind === "date"
                            ? "date"
                            : col.key.toLowerCase().includes("url")
                              ? "url"
                              : col.key.toLowerCase().includes("email")
                                ? "email"
                                : "text",
                      value: "",
                      required: !col.secret,
                      readonly: false,
                    })),
              ),
            ],
          ],
      [
        "Các dòng này lấy từ dữ liệu thật để đối chiếu. Sửa ở sheet Du lieu; thêm mới ở dòng trống, không sao chép ID ẩn.",
        "Mật khẩu cũ không được xuất; mật khẩu ban đầu chỉ điền cho tài khoản mới.",
      ],
    );
    return {
      buffer: Buffer.from(await book.xlsx.writeBuffer()),
      filename: resource + ".xlsx",
    };
  }
  private async parse(
    resource: string,
    userId: string,
    file: { buffer: Buffer; size: number; originalname: string } | undefined,
    adapter: Adapter,
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
      meta = book.getWorksheet("_snapshot"),
      context = `${VERSION}:${resource}:${userId}`;
    if ((sheet?.rowCount || 0) > 5001 || (meta?.rowCount || 0) > 5002)
      throw new BadRequestException("Tối đa 5000 bản ghi mỗi file.");
    if (
      !sheet ||
      !meta ||
      meta.getCell("A1").text !== VERSION ||
      meta.getCell("B1").text !== resource ||
      meta.getCell("C1").text !== userId ||
      adapter.columns.some(
        (col, i) => sheet.getCell(1, i + 2).text !== col.label,
      )
    )
      throw new BadRequestException(
        "File không đúng chức năng/tài khoản hoặc cấu trúc đã đổi; hãy tải mẫu mới.",
      );
    const verify = (json: string, signature: string) => {
      const expected = this.sign(context, json);
      if (
        !/^[a-f0-9]{64}$/.test(signature) ||
        !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      )
        throw new BadRequestException("Bản gốc trong file đã bị thay đổi.");
    };
    const schema = meta.getCell("B2").text;
    verify(schema, meta.getCell("C2").text);
    if (
      schema !==
      JSON.stringify(
        adapter.columns.map((c) => ({
          key: c.key,
          label: c.label,
          kind: c.kind || "text",
        })),
      )
    )
      throw new BadRequestException(
        "Cấu trúc chức năng đã đổi; hãy tải mẫu mới.",
      );
    const originals = new Map<string, any>();
    for (let i = 3; i <= meta.rowCount; i++) {
      const row = meta.getRow(i),
        id = row.getCell(1).text,
        json = row.getCell(2).text;
      verify(json, row.getCell(3).text);
      try {
        const original = JSON.parse(json);
        if (original.id !== id || originals.has(id)) throw Error();
        originals.set(id, original);
      } catch {
        throw new BadRequestException("Bản gốc không hợp lệ.");
      }
    }
    const seen = new Set<string>(),
      rows = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      if (!row.hasValues) continue;
      const id = row.getCell(1).text.trim();
      if (id && (!originals.has(id) || seen.has(id)))
        throw new BadRequestException(
          `Dòng ${i}: ID không thuộc mẫu hoặc bị lặp.`,
        );
      if (id) seen.add(id);
      const original = id ? originals.get(id) : null,
        values: Record<string, Cell> = {};
      try {
        for (const [j, col] of adapter.columns.entries()) {
          const cell = row.getCell(j + 2);
          if (cell.type === ValueType.Formula)
            throw new BadRequestException("Không hỗ trợ công thức.");
          values[col.key] = readCell(
            col,
            cell,
            original
              ? {
                  value: original.values[col.key],
                  display: original.display[col.key],
                }
              : undefined,
          );
        }
      } catch (error) {
        throw new BadRequestException(`Dòng ${i}: ${error.message}`);
      }
      rows.push({ id: id || null, original, values, line: i });
    }
    if (!rows.length) throw new BadRequestException("File chưa có dữ liệu.");
    return rows;
  }
  async import(
    resource: string,
    userId: string,
    ip: string,
    file: { buffer: Buffer; size: number; originalname: string } | undefined,
    apply: boolean,
  ) {
    return this.db.transaction("READ COMMITTED", async (manager) => {
      const db = transactionDataSource(this.db, manager),
        adapter = await this.adapter(resource, userId, ip, db);
      await adapter.lock?.();
      const input = await this.parse(resource, userId, file, adapter),
        current = new Map((await adapter.load()).map((row) => [row.id, row]));
      const plans = [];
      let unchanged = 0;
      for (const row of input) {
        const now = row.id ? current.get(row.id) : null;
        if (row.id && !now)
          throw new ConflictException(
            `Dòng ${row.line}: bản ghi đã bị xóa hoặc không còn trong phạm vi.`,
          );
        const changed = adapter.columns
          .filter(
            (col) =>
              row.values[col.key] !==
              (row.original?.values[col.key] ??
                col.default ??
                (col.kind === "number" ? null : "")),
          )
          .filter((col) => !now || row.values[col.key] !== now.values[col.key]);
        if (now && !changed.length) {
          unchanged++;
          continue;
        }
        for (const col of changed) {
          if (
            col.readonly ||
            (now && (col.immutable || now.locked?.includes(col.key)))
          )
            throw new BadRequestException(
              `Dòng ${row.line}: ${col.label} chỉ đọc theo trạng thái/quyền của bản ghi.`,
            );
          if (now && now.values[col.key] !== row.original.values[col.key])
            throw new ConflictException(
              `Dòng ${row.line}: ${col.label} đã được sửa trên máy chủ; tải lại mẫu.`,
            );
        }
        const values = now
          ? {
              ...now.values,
              ...Object.fromEntries(
                changed.map((col) => [col.key, row.values[col.key]]),
              ),
            }
          : row.values;
        try {
          const payload = await adapter.validate(values, now || null);
          plans.push({
            line: row.line,
            row: now || null,
            values,
            payload,
            fields: changed.map((col) => ({
              key: col.key,
              label: col.label,
              before: col.secret
                ? "••••"
                : now
                  ? displayCell(col, now.values[col.key])
                  : null,
              after: col.secret
                ? "••••"
                : displayCell(col, row.values[col.key]),
            })),
          });
        } catch (error) {
          throw new BadRequestException(`Dòng ${row.line}: ${error.message}`);
        }
      }
      if (plans.length > 500 || (resource === "users" && plans.length > 100))
        throw new BadRequestException(
          "Quá nhiều dòng thay đổi; chia nhỏ file để nhập.",
        );
      const ids = [];
      if (apply)
        for (const plan of plans) {
          try {
            const result = await adapter.save(plan.payload, plan.row);
            ids.push(String(result?.id || plan.row?.id || ""));
          } catch (error) {
            throw new BadRequestException(
              `Dòng ${plan.line}: ${error.message} Toàn bộ file chưa được lưu.`,
            );
          }
        }
      return {
        created: plans.filter((p) => !p.row).length,
        updated: plans.filter((p) => p.row).length,
        unchanged,
        applied: apply,
        ids,
        changes: plans.map((p) => ({
          line: p.line,
          id: p.row?.id || null,
          label:
            p.row?.label ||
            String(
              p.values.name ||
                p.values.hoTen ||
                p.values.title ||
                p.values.courseName ||
                p.values.tenCTDT ||
                p.values.fullName ||
                "Bản ghi mới",
            ),
          kind: p.row ? "update" : "create",
          fields: p.fields,
        })),
      };
    });
  }
}
