import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ComparisonDto, ComparisonOptionsDto } from "./comparison.dto";
describe("Comparison query validation", () => {
  it.each(["0", "-1", "1 OR 1=1", "1.5", "", "184467440737095516160"])(
    "rejects invalid identity %s",
    async (value) => {
      const dto = plainToInstance(ComparisonDto, {
        versionA: value,
        trackA: "1",
        versionB: "2",
        trackB: "3",
      });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    },
  );
  it("requires all four IDs", async () =>
    expect((await validate(new ComparisonDto())).length).toBe(4));
  it("preserves BIGINT string without Number rounding", async () => {
    const dto = plainToInstance(ComparisonDto, {
      versionA: "18446744073709551615",
      trackA: "1",
      versionB: "2",
      trackB: "3",
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.versionA).toBe("18446744073709551615");
  });
  it.each([
    { page: 0 },
    { limit: 101 },
    { page: 1.5 },
    { searchTerm: "a".repeat(256) },
  ])("rejects invalid pagination/search %p", async (data) => {
    expect(
      (await validate(plainToInstance(ComparisonOptionsDto, data))).length,
    ).toBeGreaterThan(0);
  });
});
