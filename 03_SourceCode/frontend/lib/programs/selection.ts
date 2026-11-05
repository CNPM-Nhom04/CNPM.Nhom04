import type { ProgramTrack } from "../services/programService";
const cents = (n: number) => Math.round(n * 100);
export function fillGroupCredits(track: ProgramTrack): ProgramTrack {
  return {
    ...track,
    groups: track.groups.map((group) => ({
      ...group,
      minimumCredits: track.groups.some((g) => g.parentId === group.id)
        ? 0
        : track.courses
            .filter((c) => c.groupId === group.id)
            .reduce((sum, c) => sum + cents(c.credits), 0) / 100,
    })),
  };
}
// Exact subset sum: required courses and prerequisites remain selected.
export function selectCourses(
  track: ProgramTrack,
  eligibleCourseIds: ReadonlySet<string>,
): ProgramTrack {
  const outside = track.courses.filter(
    (course) => !eligibleCourseIds.has(course.courseId),
  );
  if (outside.some((course) => course.requirementType === "REQUIRED"))
    throw new Error(
      `Môn bắt buộc chưa được xác nhận phù hợp với ngành: ${outside
        .filter((course) => course.requirementType === "REQUIRED")
        .map((course) => course.code || course.courseId)
        .join(", ")}. Kiểm tra lại danh sách môn trước khi tự chọn.`,
    );
  const originalCourses = track.courses;
  track = {
    ...track,
    courses: track.courses.filter((course) =>
      eligibleCourseIds.has(course.courseId),
    ),
  };
  if (!track.courses.length)
    throw new Error(
      "Chưa có môn phù hợp với ngành trong danh sách. Cần có CTĐT đã ban hành cùng ngành và bậc đào tạo để đối chiếu.",
    );
  const eligibleIds = new Set(track.courses.map((course) => course.id));
  for (const course of track.courses)
    for (const pre of course.prerequisites || []) {
      if (
        !eligibleIds.has(pre.courseEntryId) &&
        originalCourses.some((item) => item.id === pre.courseEntryId)
      )
        throw new Error(
          `Môn tiên quyết của ${course.code || course.courseId} chưa được xác nhận phù hợp với ngành.`,
        );
    }
  const kept = new Set(
    track.courses
      .filter((c) => c.requirementType === "REQUIRED")
      .map((c) => c.id),
  );
  const byId = new Map(track.courses.map((c) => [c.id, c]));
  for (const course of track.courses)
    for (const pre of course.prerequisites || []) {
      if (byId.has(pre.courseEntryId)) kept.add(pre.courseEntryId);
    }
  for (const group of track.groups) {
    const courses = track.courses.filter((c) => c.groupId === group.id);
    const hasChildren = track.groups.some((g) => g.parentId === group.id);
    if (hasChildren) {
      courses.forEach((c) => kept.add(c.id));
      continue;
    }
    const required = courses.filter((c) => kept.has(c.id));
    const target =
      cents(group.minimumCredits) -
      required.reduce((sum, c) => sum + cents(c.credits), 0);
    if (target < 0 || target > 999900)
      throw new Error(
        `Nhóm ${group.code}: tín chỉ môn bắt buộc/tiên quyết vượt định mức hoặc định mức quá lớn.`,
      );
    const paths = new Map<number, string[]>([[0, []]]);
    for (const course of courses.filter((c) => !kept.has(c.id))) {
      for (const [sum, ids] of [...paths]) {
        const next = sum + cents(course.credits);
        if (next <= target && !paths.has(next))
          paths.set(next, [...ids, course.id]);
      }
    }
    const selected = paths.get(target);
    if (!selected)
      throw new Error(
        `Nhóm ${group.code}: không có tổ hợp môn đủ ${group.minimumCredits} TC. Bổ sung môn vào nhóm hoặc sửa định mức.`,
      );
    selected.forEach((id) => kept.add(id));
  }
  const courses = track.courses.filter((c) => kept.has(c.id));
  function total(id: string, visiting = new Set<string>()): number {
    if (visiting.has(id)) throw new Error("Nhóm kiến thức tạo vòng lặp.");
    const next = new Set(visiting).add(id);
    return (
      courses
        .filter((c) => c.groupId === id)
        .reduce((s, c) => s + cents(c.credits), 0) +
      track.groups
        .filter((g) => g.parentId === id)
        .reduce((s, g) => s + total(g.id, next), 0)
    );
  }
  for (const group of track.groups) {
    const sum = total(group.id);
    if (
      sum < cents(group.minimumCredits) ||
      (group.maximumCredits != null && sum > cents(group.maximumCredits))
    )
      throw new Error(
        `Nhóm ${group.code}: tổ hợp môn không đáp ứng giới hạn tín chỉ.`,
      );
  }
  if (
    courses.reduce((s, c) => s + cents(c.credits), 0) !==
    cents(track.requiredCredits)
  )
    throw new Error(
      `Tổng định mức nhóm phải bằng ${track.requiredCredits} TC của hướng.`,
    );
  return { ...track, courses };
}
