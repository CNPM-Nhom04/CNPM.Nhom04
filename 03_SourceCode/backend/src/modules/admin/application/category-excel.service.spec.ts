import { Workbook } from "exceljs";
import { ConfigService } from "@nestjs/config";
import { CategoryExcelService } from "./category-excel.service";
import {
  Actor,
  AdminRepository,
  CategoryItem,
} from "../domain/admin.repository";
describe("category Excel with real catalog rows", () => {
  const actor = { id: "1", permission: "MASTERDATA_MANAGE" } as Actor;
  const items: CategoryItem[] = [
    {
      id: "BAC_DAO_TAO:1",
      maDanhMuc: "DOCTOR",
      tenDanhMuc: "Tiến sĩ",
      loaiDanhMuc: "BAC_DAO_TAO",
      moTa: "",
      trangThai: true,
    },
    {
      id: "BAC_DAO_TAO:2",
      maDanhMuc: "MASTER",
      tenDanhMuc: "Thạc sĩ",
      loaiDanhMuc: "BAC_DAO_TAO",
      moTa: "",
      trangThai: true,
    },
    {
      id: "KHOA_QUAN_LY:1",
      maDanhMuc: "FIT",
      tenDanhMuc: "Khoa Công nghệ Thông tin",
      loaiDanhMuc: "KHOA_QUAN_LY",
      moTa: "Khoa",
      trangThai: true,
    },
  ];
  let service: CategoryExcelService, repository: any;
  beforeEach(() => {
    repository = {
      listCategories: jest
        .fn()
        .mockResolvedValue({ data: items, meta: { totalPages: 1 } }),
      importCategories: jest.fn().mockResolvedValue({ updated: 1 }),
    };
    service = new CategoryExcelService(
      repository as AdminRepository,
      new ConfigService({ JWT_SECRET: "category-test-key" }),
    );
  });
  async function file(edit: (book: Workbook) => void = () => {}) {
    const book = new Workbook();
    await book.xlsx.load((await service.template(actor)) as never);
    edit(book);
    const buffer = Buffer.from(await book.xlsx.writeBuffer());
    return { buffer, size: buffer.length, originalname: "Danh_muc.xlsx" };
  }
  it("fills actual names as rows rather than vertical field titles, with a matching example tab", async () => {
    const upload = await file((book) => {
      const s = book.getWorksheet("Danh muc")!;
      expect(s.getColumn(1).hidden).toBe(true);
      expect([s.getCell("B2").text, s.getCell("C2").text]).toEqual([
        "DOCTOR",
        "Tiến sĩ",
      ]);
      expect(s.getCell("C3").text).toBe("Thạc sĩ");
      expect(s.getCell("C4").text).toBe("Khoa Công nghệ Thông tin");
      expect(book.worksheets.at(-1)?.name).toBe("Ví dụ điền đúng");
    });
    await service.import(upload, actor, false);
    expect(repository.importCategories.mock.calls[0][0]).toHaveLength(3);
  });
  it("reads edits and new records while retaining original signed values", async () => {
    const upload = await file((book) => {
      const s = book.getWorksheet("Danh muc")!;
      s.getCell("C4").value = "Tên khoa mới";
      s.addRow(["", "NEW", "Danh mục mới", "Khoa / Đơn vị", "", "Hoạt động"]);
    });
    await service.import(upload, actor, false);
    const rows = repository.importCategories.mock.calls[0][0];
    expect(rows[2]).toMatchObject({
      id: "KHOA_QUAN_LY:1",
      original: { tenDanhMuc: "Khoa Công nghệ Thông tin" },
      input: { tenDanhMuc: "Tên khoa mới" },
    });
    expect(rows[3]).toMatchObject({
      id: null,
      original: null,
      input: { maDanhMuc: "NEW", trangThai: true },
    });
  });
  it("recovers a missing hidden ID from the signed original code and keeps the baseline", async () => {
    const upload = await file((book) => {
      const s = book.getWorksheet("Danh muc")!;
      s.getCell("A4").value = null;
      s.getCell("E4").value = "Mô tả đã sửa";
    });
    await service.import(upload, actor, false);
    expect(repository.importCategories.mock.calls[0][0][2]).toMatchObject({
      id: "KHOA_QUAN_LY:1",
      original: { moTa: "Khoa" },
      input: { moTa: "Mô tả đã sửa" },
    });
  });
  it("does not infer existing records outside the signed snapshot", async () => {
    const upload = await file((book) => {
      book
        .getWorksheet("Danh muc")!
        .addRow([
          "",
          "QA_KHOI_01",
          "Khối thử",
          "Khối kiến thức",
          "Mô tả",
          "Hoạt động",
        ]);
    });
    await service.import(upload, actor, false);
    expect(repository.importCategories.mock.calls[0][0][3]).toMatchObject({
      id: null,
      original: null,
    });
  });
  it.each([
    "formula",
    "identity",
    "signature",
    "duplicate",
    "status",
    "duplicate-identity",
  ])("rejects invalid %s before repository mutations", async (kind) => {
    const upload = await file((book) => {
      const s = book.getWorksheet("Danh muc")!;
      if (kind === "formula")
        s.getCell("C2").value = { formula: "1+1", result: 2 };
      if (kind === "identity") s.getCell("A2").value = "BAC_DAO_TAO:999";
      if (kind === "signature")
        book.getWorksheet("_snapshot")!.getCell("B2").value = "{}";
      if (kind === "duplicate")
        s.addRow(["", "doctor", "Trùng", "Bậc đào tạo", "", "Hoạt động"]);
      if (kind === "status") s.getCell("F2").value = "khác";
      if (kind === "duplicate-identity")
        s.addRow(["", "FIT", "Lặp dòng", "Khoa / Đơn vị", "", "Hoạt động"]);
    });
    await expect(service.import(upload, actor, true)).rejects.toThrow();
    expect(repository.importCategories).not.toHaveBeenCalled();
  });
});
