import { calculateGrade, validatePolicy } from "./calculate-grade";
import { GradePolicyInput } from "./grade";
describe("SQL grading policy arithmetic", () => {
  const policy: GradePolicyInput = {
    revision: 0,
    attendanceWeight: 10,
    midtermWeight: 30,
    examWeight: 60,
    passingScore: 5.5,
    decimalPlaces: 1,
    rounding: "HALF_UP",
    reference: "TEST-POLICY",
  };
  it("uses the explicit supplied policy, not hidden constants", () => {
    expect(
      calculateGrade(
        { attendanceScore: 9, midtermScore: 8.5, examScore: 8 },
        policy,
      ),
    ).toBe(8.3);
    expect(
      calculateGrade(
        { attendanceScore: 9, midtermScore: 8.5, examScore: 8 },
        { ...policy, attendanceWeight: 100, midtermWeight: 0, examWeight: 0 },
      ),
    ).toBe(9);
  });
  it("keeps unentered weighted components null", () => {
    expect(
      calculateGrade(
        { attendanceScore: 0, midtermScore: null, examScore: 8 },
        policy,
      ),
    ).toBeNull();
  });
  it("preserves a genuine zero and allows omitted zero-weight components", () => {
    expect(
      calculateGrade(
        { attendanceScore: 0 },
        { ...policy, attendanceWeight: 100, midtermWeight: 0, examWeight: 0 },
      ),
    ).toBe(0);
  });
  it("rounds exact decimal half boundaries without binary floating-point drift", () => {
    expect(
      calculateGrade(
        { attendanceScore: 1.01, midtermScore: 1.02 },
        {
          ...policy,
          attendanceWeight: 50,
          midtermWeight: 50,
          examWeight: 0,
          decimalPlaces: 2,
        },
      ),
    ).toBe(1.02);
  });
  it("supports explicitly configured truncation", () => {
    expect(
      calculateGrade(
        { attendanceScore: 1.25 },
        {
          ...policy,
          attendanceWeight: 100,
          midtermWeight: 0,
          examWeight: 0,
          rounding: "TRUNCATE",
        },
      ),
    ).toBe(1.2);
  });
  it("supports integer precision", () => {
    expect(
      calculateGrade(
        { attendanceScore: 9.5 },
        {
          ...policy,
          attendanceWeight: 100,
          midtermWeight: 0,
          examWeight: 0,
          decimalPlaces: 0,
        },
      ),
    ).toBe(10);
  });
  it("accepts two-decimal weights that sum exactly to 100", () => {
    expect(
      calculateGrade(
        { attendanceScore: 1, midtermScore: 2, examScore: 3 },
        {
          ...policy,
          attendanceWeight: 33.33,
          midtermWeight: 33.33,
          examWeight: 33.34,
          decimalPlaces: 2,
        },
      ),
    ).toBe(2);
  });
  it("rejects invalid weight totals", () => {
    expect(() => validatePolicy({ ...policy, examWeight: 59.99 })).toThrow(
      "100%",
    );
  });
});
