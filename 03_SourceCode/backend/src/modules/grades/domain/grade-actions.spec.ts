import { gradeActionAvailability, GradeActionContext } from "./grade-actions";
describe("grade operation eligibility shown to users", () => {
  const ready: GradeActionContext = {
    state: "DRAFT",
    classStatus: "COMPLETED",
    registrationStatus: "REGISTERED",
    totalScore: 8,
    policyId: "1",
  };
  it("only enables finalization for a complete valid draft", () =>
    expect(gradeActionAvailability(ready, true).chot).toEqual({
      allowed: true,
      reason: "",
    }));
  it("does not confuse a failing score of zero with a missing score", () =>
    expect(
      gradeActionAvailability({ ...ready, totalScore: 0 }, true).chot.allowed,
    ).toBe(true));
  it.each(["PLANNED", "OPEN", "CLOSED", "CONFIRMED", "CANCELLED"])(
    "explains that class %s is not complete",
    (classStatus) => {
      const result = gradeActionAvailability(
        { ...ready, classStatus },
        true,
      ).chot;
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("chưa hoàn tất");
    },
  );
  it("explains missing points, policy and revoked enrollment", () => {
    expect(
      gradeActionAvailability({ ...ready, totalScore: null }, true).chot.reason,
    ).toContain("Chưa đủ điểm");
    expect(
      gradeActionAvailability({ ...ready, policyId: null }, true).chot.reason,
    ).toContain("chưa có quy tắc");
    expect(
      gradeActionAvailability(
        { ...ready, registrationStatus: "CANCELLED" },
        true,
      ).chot.reason,
    ).toContain("không còn hiệu lực");
  });
  it("keeps cancellation available for existing drafts even if the class is open", () =>
    expect(
      gradeActionAvailability({ ...ready, classStatus: "OPEN" }, true).huy
        .allowed,
    ).toBe(true));
  it("allows reopening only a voided result with a valid registration and class", () => {
    expect(gradeActionAvailability(ready, true)["mo-lai"].allowed).toBe(false);
    expect(
      gradeActionAvailability(
        { ...ready, state: "VOIDED", classStatus: "OPEN" },
        true,
      )["mo-lai"].allowed,
    ).toBe(true);
    expect(
      gradeActionAvailability(
        { ...ready, state: "VOIDED", classStatus: "CANCELLED" },
        true,
      )["mo-lai"].allowed,
    ).toBe(false);
  });
  it("does not offer mutations to readers or lifecycle commands for legacy results", () => {
    expect(
      Object.values(gradeActionAvailability(ready, false)).every(
        (a) => !a.allowed,
      ),
    ).toBe(true);
    expect(
      Object.values(
        gradeActionAvailability({ ...ready, state: "LEGACY" }, true),
      ).every((a) => !a.allowed),
    ).toBe(true);
  });
});
