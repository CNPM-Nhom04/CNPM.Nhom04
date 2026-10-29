import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  CreateDefenseDto,
  DefenseQueryDto,
  RecordDefenseResultDto,
} from "./thesis-defense.dto";
describe("Thesis defense input validation", () => {
  it.each([0, 5.49, 5.5, 10])("accepts valid score %s", async (score) => {
    expect(
      await validate(
        plainToInstance(RecordDefenseResultDto, { diemTrungBinh: score }),
      ),
    ).toHaveLength(0);
  });
  it.each([-1, 10.01, 5.555, null, "8.6", true])(
    "rejects invalid score %s",
    async (score) => {
      expect(
        (
          await validate(
            plainToInstance(RecordDefenseResultDto, { diemTrungBinh: score }),
          )
        ).length,
      ).toBeGreaterThan(0);
    },
  );
  it("rejects impossible calendar dates", async () => {
    expect(
      (
        await validate(
          plainToInstance(CreateDefenseDto, {
            maHocVien: "HV1",
            tenDeTai: "Test",
            ngayBaoVe: "2026-02-30",
            diaDiem: "A",
            chuTichHoidong: "B",
          }),
        )
      ).some((error) => error.property === "ngayBaoVe"),
    ).toBe(true);
  });
  it("transforms and validates paging values", async () => {
    const valid = plainToInstance(DefenseQueryDto, { page: "2", limit: "10" });
    expect(await validate(valid)).toHaveLength(0);
    expect(valid.page).toBe(2);
    expect(
      (
        await validate(
          plainToInstance(DefenseQueryDto, { page: "0", limit: "101" }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});

it("does not default a missing passing threshold", async () => {
  const dto = plainToInstance(CreateDefenseDto, {});
  expect(dto.diemDat).toBeUndefined();
  expect(
    (await validate(dto)).some((error) => error.property === "diemDat"),
  ).toBe(true);
});
it("rejects a string used as eligibility confirmation", async () => {
  const dto = plainToInstance(CreateDefenseDto, {
    eligibilityConfirmed: "true",
  });
  expect(
    (await validate(dto)).some(
      (error) => error.property === "eligibilityConfirmed",
    ),
  ).toBe(true);
});
