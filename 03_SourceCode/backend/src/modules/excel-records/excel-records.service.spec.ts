import { ConfigService } from "@nestjs/config";
import { Workbook } from "exceljs";
import { ExcelRecordsService } from "./excel-records.service";
import { adapterFor } from "./adapters";
import { Adapter, RecordRow } from "./types";
import { transactionDataSource } from "./transaction-data-source";
jest.mock("./adapters", () => ({ adapterFor: jest.fn() }));
describe("Record Excel merge and transaction boundary", () => {
  let service: ExcelRecordsService,
    adapter: Adapter,
    rows: RecordRow[],
    saved: jest.Mock,
    db: any;
  beforeEach(() => {
    rows = [
      {
        id: "10",
        label: "FIT — Công nghệ thông tin",
        values: {
          code: "FIT",
          name: "Công nghệ thông tin",
          note: "Cũ",
          status: "ACTIVE",
        },
      },
    ];
    saved = jest.fn(async (payload, row) => {
      rows = rows.map((r) =>
        r.id === row?.id ? { ...r, values: payload } : r,
      );
      return { id: row?.id || "20" };
    });
    adapter = {
      title: "Khoa",
      columns: [
        { key: "code", label: "Mã khoa", immutable: true },
        { key: "name", label: "Tên khoa" },
        { key: "note", label: "Mô tả" },
        {
          key: "status",
          label: "Trạng thái",
          readonly: true,
          default: "ACTIVE",
        },
      ],
      load: async () => rows,
      validate: async (v) => {
        if (!v.name) throw Error("Tên bắt buộc");
        return v;
      },
      save: saved,
    };
    (adapterFor as jest.Mock).mockResolvedValue(adapter);
    db = {
      query: jest.fn(),
      transaction: async (_level, callback) => {
        const original = structuredClone(rows);
        try {
          return await callback({ query: jest.fn() });
        } catch (e) {
          rows = original;
          throw e;
        }
      },
    };
    service = new ExcelRecordsService(
      db,
      new ConfigService({ JWT_SECRET: "test-key" }),
      {} as any,
    );
    jest
      .spyOn(service, "account")
      .mockResolvedValue({
        id: "1",
        username: "admin",
        ip: "",
        roles: ["ADMIN"],
        permissions: [],
      });
  });
  async function upload(edit: (book: Workbook) => void = () => {}) {
    const { buffer } = await service.template("faculties", "1", "");
    const book = new Workbook();
    await book.xlsx.load(buffer as never);
    edit(book);
    const data = Buffer.from(await book.xlsx.writeBuffer());
    return { buffer: data, size: data.length, originalname: "data.xlsx" };
  }
  it("exports actual records and ignores examples and unchanged data", async () => {
    const file = await upload((book) => {
      expect(book.getWorksheet("Du lieu")!.getCell("C2").text).toBe(
        "Công nghệ thông tin",
      );
      expect(book.getWorksheet("Du lieu")!.getColumn(1).hidden).toBe(true);
      expect(book.worksheets.at(-1)!.name).toBe("Ví dụ điền đúng");
      book.worksheets.at(-1)!.getCell("C2").value = "Do not import";
    });
    expect(
      await service.import("faculties", "1", "", file, false),
    ).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
    expect(saved).not.toHaveBeenCalled();
  });
  it("previews without writes and merges only changed cells preserving concurrent edits", async () => {
    const file = await upload((book) => {
      book.getWorksheet("Du lieu")!.getCell("C2").value = "Tên mới";
    });
    rows[0].values.note = "Sửa đồng thời";
    expect(
      await service.import("faculties", "1", "", file, false),
    ).toMatchObject({ updated: 1, applied: false });
    expect(saved).not.toHaveBeenCalled();
    await service.import("faculties", "1", "", file, true);
    expect(saved.mock.calls[0][0]).toMatchObject({
      name: "Tên mới",
      note: "Sửa đồng thời",
    });
    expect(
      await service.import("faculties", "1", "", file, true),
    ).toMatchObject({ updated: 0, unchanged: 1 });
  });
  it("rejects overlapping edits and changed scope", async () => {
    const file = await upload((book) => {
      book.getWorksheet("Du lieu")!.getCell("C2").value = "Tên mới";
    });
    rows[0].values.name = "Người khác sửa";
    await expect(
      service.import("faculties", "1", "", file, true),
    ).rejects.toThrow("đã được sửa");
    rows = [];
    await expect(
      service.import("faculties", "1", "", file, true),
    ).rejects.toThrow("phạm vi");
    expect(saved).not.toHaveBeenCalled();
  });
  it.each([
    "formula",
    "signature",
    "duplicate",
    "readonly",
    "immutable",
    "account",
  ])("rejects %s before writes", async (kind) => {
    const file = await upload((book) => {
      const sheet = book.getWorksheet("Du lieu")!;
      if (kind === "formula")
        sheet.getCell("C2").value = { formula: "1+1", result: 2 };
      if (kind === "signature")
        book.getWorksheet("_snapshot")!.getCell("B3").value = "{}";
      if (kind === "duplicate")
        sheet.addRow(["10", "FIT", "B", "Cũ", "ACTIVE"]);
      if (kind === "readonly") sheet.getCell("E2").value = "INACTIVE";
      if (kind === "immutable") sheet.getCell("B2").value = "NEW";
      if (kind === "account")
        book.getWorksheet("_snapshot")!.getCell("C1").value = "2";
    });
    await expect(
      service.import("faculties", "1", "", file, true),
    ).rejects.toThrow();
    expect(saved).not.toHaveBeenCalled();
  });
  it("accepts new rows with empty readonly defaults; removing rows does not delete", async () => {
    const file = await upload((book) => {
      const sheet = book.getWorksheet("Du lieu")!;
      sheet.spliceRows(2, 1);
      sheet.addRow(["", "NEW", "Khoa mới", ""]);
    });
    expect(
      await service.import("faculties", "1", "", file, true),
    ).toMatchObject({ created: 1, updated: 0 });
    expect(saved.mock.calls[0][0]).toMatchObject({
      code: "NEW",
      name: "Khoa mới",
      status: "ACTIVE",
    });
    expect(rows[0].id).toBe("10");
  });
  it("rolls back every row if a later native save fails", async () => {
    const file = await upload((book) => {
      const sheet = book.getWorksheet("Du lieu")!;
      sheet.getCell("C2").value = "Tên mới";
      sheet.addRow(["", "NEW", "Khoa mới", "", "ACTIVE"]);
    });
    saved
      .mockImplementationOnce(async (payload) => {
        rows[0].values = payload;
        return { id: "10" };
      })
      .mockRejectedValueOnce(Error("native domain rejected"));
    await expect(
      service.import("faculties", "1", "", file, true),
    ).rejects.toThrow("Toàn bộ file chưa được lưu");
    expect(rows[0].values.name).toBe("Công nghệ thông tin");
  });
});
describe("transaction-bound native repositories", () => {
  it("joins both transaction overloads without mutating the shared data source", async () => {
    const source: any = {
      manager: { name: "global" },
      query: jest.fn(),
      transaction: jest.fn(),
    };
    const one: any = { query: jest.fn().mockResolvedValue("one") },
      two: any = { query: jest.fn().mockResolvedValue("two") };
    const a = transactionDataSource(source, one),
      b = transactionDataSource(source, two);
    expect(await a.query("SELECT 1")).toBe("one");
    expect(await b.query("SELECT 1")).toBe("two");
    await a.transaction(async (manager) => expect(manager).toBe(one));
    await b.transaction("READ COMMITTED", async (manager) =>
      expect(manager).toBe(two),
    );
    expect(source.manager.name).toBe("global");
    expect(source.transaction).not.toHaveBeenCalled();
    expect(source.query).not.toHaveBeenCalled();
  });
});
