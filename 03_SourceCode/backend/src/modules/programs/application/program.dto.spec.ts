import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  CurriculumDto,
  CourseInputDto,
  ProgramInputDto,
  ProgramQueryDto,
  ReviewDto,
} from "./program.dto";
describe("Program DTO validation", () => {
  const input = {
    maCTDT: "MS-TEST",
    tenCTDT: "Test",
    educationLevelId: "1",
    managingUnitId: "1",
    majorId: "1",
    khoaTuyenSinh: "2026 - 2028",
    tongTinChiYeuCau: 60,
  };
  it("accepts minimal draft input", async () =>
    expect(
      await validate(plainToInstance(ProgramInputDto, input)),
    ).toHaveLength(0));
  it.each([
    { maCTDT: "bad code" },
    { tongTinChiYeuCau: -1 },
    { ngayBanHanh: "2026-02-30" },
    { tenCTDT: "   " },
    { majorId: "1 OR 1=1" },
  ])("rejects invalid input %j", async (patch) =>
    expect(
      (await validate(plainToInstance(ProgramInputDto, { ...input, ...patch })))
        .length,
    ).toBeGreaterThan(0),
  );
  it("converts paging parameters", async () => {
    const query = plainToInstance(ProgramQueryDto, { page: "2", limit: "10" });
    expect(await validate(query)).toHaveLength(0);
    expect(query.page).toBe(2);
  });
  it("rejects duplicate track IDs", async () => {
    const body = plainToInstance(CurriculumDto, {
      revision: 1,
      tracks: [
        { id: "1", groups: [], courses: [] },
        { id: "1", groups: [], courses: [] },
      ],
    });
    expect((await validate(body)).length).toBeGreaterThan(0);
  });
  it("rejects invalid conclusion and impossible meeting date", async () => {
    const body = plainToInstance(ReviewDto, {
      revision: 1,
      hoiDongThamDinh: "Hội đồng",
      chuTichHoidong: "A",
      thuKhao: "B",
      ngayHop: "2026-02-30",
      ketLuan: "APPROVE",
    });
    expect((await validate(body)).length).toBeGreaterThan(0);
  });
  it("preserves a SQL-unassigned semester as null", async () => {
    expect(
      await validate(
        plainToInstance(CourseInputDto, {
          courseVersionId: "1",
          groupId: "1",
          requirementType: "REQUIRED",
          semester: null,
        }),
      ),
    ).toHaveLength(0);
  });
});
