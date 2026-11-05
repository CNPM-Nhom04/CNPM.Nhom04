import { isAllowedItRequirement } from "./it-requirements";
describe("CNTT requirement choices", () => {
  it.each(["MOS", " ICDL ", "A1", "A 1", "a  1", "mos"])(
    "removes %s even from legacy values",
    (value) => {
      expect(isAllowedItRequirement(value)).toBe(false);
    },
  );
  it.each([
    "Chuẩn kỹ năng sử dụng CNTT cơ bản",
    "Chuẩn kỹ năng sử dụng CNTT nâng cao",
    "Không yêu cầu",
    "Bằng CNTT",
  ])("keeps %s", (value) => {
    expect(isAllowedItRequirement(value)).toBe(true);
  });
});
