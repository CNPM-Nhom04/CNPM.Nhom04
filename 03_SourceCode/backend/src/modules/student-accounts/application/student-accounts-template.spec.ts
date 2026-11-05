import { Workbook } from "exceljs";
import { StudentAccountsService } from "./student-accounts.service";
import { STUDENT_HEADERS } from "./student-accounts.parser";
describe("Student account template with actual class members", () => {
  let service: StudentAccountsService, repository: any;
  const member = {
    studentCode: "HV001",
    fullName: "Nguyễn Văn An",
    email: "an@example.edu.vn",
    username: "hv001",
    accountStatus: "ACTIVE",
  };
  beforeEach(() => {
    repository = {
      detail: jest.fn().mockResolvedValue({
        id: "1",
        code: "DH24PM",
        name: "Kỹ thuật phần mềm",
        revision: 1,
        trackId: "3",
      }),
      limits: jest.fn().mockResolvedValue({
        maxRows: 100,
        maxFileBytes: 5 * 1024 * 1024,
        passwordMinLength: 10,
      }),
      members: jest
        .fn()
        .mockResolvedValue({ data: [member], meta: { totalPages: 1 } }),
      check: jest.fn(async (_id, rows) => rows),
      commit: jest.fn(),
    };
    service = new StudentAccountsService(repository);
  });
  async function file(edit: (book: Workbook) => void = () => {}) {
    const result = await service.template("1");
    const book = new Workbook();
    await book.xlsx.load(result as never);
    edit(book);
    return {
      originalname: "students.xlsx",
      buffer: Buffer.from(await book.xlsx.writeBuffer()),
    };
  }
  it("prefills actual names and skips existing unchanged accounts", async () => {
    const upload = await file((book) => {
      const sheet = book.getWorksheet("Hoc vien")!;
      expect(sheet.getCell("B2").text).toBe(member.fullName);
      expect(book.worksheets.at(-1)!.name).toBe("Ví dụ điền đúng");
    });
    expect(await service.preview("1", upload)).toMatchObject({
      unchangedRows: 1,
      totalRows: 0,
      canImport: false,
    });
    expect(repository.commit).not.toHaveBeenCalled();
  });
  it("checks only new rows without reissuing passwords for old accounts", async () => {
    const upload = await file((book) =>
      book
        .getWorksheet("Hoc vien")!
        .addRow(["HV002", "Trần Thị Bình", "binh@example.edu.vn", "hv002"]),
    );
    const preview = await service.preview("1", upload);
    expect(preview).toMatchObject({
      unchangedRows: 1,
      totalRows: 1,
      validRows: 1,
      canImport: true,
    });
    expect(repository.check.mock.calls[0][1][0].studentCode).toBe("HV002");
  });
  it("directs changed existing profiles to the account editor", async () => {
    const upload = await file((book) => {
      book.getWorksheet("Hoc vien")!.getCell("B2").value = "Tên thay đổi";
    });
    const preview = await service.preview("1", upload);
    expect(preview.canImport).toBe(false);
    expect(preview.rows[0].errors.join(" ")).toContain("Người dùng");
  });
  it("retains imports of older blank templates", async () => {
    const book = new Workbook();
    book
      .addWorksheet("Hoc vien")
      .addRows([
        STUDENT_HEADERS,
        ["HV002", "Trần Thị Bình", "binh@example.edu.vn", "hv002"],
      ]);
    const result = await service.preview("1", {
      buffer: Buffer.from(await book.xlsx.writeBuffer()),
      originalname: "old.xlsx",
    });
    expect(result).toMatchObject({ totalRows: 1, canImport: true });
  });
});
