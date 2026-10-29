import { ProgramItem } from "./program";
const cents = (value: number) => Math.round(value * 100);
export function validateCurriculum(
  program: ProgramItem,
  requiredCodes: string[] = [],
): string[] {
  const issues: string[] = [];
  const tracks = program.tracks.filter((track) => track.status !== "INACTIVE");
  if (!tracks.length) issues.push("CTĐT chưa có hướng đào tạo.");
  for (const code of requiredCodes)
    if (!tracks.some((track) => track.code === code))
      issues.push("Thiếu hướng bắt buộc: " + code);
  for (const track of tracks) {
    const target = cents(track.requiredCredits);
    const prefix = track.name + ": ";
    if (!track.courses.length) issues.push(prefix + "chưa có học phần.");
    if (
      program.rules.minCredits != null &&
      target < cents(program.rules.minCredits)
    )
      issues.push(prefix + "tín chỉ thấp hơn tối thiểu của bậc đào tạo.");
    if (
      program.rules.maxCredits != null &&
      target > cents(program.rules.maxCredits)
    )
      issues.push(prefix + "tín chỉ vượt tối đa của bậc đào tạo.");
    // CSDL.sql scopes prerequisite edges to curriculum entries; cycle checks belong here.
    const courseById = new Map(
      track.courses.map((course) => [course.id, course]),
    );
    const finished = new Set<string>();
    const pending = new Set<string>();
    function visitCourse(id: string) {
      if (pending.has(id)) {
        issues.push(prefix + "Có vòng lặp tiên quyết.");
        return;
      }
      if (finished.has(id)) return;
      pending.add(id);
      for (const edge of courseById.get(id)?.prerequisites || []) {
        if (!courseById.has(edge.courseEntryId))
          issues.push(
            prefix + "Học phần tiên quyết không thuộc hướng đào tạo.",
          );
        else visitCourse(edge.courseEntryId);
      }
      pending.delete(id);
      finished.add(id);
    }
    for (const course of track.courses) visitCourse(course.id);
    const visited = new Set<string>(),
      visiting = new Set<string>();
    function groupValue(id: string): { chosen: number; capacity: number } {
      if (visiting.has(id)) {
        issues.push(prefix + "nhóm kiến thức tạo vòng lặp.");
        return { chosen: 0, capacity: 0 };
      }
      visiting.add(id);
      visited.add(id);
      const group = track.groups.find((item) => item.id === id)!;
      const courses = track.courses.filter((course) => course.groupId === id);
      const children = track.groups
        .filter((item) => item.parentId === id)
        .map((item) => groupValue(item.id));
      const mandatory = courses
        .filter((course) => course.requirementType === "REQUIRED")
        .reduce((sum, course) => sum + cents(course.credits), 0);
      const offeredCapacity =
        courses.reduce((sum, course) => sum + cents(course.credits), 0) +
        children.reduce((sum, child) => sum + child.capacity, 0);
      const capacity =
        group.maximumCredits == null
          ? offeredCapacity
          : Math.min(offeredCapacity, cents(group.maximumCredits));
      const chosen = Math.max(
        cents(group.minimumCredits),
        mandatory + children.reduce((sum, child) => sum + child.chosen, 0),
      );
      if (group.maximumCredits != null && chosen > cents(group.maximumCredits))
        issues.push(prefix + group.name + " vượt tín chỉ tối đa của nhóm.");
      if (chosen > capacity)
        issues.push(
          prefix + group.name + " không đủ học phần cho định mức tối thiểu.",
        );
      visiting.delete(id);
      return { chosen, capacity };
    }
    const allocated = track.groups
      .filter((group) => !group.parentId)
      .reduce((sum, group) => sum + groupValue(group.id).chosen, 0);
    if (visited.size !== track.groups.length)
      issues.push(prefix + "cấu trúc nhóm kiến thức không hợp lệ.");
    if (allocated !== target)
      issues.push(
        prefix +
          "tổng tín chỉ tối thiểu theo nhóm (" +
          allocated / 100 +
          ") phải bằng định mức (" +
          target / 100 +
          ").",
      );
    const required = track.courses
      .filter((course) => course.requirementType === "REQUIRED")
      .reduce((sum, course) => sum + cents(course.credits), 0);
    const ratio = target > 0 ? ((target - required) * 100) / target : 0;
    if (
      program.rules.minElective != null &&
      ratio < program.rules.minElective - 0.0001
    )
      issues.push(prefix + "tỷ lệ tín chỉ tự chọn thấp hơn quy định.");
    if (
      program.rules.maxElective != null &&
      ratio > program.rules.maxElective + 0.0001
    )
      issues.push(prefix + "tỷ lệ tín chỉ tự chọn vượt quy định.");
  }
  return [...new Set(issues)];
}
