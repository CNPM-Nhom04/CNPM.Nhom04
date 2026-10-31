import { compareSnapshots, diffRows } from "./compare";
import { ComparisonCourse, ComparisonSnapshot } from "./comparison";
const course = (id = "1"): ComparisonCourse => ({
  courseId: id,
  code: "INF501",
  courseVersionId: "10",
  versionNumber: 1,
  name: "Học phần",
  englishName: null,
  credits: 3,
  theoryHours: 30,
  practiceHours: 15,
  description: null,
  groupCode: "CS",
  requirementType: "REQUIRED",
  semester: null,
  notes: null,
  prerequisites: [],
  ploMappings: [],
});
const snapshot = (courses: ComparisonCourse[]): ComparisonSnapshot => ({
  versionId: "1",
  programCode: "MS",
  programName: "Thạc sĩ",
  versionCode: "v1",
  status: "DRAFT",
  cohortYear: 2026,
  unitName: "CNTT",
  levelName: "Thạc sĩ",
  majorName: "KHMT",
  studyForm: null,
  duration: null,
  cohortLabel: null,
  languageRequirement: null,
  itRequirement: null,
  versionRequiredCredits: null,
  effectiveFrom: null,
  effectiveTo: null,
  trackId: "1",
  trackCode: "NC",
  trackName: "Nghiên cứu",
  trackStatus: "ACTIVE",
  requiredCredits: 60,
  groups: [],
  courses,
  outcomes: [],
});
describe("SQL curriculum comparison semantics", () => {
  it("same structure including same side returns SAME", () => {
    const a = snapshot([course()]);
    const result = compareSnapshots(a, a);
    expect(result.summary).toEqual({
      same: 1,
      changed: 0,
      onlyA: 0,
      onlyB: 0,
      listedCreditsA: 3,
      listedCreditsB: 3,
    });
  });
  it("matches stable course identity, detects exact referenced version and placement", () => {
    const a = course(),
      b = {
        ...course(),
        courseVersionId: "11",
        versionNumber: 2,
        credits: 4,
        groupCode: "CN",
        requirementType: "ELECTIVE",
        semester: 0,
      };
    const result = diffRows([a], [b], (x) => x.courseId)[0];
    expect(result.status).toBe("CHANGED");
    expect(result.changedFields).toEqual(
      expect.arrayContaining([
        "courseVersionId",
        "versionNumber",
        "credits",
        "groupCode",
        "requirementType",
        "semester",
      ]),
    );
  });
  it("distinguishes missing from zero and does not infer grades or credit quotas", () => {
    const a = snapshot([{ ...course(), credits: 0 }]),
      b = snapshot([]);
    const result = compareSnapshots(a, b);
    expect(result.courses[0].status).toBe("ONLY_A");
    expect(result.courses[0].b).toBeNull();
    expect(result.summary.listedCreditsA).toBe(0);
    expect(result.a.requiredCredits).toBe(60);
  });
  it("ignores order but detects prerequisite threshold and PLO content changes", () => {
    const a = {
      ...course(),
      prerequisites: [
        { courseId: "2", code: "A", minimumGrade: null },
        { courseId: "3", code: "B", minimumGrade: "5" },
      ],
    };
    const b = { ...a, prerequisites: [...a.prerequisites].reverse() };
    expect(diffRows([a], [b], (x) => x.courseId)[0].status).toBe("SAME");
    b.prerequisites = [
      { courseId: "2", code: "A", minimumGrade: "0" },
      a.prerequisites[1],
    ];
    expect(diffRows([a], [b], (x) => x.courseId)[0].changedFields).toEqual([
      "prerequisites",
    ]);
  });
  it("does not merge different IDs with identical names/codes", () => {
    const result = compareSnapshots(
      snapshot([course("1")]),
      snapshot([course("2")]),
    );
    expect(result.summary.onlyA).toBe(1);
    expect(result.summary.onlyB).toBe(1);
  });
  it("swapping A/B reverses additions and removals", () => {
    const a = snapshot([course("1")]),
      b = snapshot([course("2"), course("3")]);
    expect(compareSnapshots(a, b).summary.onlyA).toBe(
      compareSnapshots(b, a).summary.onlyB,
    );
  });
  it("uses group/PLO codes across version-local IDs", () => {
    const result = diffRows(
      [{ code: "G1", minimum: 0 }],
      [{ code: "G1", minimum: 1 }],
      (x) => x.code,
    );
    expect(result).toHaveLength(1);
    expect(result[0].changedFields).toEqual(["minimum"]);
  });
});
