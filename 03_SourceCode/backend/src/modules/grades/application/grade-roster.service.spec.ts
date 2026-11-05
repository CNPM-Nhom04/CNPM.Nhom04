import { Workbook } from "exceljs";
import { GradeRosterService } from "./grade-roster.service";
import { GradeActor, GradeRepository } from "../domain/grade";
describe("roster Excel", () => {
  const actor = { id: "7", canManage: true, canPrepare: true } as GradeActor;
  const data = {
    members: [
      { studentCode: "HV1", studentName: "Một" },
      { studentCode: "HV2", studentName: "Hai" },
    ],
    offerings: [
      {
        offeringId: "5",
        offeringCode: "IT.1",
        courseCode: "IT",
        courseName: "Môn",
        capacity: 20,
        enrolled: 1,
        policyId: null,
      },
    ],
    registrations: [
      { studentCode: "HV1", offeringId: "5", status: "REGISTERED" },
    ],
  };
  let repository: any, service: GradeRosterService;
  beforeEach(() => {
    repository = {
      preparation: jest.fn().mockResolvedValue(data),
      prepareRegistrations: jest.fn().mockResolvedValue({ changed: 1 }),
    };
    service = new GradeRosterService(repository as GradeRepository);
  });
  async function file(edit: (book: Workbook) => void) {
    const bytes = await service.template("1", "2", actor),
      book = new Workbook();
    await book.xlsx.load(bytes as never);
    edit(book);
    const buffer = Buffer.from(await book.xlsx.writeBuffer());
    return { buffer, size: buffer.length, originalname: "roster.xlsx" };
  }
  it("prefills existing registrations and member codes without auto-assigning other students", async () => {
    const upload = await file((book) => {
      expect(book.worksheets.at(-1)?.name).toBe("Ví dụ điền đúng");
      const sheet = book.getWorksheet("Danh sach hoc")!;
      expect(sheet.getCell("A2").text).toBe("HV1");
      expect(sheet.getCell("B2").text).toBe("5");
      expect(sheet.getCell("A3").text).toBe("HV2");
      expect(sheet.getCell("B3").text).toBe("");
      sheet.getCell("B3").value = "5";
      sheet.getCell("C3").value = "Lập danh sách theo hồ sơ";
      sheet.getCell("D3").value = "HS1";
    });
    await service.import("1", "2", upload, actor, false);
    expect(repository.prepareRegistrations).toHaveBeenCalledWith(
      "1",
      "2",
      [
        expect.objectContaining({ studentCode: "HV1", offeringId: "5" }),
        expect.objectContaining({ studentCode: "HV2", offeringId: "5" }),
      ],
      actor,
      false,
    );
  });
  it("provides an optional ready-to-fill example while leaving the real reference empty", async () => {
    const book = new Workbook();
    await book.xlsx.load(
      (await service.template("1", "2", actor, true)) as never,
    );
    const sheet = book.getWorksheet("Danh sach hoc")!;
    expect(sheet.getCell("B2").text).toBe("5");
    expect(sheet.getCell("B3").text).toBe("5");
    expect(sheet.getCell("C3").text).toBe(
      "Bổ sung danh sách học theo hồ sơ đào tạo",
    );
    expect(sheet.getCell("D3").text).toBe("");
    expect(repository.prepareRegistrations).not.toHaveBeenCalled();
  });
  it("does not treat a member with a blank offering as an enrollment request", async () => {
    const upload = await file(() => {});
    await service.import("1", "2", upload, actor, true);
    expect(repository.prepareRegistrations.mock.calls[0][2]).toHaveLength(1);
  });
  it("blocks wrong context, formulas and missing registration permission", async () => {
    await expect(
      service.template("1", "2", { ...actor, canPrepare: false }),
    ).rejects.toThrow();
    let upload = await file((b) => {
      b.getWorksheet("_context")!.getCell("C1").value = "3";
    });
    await expect(
      service.import("1", "2", upload, actor, true),
    ).rejects.toThrow();
    upload = await file((b) => {
      b.getWorksheet("Danh sach hoc")!.getCell("B3").value = {
        formula: "2+3",
        result: 5,
      };
    });
    await expect(service.import("1", "2", upload, actor, true)).rejects.toThrow(
      "công thức",
    );
    expect(repository.prepareRegistrations).not.toHaveBeenCalled();
  });
});
