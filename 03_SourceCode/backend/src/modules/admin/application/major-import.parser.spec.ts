import { Workbook } from "exceljs";
import { MAJOR_HEADERS, parseMajorWorkbook } from "./major-import.parser";
async function file(rows: unknown[][], configure?: (book: Workbook) => void) {
  const book = new Workbook();
  const sheet = book.addWorksheet("Nganh dao tao");
  sheet.addRow(MAJOR_HEADERS);
  rows.forEach((row) => sheet.addRow(row));
  configure?.(book);
  return Buffer.from(await book.xlsx.writeBuffer());
}
describe("Major Excel parser", () => {
  it("preserves leading zeros, Unicode and source row numbers", async () => {
    const rows = await parseMajorWorkbook(
      await file([[], [" 001 ", " Ngành Sư phạm ", "FIT", "ACTIVE"]]),
      10,
    );
    expect(rows).toEqual([
      {
        rowNumber: 3,
        majorCode: "001",
        majorName: "Ngành Sư phạm",
        unitCode: "FIT",
        status: "ACTIVE",
        errors: [],
      },
    ]);
  });
  it("marks both case-insensitive duplicate rows", async () => {
    const rows = await parseMajorWorkbook(
      await file([
        ["a", "Một", "FIT", "ACTIVE"],
        ["A", "Hai", "FIT", "INACTIVE"],
      ]),
      10,
    );
    expect(
      rows.every((row) => row.errors.includes("Mã ngành bị trùng trong file.")),
    ).toBe(true);
  });
  it("does not trust a cached formula result or hyperlinks", async () => {
    const rows = await parseMajorWorkbook(
      await file([
        ["A", { formula: '"Tên"', result: "Tên" }, "FIT", "ACTIVE"],
        [
          "B",
          { text: "Tên", hyperlink: "https://example.com" },
          "FIT",
          "ACTIVE",
        ],
      ]),
      10,
    );
    expect(rows.every((row) => row.errors.length > 0)).toBe(true);
  });
  it("reports missing/long/invalid fields", async () => {
    const [row] = await parseMajorWorkbook(
      await file([["bad code", "x".repeat(256), "", "OTHER"]]),
      10,
    );
    expect(row.errors).toHaveLength(4);
  });
  it("rejects missing sheet/header, empty workbook, corrupt archive and extra columns", async () => {
    for (const data of [
      Buffer.from("not xlsx"),
      await file([]),
      await file([["A", "Name", "FIT", "ACTIVE"]], (b) => {
        b.worksheets[0].name = "Other";
      }),
      await file([["A", "Name", "FIT", "ACTIVE"]], (b) => {
        b.worksheets[0].getCell("A1").value = "Wrong";
      }),
      await file([["A", "Name", "FIT", "ACTIVE", "Extra"]]),
    ])
      await expect(parseMajorWorkbook(data, 10)).rejects.toThrow();
  });
  it("bounds data rows and sparse worksheet row indexes", async () => {
    await expect(
      parseMajorWorkbook(
        await file([
          ["A", "A", "FIT", "ACTIVE"],
          ["B", "B", "FIT", "ACTIVE"],
        ]),
        1,
      ),
    ).rejects.toThrow();
    await expect(
      parseMajorWorkbook(
        await file([], (b) => {
          b.worksheets[0].getCell("A6000").value = "A";
        }),
        10,
      ),
    ).rejects.toThrow();
  });
});
