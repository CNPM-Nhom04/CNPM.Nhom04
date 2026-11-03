import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { MajorInputDto, MajorsQueryDto, UpdateMajorDto } from "./major.dto";
describe("Major DTO", () => {
  const input = {
    majorCode: "SP_TOAN",
    majorName: "Sư phạm Toán học",
    unitId: "1",
    status: "ACTIVE",
  };
  it("trims identifiers and names while preserving Unicode", async () => {
    const dto = plainToInstance(MajorInputDto, {
      ...input,
      majorCode: " SP_TOAN ",
      majorName: " Sư phạm Toán học ",
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.majorName).toBe("Sư phạm Toán học");
    expect(dto.majorCode).toBe("SP_TOAN");
  });
  it.each([
    { majorCode: "x;DROP TABLE majors" },
    { majorName: "   " },
    { unitId: "1 OR 1=1" },
    { status: "DELETED" },
  ])("rejects invalid SQL-backed field values %j", async (patch) => {
    expect(
      (await validate(plainToInstance(MajorInputDto, { ...input, ...patch })))
        .length,
    ).toBeGreaterThan(0);
  });
  it("requires a microsecond revision token for updates", async () => {
    expect(
      (await validate(plainToInstance(UpdateMajorDto, input))).length,
    ).toBeGreaterThan(0);
    expect(
      await validate(
        plainToInstance(UpdateMajorDto, {
          ...input,
          expectedUpdatedAt: "2026-11-02 00:00:00.123456",
        }),
      ),
    ).toHaveLength(0);
  });
  it("rejects invalid filters and oversized pages", async () => {
    expect(
      (
        await validate(
          plainToInstance(MajorsQueryDto, {
            page: 0,
            limit: 101,
            status: "REMOVED",
            unitId: "0",
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
