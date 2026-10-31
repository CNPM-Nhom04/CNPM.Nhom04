import { Workbook } from "exceljs";
import { ComparisonService } from "./comparison.service";
import { ComparisonRepository } from "../domain/comparison";
describe("Comparison Excel boundaries", () => {
  it("writes formula-like source strings as text and preserves long SQL text", async () => {
    const description = "Nội dung ".repeat(5000);
    const side = {
      programName: "=1+1",
      courses: [
        {
          courseId: "1",
          code: "=SUM(A1)",
          name: description,
          credits: 0,
          prerequisites: [],
          ploMappings: [],
        },
      ],
      groups: [],
      outcomes: [],
    };
    const repo = {
      snapshots: jest.fn().mockResolvedValue([side, side]),
    } as unknown as ComparisonRepository;
    const service = new ComparisonService(repo);
    const buffer = await service.export("1", {
      versionA: "1",
      trackA: "1",
      versionB: "1",
      trackB: "1",
    });
    const wb = new Workbook();
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const summary = wb.getWorksheet("Tong quan");
    expect(summary.getCell("B3").value).toBe("=1+1");
    expect(summary.getCell("B3").type).toBe(3); // ExcelJS String, not Formula.
    const sheet = wb.getWorksheet("Hoc phan");
    expect(sheet.getCell("A2").value).toBe("=SUM(A1)");
    const names = [];
    for (let row = 2; row <= sheet.rowCount; row++)
      names.push(sheet.getCell(row, 4).value);
    expect(names.join("")).toBe(description);
  });
});
