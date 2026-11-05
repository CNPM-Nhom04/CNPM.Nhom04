import { Workbook } from "exceljs";
import {
  addExampleSheet,
  exampleValue,
  EXAMPLE_SHEET,
  ExampleField,
} from "./examples";
import { exportSheet } from "./workbook";
describe("examples at end of Excel templates", () => {
  it("keeps the input sheet unchanged and appends a clearly marked, readable example", async () => {
    const book = new Workbook(),
      input = exportSheet(book, "Du lieu", ["Mã", "Nội dung"]);
    input.addRow(["REAL", "Dữ liệu thật"]);
    book.addWorksheet("Huong dan");
    addExampleSheet(
      book,
      input,
      [["VD001", "Ví dụ"]],
      ["Thay bằng dữ liệu thực tế."],
    );
    expect(book.worksheets.at(-1)?.name).toBe(EXAMPLE_SHEET);
    expect(input.rowCount).toBe(2);
    expect(input.getCell("A2").text).toBe("REAL");
    const encoded = await book.xlsx.writeBuffer(),
      copy = new Workbook();
    await copy.xlsx.load(encoded as never);
    const example = copy.getWorksheet(EXAMPLE_SHEET)!;
    expect(example.getCell("A2").text).toBe("VD001");
    expect(example.getCell("A4").text).toContain("CHỈ THAM KHẢO");
    expect(example.getRow(4).height).toBe(45);
  });
  const field = (patch: Partial<ExampleField>): ExampleField => ({
    id: "test",
    label: "Thông tin",
    type: "text",
    value: "",
    required: true,
    readonly: false,
    ...patch,
  });
  it("uses allowed database choices instead of inventing IDs", () =>
    expect(
      exampleValue(
        field({
          type: "select-one",
          options: [
            { value: "", label: "Chọn" },
            { value: "17", label: "Khoa" },
          ],
        }),
      ),
    ).toBe("17"));
  it("keeps immutable values and never exports an existing password", () => {
    expect(exampleValue(field({ value: "17", readonly: true }))).toBe("17");
    const password = exampleValue(
      field({
        type: "password",
        value: "actual-private-password",
        minLength: 20,
      }),
    );
    expect(password).not.toContain("actual-private");
    expect(password.length).toBeGreaterThanOrEqual(20);
  });
  it("respects numerical ranges including invalid empty-form defaults", () => {
    expect(
      exampleValue(field({ type: "number", min: "60", max: "90", value: "0" })),
    ).toBe("60");
    expect(
      exampleValue(field({ type: "number", min: "0.5", max: "0.5" })),
    ).toBe("0.5");
  });
  it("fills valid reason and explicitly fictional reference formats", () => {
    expect(
      exampleValue(field({ label: "Lý do thay đổi" })).length,
    ).toBeGreaterThanOrEqual(10);
    expect(exampleValue(field({ label: "Số hồ sơ" }))).toBe("VD-HS-2026-001");
  });
});
