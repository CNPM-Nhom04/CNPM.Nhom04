import {
  GraduationCriterion,
  GraduationEvaluation,
  GraduationInput,
} from "./graduation";
const cents = (n: number) => Math.round(n * 100);
export function evaluateGraduation(
  input: GraduationInput,
  today: string,
): GraduationEvaluation {
  const criteria: GraduationCriterion[] = [];
  const add = (
    code: string,
    label: string,
    state: GraduationCriterion["state"],
    message: string,
  ) => criteria.push({ code, label, state, message });
  add(
    "ACTIVE",
    "Tình trạng hồ sơ",
    input.studentStatus === "ACTIVE" && input.assignmentStatus === "ACTIVE"
      ? "MET"
      : "NOT_MET",
    "Học viên: " +
      input.studentStatus +
      "; phân công CTĐT: " +
      input.assignmentStatus +
      ".",
  );
  add(
    "VERSION",
    "Phiên bản CTĐT đã được ban hành",
    ["PUBLISHED", "ARCHIVED"].includes(input.versionStatus) ? "MET" : "UNKNOWN",
    "Trạng thái phiên bản: " +
      input.versionStatus +
      ". Không tự chuyển sang phiên bản mới nhất.",
  );
  const qualifying = input.results.filter(
    (r) =>
      ["PASSED", "EXEMPTED"].includes(r.status) &&
      (!r.passedAt || r.passedAt.slice(0, 10) <= today),
  );
  const passedVersions = new Set(qualifying.map((r) => r.courseVersionId)),
    passedCourses = new Set(qualifying.map((r) => r.courseId));
  const courses = input.courses.map((c) => ({
    ...c,
    passed: passedVersions.has(c.courseVersionId),
    otherVersionPassed:
      !passedVersions.has(c.courseVersionId) && passedCourses.has(c.courseId),
  }));
  const groups = new Map(input.groups.map((g) => [g.id, g]));
  const memo = new Map<string, { earned: number; raw: number }>(),
    visiting = new Set<string>();
  let invalid =
    input.groups.length === 0 ||
    input.courses.length === 0 ||
    input.requiredCredits <= 0;
  if (
    new Set(input.courses.map((c) => c.courseId)).size !== input.courses.length
  )
    invalid = true;
  for (const c of input.courses)
    if (!groups.has(c.groupId) || !Number.isFinite(c.credits) || c.credits < 0)
      invalid = true;
  for (const g of input.groups)
    if (
      (g.parentId && !groups.has(g.parentId)) ||
      g.minimum < 0 ||
      (g.maximum != null && g.maximum < g.minimum)
    )
      invalid = true;
  function sum(id: string): { earned: number; raw: number } {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) {
      invalid = true;
      return { earned: 0, raw: 0 };
    }
    visiting.add(id);
    const group = groups.get(id);
    const children = input.groups
      .filter((g) => g.parentId === id)
      .map((g) => sum(g.id));
    const direct = courses
      .filter((c) => c.groupId === id && c.passed)
      .reduce((s, c) => s + cents(c.credits), 0);
    const raw = direct + children.reduce((s, g) => s + g.raw, 0);
    const available = direct + children.reduce((s, g) => s + g.earned, 0);
    const earned =
      group.maximum == null
        ? available
        : Math.min(available, cents(group.maximum));
    visiting.delete(id);
    const result = { earned, raw };
    memo.set(id, result);
    return result;
  }
  for (const g of input.groups) sum(g.id);
  const definitions = new Map<string, { capacity: number; chosen: number }>(),
    checking = new Set<string>();
  function definition(id: string): { capacity: number; chosen: number } {
    if (definitions.has(id)) return definitions.get(id);
    if (checking.has(id)) {
      invalid = true;
      return { capacity: 0, chosen: 0 };
    }
    checking.add(id);
    const g = groups.get(id),
      children = input.groups
        .filter((x) => x.parentId === id)
        .map((x) => definition(x.id));
    const direct = input.courses.filter((c) => c.groupId === id);
    const offered =
      direct.reduce((n, c) => n + cents(c.credits), 0) +
      children.reduce((n, c) => n + c.capacity, 0);
    const capacity =
      g.maximum == null ? offered : Math.min(offered, cents(g.maximum));
    const chosen = Math.max(
      cents(g.minimum),
      direct
        .filter((c) => c.required)
        .reduce((n, c) => n + cents(c.credits), 0) +
        children.reduce((n, c) => n + c.chosen, 0),
    );
    if (chosen > capacity) invalid = true;
    checking.delete(id);
    const result = { capacity, chosen };
    definitions.set(id, result);
    return result;
  }
  for (const g of input.groups) definition(g.id);
  const roots = input.groups.filter((g) => !g.parentId);
  if (
    !roots.length ||
    roots.reduce((s, g) => s + cents(g.minimum), 0) !==
      cents(input.requiredCredits)
  )
    invalid = true;
  const earned = roots.reduce((s, g) => s + (memo.get(g.id)?.earned || 0), 0);
  const raw = courses
    .filter((c) => c.passed)
    .reduce((s, c) => s + cents(c.credits), 0);
  const groupValues = input.groups.map((g) => ({
    ...g,
    earned: (memo.get(g.id)?.earned || 0) / 100,
    raw: (memo.get(g.id)?.raw || 0) / 100,
  }));
  add(
    "CURRICULUM",
    "Cấu trúc/định mức trong SQL",
    invalid ? "UNKNOWN" : "MET",
    invalid
      ? "Cấu trúc trống, không hợp lệ hoặc định mức nhóm chưa khớp; cần kiểm tra CTĐT."
      : "Đối chiếu đúng hướng và phiên bản được phân công.",
  );
  const missing = courses.filter((c) => c.required && !c.passed);
  add(
    "REQUIRED",
    "Học phần bắt buộc",
    invalid ? "UNKNOWN" : missing.length ? "NOT_MET" : "MET",
    missing.length
      ? "Chưa có kết quả đạt/miễn đúng phiên bản: " +
          missing.map((c) => c.code).join(", ")
      : "Đã đáp ứng học phần bắt buộc.",
  );
  const insufficient = groupValues.filter(
    (g) => cents(g.earned) < cents(g.minimum),
  );
  add(
    "GROUPS",
    "Định mức từng nhóm kiến thức",
    invalid ? "UNKNOWN" : insufficient.length ? "NOT_MET" : "MET",
    insufficient.length
      ? "Chưa đủ nhóm: " + insufficient.map((g) => g.code).join(", ")
      : "Đạt mức tối thiểu theo nhóm; tín chỉ vượt trần nhóm không bù cho nhóm khác.",
  );
  add(
    "CREDITS",
    "Tín chỉ tích lũy trong cấu trúc",
    invalid
      ? "UNKNOWN"
      : earned >= cents(input.requiredCredits)
        ? "MET"
        : "NOT_MET",
    earned / 100 +
      " / " +
      input.requiredCredits +
      " TC. Chỉ tính một lần học phần đạt/miễn đúng course_version_id.",
  );
  const p = input.policy,
    e = input.evidence,
    current = !!p && !!e && e.policyRevision === p.revision;
  add(
    "POLICY",
    "Quy định xét tốt nghiệp",
    p ? "MET" : "UNKNOWN",
    p
      ? "Căn cứ: " + p.reference
      : "Chưa có quy định được nhập cho hướng này; không mặc định ĐTB 7,0 hay IELTS 6,0.",
  );
  if (!p) {
    for (const [code, label] of [
      ["GPA", "ĐTB chính thức"],
      ["LANGUAGE", "Chuẩn ngoại ngữ"],
      ["DEFENSE", "Bảo vệ luận văn/luận án"],
    ])
      add(code, label, "UNKNOWN", "Chưa có quy định để xác định yêu cầu.");
  } else {
    add(
      "GPA",
      "ĐTB chính thức",
      !p.requireGpa
        ? "NOT_REQUIRED"
        : !current || e.gpa == null || !e.gpaReference
          ? "UNKNOWN"
          : e.gpa >= p.minimumGpa
            ? "MET"
            : "NOT_MET",
      !p.requireGpa
        ? "Không yêu cầu theo quy định đã lưu."
        : !current
          ? "Chưa có hồ sơ xác minh theo phiên bản quy định hiện tại."
          : e.gpa == null || !e.gpaReference
            ? "Chưa có ĐTB chính thức và căn cứ; không tự quy đổi điểm chữ hay suy ra cách tính học lại."
            : "ĐTB " + e.gpa + " / yêu cầu " + p.minimumGpa + ".",
    );
    let language: GraduationCriterion["state"] = "NOT_REQUIRED";
    if (p.requireLanguage) {
      language =
        !current || e.languageState === "UNKNOWN" || !e.languageReference
          ? "UNKNOWN"
          : e.languageState === "NOT_MET"
            ? "NOT_MET"
            : !e.languageNoExpiry && !e.languageValidUntil
              ? "UNKNOWN"
              : e.languageValidUntil && e.languageValidUntil < today
                ? "NOT_MET"
                : "MET";
    }
    add(
      "LANGUAGE",
      "Chuẩn ngoại ngữ",
      language,
      !p.requireLanguage
        ? "Không yêu cầu theo quy định đã lưu."
        : (p.languageRule || "Chưa có mô tả chuẩn.") +
            " — " +
            (language === "MET"
              ? "Đã xác minh hồ sơ còn hiệu lực."
              : language === "NOT_MET"
                ? "Hồ sơ chưa đạt hoặc đã hết hiệu lực."
                : "Thiếu xác minh/căn cứ/hạn hiệu lực theo quy định hiện tại."),
    );
    const defensePassed = input.defenses.some(
      (d) => d.status === "DA_DAT" && d.date <= today && d.score != null,
    );
    add(
      "DEFENSE",
      "Bảo vệ luận văn/luận án",
      !p.requireDefense ? "NOT_REQUIRED" : defensePassed ? "MET" : "NOT_MET",
      !p.requireDefense
        ? "Không yêu cầu theo quy định đã lưu."
        : defensePassed
          ? "Có kết quả DA_DAT gắn đúng assignment."
          : "Chưa có kết quả bảo vệ đạt của đúng lần phân công CTĐT.",
    );
    if (p.otherRequirements)
      add(
        "OTHER",
        "Tiêu chí khác theo quy định",
        !current || e.otherState === "UNKNOWN" || !e.otherReference
          ? "UNKNOWN"
          : e.otherState === "MET"
            ? "MET"
            : "NOT_MET",
        p.otherRequirements,
      );
  }
  const status = criteria.some((c) => c.state === "UNKNOWN")
    ? "THIEU_THONG_TIN"
    : criteria.some((c) => c.state === "NOT_MET")
      ? "CHUA_DU_DIEN_KIEN"
      : "DU_DIEN_KIEN";
  return {
    status,
    earnedCredits: earned / 100,
    rawCredits: raw / 100,
    requiredCredits: input.requiredCredits,
    officialGpa: e?.gpa ?? null,
    criteria,
    courses,
    groups: groupValues,
  };
}
