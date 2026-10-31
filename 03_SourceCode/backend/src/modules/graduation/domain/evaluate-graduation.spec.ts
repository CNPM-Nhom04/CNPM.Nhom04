import { GraduationInput } from "./graduation";
import { evaluateGraduation } from "./evaluate-graduation";
const day = "2026-10-31";
function input(): GraduationInput {
  return {
    assignmentId: "1",
    studentId: "1",
    studentCode: "HV1",
    studentName: "Học viên",
    studentStatus: "ACTIVE",
    assignmentStatus: "ACTIVE",
    trackId: "1",
    trackCode: "RESEARCH",
    trackName: "Nghiên cứu",
    requiredCredits: 6,
    versionId: "1",
    versionCode: "v1",
    versionStatus: "PUBLISHED",
    programId: "1",
    programCode: "P",
    programName: "Chương trình",
    unitId: "1",
    unitName: "Khoa",
    levelId: "1",
    levelName: "Bậc",
    groups: [
      {
        id: "G1",
        parentId: null,
        code: "BB",
        name: "Bắt buộc",
        minimum: 3,
        maximum: 3,
      },
      {
        id: "G2",
        parentId: null,
        code: "TC",
        name: "Tự chọn",
        minimum: 3,
        maximum: 3,
      },
    ],
    courses: [1, 2, 3].map((n) => ({
      id: String(n),
      courseId: String(n),
      courseVersionId: String(n),
      code: "C" + n,
      name: "Học phần " + n,
      credits: 3,
      groupId: n === 1 ? "G1" : "G2",
      required: n === 1,
    })),
    results: [1, 2, 3].map((n) => ({
      id: String(n),
      courseId: String(n),
      courseVersionId: String(n),
      status: "PASSED",
      grade: "8",
      passedAt: "2026-01-01T00:00:00.000Z",
    })),
    defenses: [{ id: "1", status: "DA_DAT", date: day, score: 8 }],
    policy: {
      trackId: "1",
      revision: 1,
      requireGpa: true,
      minimumGpa: 7.25,
      requireLanguage: true,
      languageRule: "Chuẩn trong SQL",
      requireDefense: true,
      otherRequirements: null,
      reference: "QD",
      updatedBy: "9",
      updatedAt: day,
    },
    evidence: {
      assignmentId: "1",
      revision: 1,
      policyRevision: 1,
      gpa: 8,
      gpaReference: "Bảng điểm",
      languageState: "MET",
      languageReference: "Hồ sơ NN",
      languageValidUntil: null,
      languageNoExpiry: true,
      otherState: "UNKNOWN",
      otherReference: null,
      verifiedBy: "8",
      verifiedAt: day,
    },
  };
}
describe("Graduation three-valued SQL evaluation", () => {
  it("requires all known criteria and caps elective credits by group", () => {
    const r = evaluateGraduation(input(), day);
    expect(r.status).toBe("DU_DIEN_KIEN");
    expect(r.rawCredits).toBe(9);
    expect(r.earnedCredits).toBe(6);
  });
  it("missing policy remains unknown; never defaults to GPA 7 or IELTS 6", () => {
    const x = input();
    x.policy = null;
    const r = evaluateGraduation(x, day);
    expect(r.status).toBe("THIEU_THONG_TIN");
    expect(r.criteria.find((c) => c.code === "GPA").state).toBe("UNKNOWN");
  });
  it("a duplicate retake does not double count; exempt grade NULL is not zero", () => {
    const x = input();
    x.results.push({ ...x.results[0], id: "99" });
    x.results[0].status = "EXEMPTED";
    x.results[0].grade = null;
    expect(evaluateGraduation(x, day).earnedCredits).toBe(6);
  });
  it("does not count another course version automatically", () => {
    const x = input();
    x.results[0].courseVersionId = "999";
    const r = evaluateGraduation(x, day);
    expect(r.status).toBe("CHUA_DU_DIEN_KIEN");
    expect(r.courses[0]).toMatchObject({
      passed: false,
      otherVersionPassed: true,
    });
  });
  it("extra electives cannot replace an unpassed required course", () => {
    const x = input();
    x.results[0].status = "FAILED";
    const r = evaluateGraduation(x, day);
    expect(r.criteria.find((c) => c.code === "REQUIRED").state).toBe("NOT_MET");
  });
  it("preserves official GPA zero and does not calculate GPA from letters", () => {
    const x = input();
    x.evidence.gpa = 0;
    x.results.forEach((r) => (r.grade = "A"));
    const r = evaluateGraduation(x, day);
    expect(r.officialGpa).toBe(0);
    expect(r.status).toBe("CHUA_DU_DIEN_KIEN");
    x.evidence.gpa = null;
    x.evidence.gpaReference = null;
    expect(evaluateGraduation(x, day).status).toBe("THIEU_THONG_TIN");
  });
  it("requires re-verification when the SQL policy revision changes", () => {
    const x = input();
    x.policy.revision = 2;
    expect(evaluateGraduation(x, day).status).toBe("THIEU_THONG_TIN");
  });
  it("expired proof fails, and unknown validity cannot silently become unlimited", () => {
    const x = input();
    x.evidence.languageNoExpiry = false;
    x.evidence.languageValidUntil = "2026-10-30";
    expect(
      evaluateGraduation(x, day).criteria.find((c) => c.code === "LANGUAGE")
        .state,
    ).toBe("NOT_MET");
    x.evidence.languageValidUntil = day;
    expect(
      evaluateGraduation(x, day).criteria.find((c) => c.code === "LANGUAGE")
        .state,
    ).toBe("MET");
    x.evidence.languageValidUntil = null;
    expect(
      evaluateGraduation(x, day).criteria.find((c) => c.code === "LANGUAGE")
        .state,
    ).toBe("UNKNOWN");
  });
  it("does not treat pending/failed defense as passed", () => {
    const x = input();
    x.defenses[0].status = "CHO_BAO_VE";
    x.defenses[0].score = null;
    expect(
      evaluateGraduation(x, day).criteria.find((c) => c.code === "DEFENSE")
        .state,
    ).toBe("NOT_MET");
  });
  it("allows only explicitly configured non-required criteria", () => {
    const x = input();
    x.policy.requireGpa = false;
    x.policy.minimumGpa = null;
    x.policy.requireLanguage = false;
    x.policy.requireDefense = false;
    x.evidence = null;
    expect(evaluateGraduation(x, day).status).toBe("DU_DIEN_KIEN");
  });
  it("does not graduate an ended assignment or suspended student", () => {
    const x = input();
    x.assignmentStatus = "ENDED";
    expect(evaluateGraduation(x, day).status).toBe("CHUA_DU_DIEN_KIEN");
    x.assignmentStatus = "ACTIVE";
    x.studentStatus = "SUSPENDED";
    expect(evaluateGraduation(x, day).status).toBe("CHUA_DU_DIEN_KIEN");
  });
  it("invalid or cyclic group definitions remain unknown", () => {
    const x = input();
    x.groups[0].parentId = "G2";
    x.groups[1].parentId = "G1";
    expect(evaluateGraduation(x, day).status).toBe("THIEU_THONG_TIN");
  });
  it("supports hierarchical caps without counting child credits twice", () => {
    const x = input();
    x.groups.forEach((g) => (g.parentId = "ROOT"));
    x.groups.push({
      id: "ROOT",
      parentId: null,
      code: "ROOT",
      name: "Toàn bộ",
      minimum: 6,
      maximum: 6,
    });
    expect(evaluateGraduation(x, day).earnedCredits).toBe(6);
  });
  it("unpublished curriculum and missing additional verification never appear eligible", () => {
    const x = input();
    x.versionStatus = "DRAFT";
    expect(evaluateGraduation(x, day).status).toBe("THIEU_THONG_TIN");
    x.versionStatus = "PUBLISHED";
    x.policy.otherRequirements = "Công bố khoa học";
    expect(
      evaluateGraduation(x, day).criteria.find((c) => c.code === "OTHER").state,
    ).toBe("UNKNOWN");
  });
});
