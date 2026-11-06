import { Workbook } from "exceljs";
import { ConfigService } from "@nestjs/config";
import { GradeExcelService } from "./grade-excel.service";
import { GradeActor, GradeRepository } from "../domain/grade";
describe("grade workbook", () => {
  const actor = { id: "7", canManage: true } as GradeActor;
  const original = {
    registrationId: "11",
    resultId: "21",
    studentId: "31",
    studentCode: "HV1",
    studentName: "Học viên",
    courseCode: "IT1",
    courseName: "Môn",
    offeringCode: "IT1-1",
    state: "DRAFT",
    attendanceScore: 0,
    midtermScore: 5,
    examScore: null,
    policyId: "9",
    policyRevision: 1,
  };
  let service: GradeExcelService,
    repository: { excelRows: jest.Mock; importRows: jest.Mock };
  beforeEach(() => {
    repository = {
      excelRows: jest.fn().mockResolvedValue([original]),
      importRows: jest.fn().mockResolvedValue({ changed: 1 }),
    };
    service = new GradeExcelService(
      repository as unknown as GradeRepository,
      new ConfigService({ JWT_SECRET: "test-only-workbook-key" }),
    );
  });
  async function edited(edit: (book: Workbook) => void) {
    const bytes = await service.template("1", "2", actor);
    const book = new Workbook();
    await book.xlsx.load(bytes as never);
    edit(book);
    const buffer = Buffer.from(await book.xlsx.writeBuffer());
    return { buffer, size: buffer.length, originalname: "grade.xlsx" };
  }
  it("prefills previous points, preserving zero and missing values, and delegates signed originals", async () => {
    const file = await edited((book) => {
      const sheet = book.getWorksheet("Bang diem")!;
      expect(sheet.getCell("H2").value).toBe(0);
      expect(sheet.getCell("I2").value).toBe(5);
      expect(sheet.getCell("J2").value).toBeNull();
      sheet.getCell("J2").value = 8;
      sheet.getCell("K2").value = "Bổ sung điểm theo hồ sơ";
      sheet.getCell("L2").value = "HS-1";
    });
    await service.import("1", "2", file, actor, false);
    expect(repository.importRows).toHaveBeenCalledWith(
      "1",
      "2",
      [
        expect.objectContaining({
          original,
          values: { attendanceScore: 0, midtermScore: 5, examScore: 8 },
        }),
      ],
      actor,
      false,
    );
  });
  it("exports only the selected course and rejects using its workbook for another course", async () => {
    repository.excelRows.mockResolvedValue([
      { ...original, courseVersionId: "3" },
      { ...original, registrationId: "12", courseVersionId: "4" },
    ]);
    const bytes = await service.template("1", "2", actor, "3");
    const book = new Workbook();
    await book.xlsx.load(bytes as never);
    expect(book.getWorksheet("Bang diem")!.getCell("A2").text).toBe("11");
    expect(book.getWorksheet("Bang diem")!.getCell("A3").text).toBe("");
    const file = {
      buffer: bytes,
      size: bytes.length,
      originalname: "grade.xlsx",
    };
    await expect(
      service.import("1", "2", file, actor, false, "4"),
    ).rejects.toThrow("File mẫu");
    expect(repository.importRows).not.toHaveBeenCalled();
  });
  it.each(["identity", "formula", "score", "signature", "context"])(
    "rejects tampered %s before writes",
    async (kind) => {
      const file = await edited((book) => {
        const s = book.getWorksheet("Bang diem")!;
        if (kind === "identity") s.getCell("B2").value = "OTHER";
        if (kind === "formula")
          s.getCell("J2").value = { formula: "2+3", result: 5 };
        if (kind === "score") s.getCell("J2").value = 11;
        if (kind === "signature")
          book.getWorksheet("_snapshot")!.getCell("B2").value = "{}";
        if (kind === "context")
          book.getWorksheet("_snapshot")!.getCell("B1").value = "other";
      });
      await expect(
        service.import("1", "2", file, actor, true),
      ).rejects.toThrow();
      expect(repository.importRows).not.toHaveBeenCalled();
    },
  );
  it("rejects files for another officer and duplicate identities", async () => {
    const file = await edited((book) =>
      book
        .getWorksheet("Bang diem")!
        .addRow(book.getWorksheet("Bang diem")!.getRow(2).values),
    );
    await expect(service.import("1", "2", file, actor, true)).rejects.toThrow();
    const valid = await edited(() => {});
    await expect(
      service.import("1", "2", valid, { ...actor, id: "8" }, true),
    ).rejects.toThrow();
  });
});
