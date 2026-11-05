import { addExampleSheet } from "../../../core/excel/examples";
import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from "@nestjs/common";
import { Workbook } from "exceljs";
import { createHash, randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";
import { exportSheet } from "../../../core/excel/workbook";
import {
  LinkStudentAccount,
  AccountActor,
  ClassInput,
  ClassQuery,
  ClassUpdate,
  PreparedStudentAccount,
  StudentAccountsRepository,
} from "../domain/student-accounts";
import {
  parseStudentAccounts,
  STUDENT_HEADERS,
} from "./student-accounts.parser";
export interface StudentAccountUpload {
  originalname: string;
  buffer: Buffer;
}
export function initialStudentPassword(minimum: number) {
  const length = Math.max(16, minimum);
  return (
    "A7" +
    randomBytes(length)
      .toString("base64url")
      .slice(0, length - 2)
  );
}
@Injectable()
export class StudentAccountsService {
  constructor(private readonly repository: StudentAccountsRepository) {}
  private id(id: string) {
    if (!/^[1-9]\d{0,19}$/.test(id) || BigInt(id) > 18446744073709551615n)
      throw new BadRequestException("ID lớp/hướng không hợp lệ.");
  }
  linkAccounts(id: string, q: ClassQuery) {
    this.id(id);
    return this.repository.linkAccounts(id, q);
  }
  linkProfiles(id: string, q: ClassQuery) {
    this.id(id);
    return this.repository.linkProfiles(id, q);
  }
  link(id: string, input: LinkStudentAccount, actor: AccountActor) {
    this.id(id);
    this.id(input.userId);
    if (input.studentId) this.id(input.studentId);
    if (input.confirmed !== true || !input.reason?.trim())
      throw new BadRequestException(
        "Cần xác minh đúng người và nhập căn cứ liên kết.",
      );
    if (input.studentId && input.studentCode)
      throw new BadRequestException(
        "Chỉ chọn hồ sơ SQL hoặc nhập mã để tạo hồ sơ mới.",
      );
    return this.repository.link(id, input, actor);
  }
  options() {
    return this.repository.options();
  }
  list(q: ClassQuery) {
    return this.repository.list(q);
  }
  detail(id: string) {
    this.id(id);
    return this.repository.detail(id);
  }
  members(id: string, q: ClassQuery) {
    this.id(id);
    return this.repository.members(id, q);
  }
  create(input: ClassInput, actor: AccountActor) {
    this.id(input.trackId);
    return this.repository.create(input, actor);
  }
  update(id: string, input: ClassUpdate, actor: AccountActor) {
    this.id(id);
    return this.repository.update(id, input, actor);
  }
  async remove(id: string, revision: number, actor: AccountActor) {
    this.id(id);
    await this.repository.remove(id, revision, actor);
    return { message: "Đã xóa lớp chưa có học viên." };
  }
  async template(id: string) {
    const item = await this.detail(id),
      limits = await this.repository.limits();
    const book = new Workbook(),
      sheet = exportSheet(book, "Hoc vien", STUDENT_HEADERS, [24, 40, 45, 28]);
    for (let i = 1; i <= 4; i++) sheet.getColumn(i).numFmt = "@";
    const previous = exportSheet(
      book,
      "Hoc vien hien co",
      [
        "Mã học viên",
        "Họ tên",
        "Email",
        "Tên đăng nhập",
        "Trạng thái tài khoản",
      ],
      [24, 40, 45, 28, 24],
    );
    for (let page = 1; ; page++) {
      const result = (await this.repository.members(id, {
        page,
        limit: 100,
        searchTerm: "",
      })) as {
        data: {
          studentCode: string;
          fullName: string;
          email: string;
          username: string;
          accountStatus: string;
        }[];
        meta: { totalPages: number };
      };
      for (const member of result.data) {
        sheet.addRow([
          member.studentCode,
          member.fullName,
          member.email || "",
          member.username || "",
        ]);
        previous.addRow([
          member.studentCode,
          member.fullName,
          member.email,
          member.username,
          member.accountStatus,
        ]);
      }
      if (page >= result.meta.totalPages) break;
    }
    const info = exportSheet(
      book,
      "Thong tin lop",
      ["Thông tin", "Giá trị"],
      [35, 90],
    );
    [
      ["Mã lớp", item.code],
      ["Tên lớp", item.name],
      ["Khóa nhập học", item.admissionYear],
      ["Phiên bản", item.versionCode],
      ["Hướng", item.trackName],
      ["Đơn vị", item.unitName],
    ].forEach((row) => info.addRow(row));
    const guide = book.addWorksheet("Huong dan");
    [
      "Mẫu điền sẵn học viên hiện tại trong sheet Hoc vien. Dòng đã có tài khoản và không đổi được bỏ qua; sửa thông tin tài khoản tại mục Người dùng. Không xuất mật khẩu cũ.",
      "Điền học viên mới vào dòng trống trong sheet Hoc vien, giữ nguyên bốn tiêu đề. Không nhập mật khẩu trong file.",
      "Mã học viên, họ tên, email là bắt buộc. Tên đăng nhập bỏ trống sẽ lấy mã học viên viết thường; tối thiểu 3 ký tự.",
      "Giữ định dạng Text cho mã có số 0 đầu. Không dùng công thức. Email không dấu, không trùng; chấp nhận liên kết mailto Excel tự tạo đúng địa chỉ hiển thị.",
      "Hồ sơ có sẵn chỉ được liên kết khi chưa có tài khoản, đúng họ tên/khóa/đơn vị và không bị phân công sang CTĐT/hướng khác.",
      "Xác nhận nhập sẽ tạo mật khẩu ngẫu nhiên riêng, buộc đổi lần đầu và tải file bàn giao một lần. Không ghi đè tài khoản cũ.",
      `Giới hạn ${limits.maxRows} dòng mỗi lần, ${limits.maxFileBytes / 1024 / 1024} MB. Lớp lớn có thể chia nhiều file.`,
    ].forEach((line) => guide.addRow([line]));
    guide.getColumn(1).width = 130;
    addExampleSheet(
      book,
      sheet,
      [
        ["VD_HV_001", "Nguyễn Văn Minh", "minh.vidu@example.com", "vidu_hv001"],
        ["VD_HV_002", "Trần Thị Lan", "lan.vidu@example.com", "vidu_hv002"],
      ],
      [
        "Điền dữ liệu thật tại sheet Hoc vien. Tất cả tên, email, mã và tài khoản trong sheet ví dụ đều minh họa, phải thay bằng dữ liệu học viên thực tế.",
        "Mã học viên/họ tên/email là bắt buộc; tên đăng nhập có thể trống để hệ thống sinh từ mã. Email, mã và tài khoản phải hợp lệ, không trùng theo quy định.",
        "Không thêm mật khẩu vào file nhập. Sheet Hoc vien hien co để đối chiếu dữ liệu đã có; nhập mới không ghi đè tài khoản cũ.",
      ],
    );
    return Buffer.from(await book.xlsx.writeBuffer());
  }
  private async parse(id: string, file?: StudentAccountUpload) {
    const item = await this.detail(id),
      limits = await this.repository.limits();
    if (!file || !/\.xlsx$/i.test(file.originalname))
      throw new BadRequestException("Chọn file .xlsx theo mẫu học viên.");
    if (file.buffer.length > limits.maxFileBytes)
      throw new PayloadTooLargeException(
        "File vượt giới hạn dung lượng nhập trong SQL.",
      );
    const allRows = await parseStudentAccounts(
      file.buffer,
      5000 + limits.maxRows,
    );
    const existing = new Map<string, any>();
    for (let page = 1; ; page++) {
      const result: any = await this.repository.members(id, {
        page,
        limit: 100,
        searchTerm: "",
      });
      for (const member of result.data)
        if (member.username)
          existing.set(member.studentCode.toLowerCase(), member);
      if (page >= result.meta.totalPages) break;
    }
    let unchanged = 0;
    const rows = allRows.filter((row) => {
      const member = existing.get(row.studentCode.toLowerCase());
      if (!member) return true;
      if (
        !row.errors.length &&
        row.fullName === member.fullName &&
        row.email === (member.email || "").toLowerCase() &&
        row.username === member.username
      ) {
        unchanged++;
        return false;
      }
      row.errors.push(
        "Học viên đã có tài khoản. Giữ nguyên dòng này; sửa thông tin tại mục Người dùng bằng Excel.",
      );
      return true;
    });
    if (rows.length > limits.maxRows)
      throw new BadRequestException(
        `Tối đa ${limits.maxRows} học viên mới mỗi lần nhập; các dòng đã có tài khoản không tính vào giới hạn.`,
      );
    const previewHash = createHash("sha256")
      .update(file.buffer)
      .update("\0" + item.id + "\0" + item.revision + "\0" + item.trackId)
      .digest("hex");
    return {
      item,
      limits,
      rows,
      unchanged,
      previewHash,
      fileHash: createHash("sha256").update(file.buffer).digest("hex"),
    };
  }
  async preview(id: string, file?: StudentAccountUpload) {
    const parsed = await this.parse(id, file),
      rows = await this.repository.check(id, parsed.rows, parsed.item.revision),
      invalid = rows.filter((r) => r.errors.length).length;
    return {
      class: parsed.item,
      previewHash: parsed.previewHash,
      classRevision: parsed.item.revision,
      totalRows: rows.length,
      validRows: rows.length - invalid,
      errorRows: invalid,
      canImport: invalid === 0 && rows.length > 0,
      unchangedRows: parsed.unchanged,
      rows,
    };
  }
  async commit(
    id: string,
    file: StudentAccountUpload | undefined,
    previewHash: string,
    classRevision: number,
    actor: AccountActor,
  ) {
    const parsed = await this.parse(id, file);
    if (
      parsed.previewHash !== previewHash ||
      parsed.item.revision !== classRevision
    )
      throw new BadRequestException(
        "File hoặc lớp đã thay đổi. Tải lại lớp và kiểm tra file trước khi tạo tài khoản.",
      );
    if (!parsed.rows.length)
      throw new BadRequestException(
        "Không có học viên mới; các dòng hiện có được giữ nguyên.",
      );
    const checked = await this.repository.check(id, parsed.rows, classRevision),
      invalid = checked.filter((r) => r.errors.length);
    if (invalid.length)
      throw new BadRequestException(
        invalid
          .slice(0, 20)
          .map((r) => `Dòng ${r.rowNumber}: ${r.errors.join(" ")}`),
      );
    const book = new Workbook(),
      sheet = exportSheet(
        book,
        "Ban giao tai khoan",
        [
          "Mã lớp",
          "Học viên",
          "Mã học viên",
          "Tên đăng nhập",
          "Email",
          "Mật khẩu ban đầu",
          "Phiên bản CTĐT",
          "Hướng",
        ],
        [24, 40, 24, 28, 45, 35, 28, 35],
      );
    const accounts: PreparedStudentAccount[] = [];
    for (const row of checked) {
      const password = initialStudentPassword(parsed.limits.passwordMinLength);
      accounts.push({
        row,
        passwordHash: await bcrypt.hash(password, 12),
        passwordLength: password.length,
      });
      sheet.addRow([
        parsed.item.code,
        row.fullName,
        row.studentCode,
        row.username,
        row.email,
        password,
        parsed.item.versionCode,
        parsed.item.trackName,
      ]);
    }
    const guide = book.addWorksheet("Huong dan");
    [
      "File chứa mật khẩu ban đầu. Bàn giao riêng cho đúng học viên và giữ file ở nơi an toàn.",
      "Học viên đăng nhập tại trang chủ, đổi mật khẩu bắt buộc rồi đăng nhập lại để mở CTĐT của tôi.",
      "Hệ thống chỉ lưu hash mật khẩu, không có chức năng tải lại mật khẩu này. Nếu mất file, sử dụng quên mật khẩu qua email đã đăng ký.",
      "Đây là tài khoản học viên đã nhập học, không phải quyết định trúng tuyển hay đăng ký học phần.",
    ].forEach((line) => guide.addRow([line]));
    guide.getColumn(1).width = 120;
    const buffer = Buffer.from(await book.xlsx.writeBuffer());
    const created = await this.repository.commit(
      id,
      accounts,
      classRevision,
      parsed.fileHash,
      actor,
      file!.buffer.length,
    );
    return { buffer, created };
  }
}
