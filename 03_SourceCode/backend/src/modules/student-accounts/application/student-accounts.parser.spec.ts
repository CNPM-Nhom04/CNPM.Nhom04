import { addExampleSheet } from "../../../core/excel/examples";
import { Workbook } from "exceljs";
import {
  parseStudentAccounts,
  STUDENT_HEADERS,
} from "./student-accounts.parser";
import { initialStudentPassword } from "./student-accounts.service";
async function file(rows: unknown[][]) {
  const b = new Workbook(),
    s = b.addWorksheet("Hoc vien");
  s.addRow(STUDENT_HEADERS);
  rows.forEach((r) => s.addRow(r));
  return Buffer.from(await b.xlsx.writeBuffer());
}
describe("Student account Excel boundary", () => {
  it("never imports demonstration students from the final example sheet", async () => {
    const book = new Workbook(),
      sheet = book.addWorksheet("Hoc vien");
    sheet.addRow(STUDENT_HEADERS);
    sheet.addRow(["REAL001", "Nguyễn Văn An", "an@example.com", "real001"]);
    addExampleSheet(book, sheet, [
      ["VD_HV_001", "Nguyễn Văn Minh", "minh.vidu@example.com", "vidu001"],
    ]);
    const parsed = await parseStudentAccounts(
      Buffer.from(await book.xlsx.writeBuffer()),
      200,
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].studentCode).toBe("REAL001");
  });
  it("preserves leading zeros and derives a normalized username without inventing an email", async () => {
    const [row] = await parseStudentAccounts(
      await file([["00123", " Nguyễn Văn An ", "AN@example.com", ""]]),
      200,
    );
    expect(row).toMatchObject({
      studentCode: "00123",
      fullName: "Nguyễn Văn An",
      email: "an@example.com",
      username: "00123",
      errors: [],
    });
  });
  it("accepts automatic Excel mailto email links as plain addresses", async () => {
    const [row] = await parseStudentAccounts(
      await file([
        [
          "HV2026001",
          "Nguyễn Văn An",
          {
            text: "hv2026001@example.com",
            hyperlink: "mailto:hv2026001@example.com",
          },
          "",
        ],
      ]),
      200,
    );
    expect(row.email).toBe("hv2026001@example.com");
    expect(row.errors).toEqual([]);
  });
  it("rejects email formulas, web links and mismatched mailto targets", async () => {
    const rows = await parseStudentAccounts(
      await file([
        [
          "SV101",
          "An",
          { formula: '\"a@example.com\"', result: "a@example.com" },
          "",
        ],
        [
          "SV102",
          "Bình",
          { text: "b@example.com", hyperlink: "https://example.com" },
          "",
        ],
        [
          "SV103",
          "Cường",
          { text: "c@example.com", hyperlink: "mailto:other@example.com" },
          "",
        ],
      ]),
      200,
    );
    expect(rows.every((row) => row.errors.length > 0)).toBe(true);
  });
  it("marks duplicate IDs, usernames and emails before any SQL write", async () => {
    const rows = await parseStudentAccounts(
      await file([
        ["SV01", "An", "a@example.com", "Login"],
        ["sv01", "Bình", "A@example.com", "login"],
      ]),
      200,
    );
    expect(rows.every((r) => r.errors.length === 3)).toBe(true);
  });
  it("rejects formulas/hyperlinks and invalid or missing fields", async () => {
    const rows = await parseStudentAccounts(
      await file([
        ["SV01", { formula: '"An"', result: "An" }, "", ""],
        [
          "SV02",
          { text: "An", hyperlink: "https://example.com" },
          "invalid",
          "x",
        ],
      ]),
      200,
    );
    expect(rows.every((r) => r.errors.length > 0)).toBe(true);
  });
  it("rejects wrong files, empty data and oversized sheets", async () => {
    await expect(
      parseStudentAccounts(Buffer.from("bad"), 200),
    ).rejects.toThrow();
    await expect(parseStudentAccounts(await file([]), 200)).rejects.toThrow();
    await expect(
      parseStudentAccounts(
        await file([
          ["SV1", "An", "a@example.com", ""],
          ["SV2", "Bình", "b@example.com", ""],
        ]),
        1,
      ),
    ).rejects.toThrow();
  });
  it("generates distinct passwords meeting the SQL length and login policy", () => {
    const values = Array.from({ length: 50 }, () => initialStudentPassword(20));
    expect(new Set(values).size).toBe(50);
    expect(
      values.every(
        (p) => p.length === 20 && /[A-Za-z]/.test(p) && /\d/.test(p),
      ),
    ).toBe(true);
    expect(initialStudentPassword(72)).toHaveLength(72);
  });
});
