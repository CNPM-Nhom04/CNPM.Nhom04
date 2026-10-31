import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  ApprovalDecisionDto,
  ApprovalQueryDto,
  ApprovalRevisionDto,
} from "./approval.dto";
const decision = {
  revision: 0,
  requestRevision: 0,
  hoiDongThamDinh: "Hội đồng",
  chuTichHoidong: "Người A",
  thuKhao: "Người B",
  ngayHop: "2026-10-31",
  ketLuan: "YEU_CAU_SUA_DOI",
  yKienDongGop: "Bổ sung nội dung",
  soBienBan: "",
};
describe("Approval payload boundaries", () => {
  it("requires explicit conclusion and both revisions", async () => {
    expect(
      await validate(plainToInstance(ApprovalDecisionDto, decision)),
    ).toHaveLength(0);
    for (const key of ["revision", "requestRevision", "ketLuan"]) {
      const input = { ...decision };
      delete input[key];
      expect(
        (await validate(plainToInstance(ApprovalDecisionDto, input))).length,
      ).toBeGreaterThan(0);
    }
  });
  it.each(["0", false, -1, 1.5])(
    "rejects noninteger numeric revision %p",
    async (value) => {
      expect(
        (
          await validate(
            plainToInstance(ApprovalRevisionDto, { requestRevision: value }),
          )
        ).length,
      ).toBeGreaterThan(0);
    },
  );
  it.each([
    { status: "PUBLISHED" },
    { reviewState: "OTHER" },
    { versionId: "0" },
    { page: 0 },
    { limit: 101 },
    { searchTerm: "x".repeat(256) },
  ])("rejects invalid filter %p", async (input) => {
    expect(
      (await validate(plainToInstance(ApprovalQueryDto, input))).length,
    ).toBeGreaterThan(0);
  });
  it("rejects impossible meeting dates", async () => {
    expect(
      (
        await validate(
          plainToInstance(ApprovalDecisionDto, {
            ...decision,
            ngayHop: "2026-02-30",
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
