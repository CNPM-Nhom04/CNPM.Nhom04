import { Workbook } from "exceljs";
import { ProgramImportService } from "./program-import.service";
import {
  ProgramActor,
  ProgramItem,
  ProgramRepository,
} from "../domain/program";

describe("CTDT Excel preview", () => {
  const actor = { id: "1", permissions: ["PROGRAM_EDIT"] } as ProgramActor;
  const item = {
    revision: 4,
    status: "DRAFT",
    tracks: [
      {
        id: "2",
        code: "UD",
        name: "Ứng dụng",
        courses: [],
        groups: [{ id: "3", code: "A", name: "Chung" }],
      },
    ],
  } as unknown as ProgramItem;
  let service: ProgramImportService;
  let repository: { detail: jest.Mock; catalog: jest.Mock };
  beforeEach(() => {
    repository = {
      detail: jest.fn().mockResolvedValue(item),
      catalog: jest.fn().mockResolvedValue({
        data: [
          {
            id: "7",
            courseId: "6",
            code: "CS101",
            name: "Tin học",
            credits: 3,
          },
        ],
      }),
    };
    service = new ProgramImportService(
      repository as unknown as ProgramRepository,
    );
  });
  async function file(rows: unknown[][]) {
    const book = new Workbook();
    book
      .addWorksheet("Nhap hoc phan")
      .addRows([
        ["Mã học phần", "Mã nhóm", "Tín chỉ", "Tính chất", "Học kỳ"],
        ...rows,
      ]);
    const buffer = Buffer.from(await book.xlsx.writeBuffer());
    return { buffer, size: buffer.length, originalname: "ctdt.xlsx" };
  }
  it("round trips the template and resolves code, group and credits without writing", async () => {
    const buffer = await service.template("1", "2", actor);
    const book = new Workbook();
    await book.xlsx.load(buffer as never);
    book
      .getWorksheet("Nhap hoc phan")!
      .addRow(["cs101", "a", "", "Tự chọn", 2]);
    const bytes = Buffer.from(await book.xlsx.writeBuffer());
    const result = await service.preview(
      "1",
      "2",
      { buffer: bytes, size: bytes.length, originalname: "a.xlsx" },
      actor,
    );
    expect(result).toMatchObject({
      valid: true,
      revision: 4,
      trackId: "2",
      courses: [
        {
          courseId: "6",
          courseVersionId: "7",
          credits: 3,
          groupId: "3",
          requirementType: "ELECTIVE",
          semester: 2,
        },
      ],
    });
  });
  it.each([
    [["CS101", "Z", 3], "không thuộc hướng"],
    [["CS101", "A", 4], "phải bằng 3"],
    [["CS101", "A", 3, "khác"], "Tính chất"],
    [["CS101", "A", 3, "", 31], "Học kỳ"],
    [["CS101", "A", { formula: "1+2", result: 3 }], "công thức"],
  ])("rejects invalid row %j", async (row, message) => {
    const result = await service.preview("1", "2", await file([row]), actor);
    expect(result.valid).toBe(false);
    expect(result.issues.join()).toContain(message);
  });
  it("rejects duplicate codes and an empty workbook", async () => {
    const result = await service.preview(
      "1",
      "2",
      await file([
        ["CS101", "A"],
        ["cs101", "A"],
      ]),
      actor,
    );
    expect(result.valid).toBe(false);
    expect(result.issues.join()).toContain("lặp");
    expect((await service.preview("1", "2", await file([]), actor)).valid).toBe(
      false,
    );
  });
  it("reports group totals and rejects a merged group beyond its maximum", async () => {
    const limited = structuredClone(item);
    limited.tracks[0].groups[0].maximumCredits = 2;
    repository.detail.mockResolvedValue(limited);
    const result = await service.preview(
      "1",
      "2",
      await file([["CS101", "A"]]),
      actor,
    );
    expect(result.groups).toEqual([{ code: "A", credits: 3 }]);
    expect(result.valid).toBe(false);
    expect(result.issues.join()).toContain("vượt giới hạn 2 TC");
  });
  it("rejects unavailable and ambiguous versions", async () => {
    repository.catalog
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ code: "CS101" }, { code: "CS101" }] });
    expect(
      (await service.preview("1", "2", await file([["CS101", "A"]]), actor))
        .valid,
    ).toBe(false);
    expect(
      (await service.preview("1", "2", await file([["CS101", "A"]]), actor))
        .valid,
    ).toBe(false);
  });
  it("blocks unauthorized, locked, wrong-track and malformed uploads", async () => {
    await expect(
      service.template("1", "2", { ...actor, permissions: [] }),
    ).rejects.toThrow();
    await expect(service.template("1", "99", actor)).rejects.toThrow();
    repository.detail.mockResolvedValueOnce({ ...item, status: "PUBLISHED" });
    await expect(service.template("1", "2", actor)).rejects.toThrow();
    await expect(service.preview("1", "2", undefined, actor)).rejects.toThrow();
    await expect(
      service.preview(
        "1",
        "2",
        { buffer: Buffer.from("bad"), size: 3, originalname: "x.xlsx" },
        actor,
      ),
    ).rejects.toThrow();
  });
});
