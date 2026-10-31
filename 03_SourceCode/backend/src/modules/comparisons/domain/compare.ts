import { ComparisonSnapshot, Difference } from "./comparison";
// Stable identity: course_id, group_code, plo_code. Ignore ordering in relationship sets.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.map(canonical).sort());
  if (value && typeof value === "object")
    return JSON.stringify(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return JSON.stringify(value);
}
export function diffRows<T extends object>(
  a: T[],
  b: T[],
  keyOf: (row: T) => string,
): Difference<T>[] {
  const left = new Map(a.map((row) => [keyOf(row), row]));
  const right = new Map(b.map((row) => [keyOf(row), row]));
  return [...new Set([...left.keys(), ...right.keys()])].sort().map((key) => {
    const x = left.get(key) ?? null,
      y = right.get(key) ?? null;
    const changedFields =
      x && y
        ? [...new Set([...Object.keys(x), ...Object.keys(y)])].filter(
            (field) => canonical(x[field]) !== canonical(y[field]),
          )
        : [];
    return {
      key,
      a: x,
      b: y,
      changedFields,
      status: !x
        ? "ONLY_B"
        : !y
          ? "ONLY_A"
          : changedFields.length
            ? "CHANGED"
            : "SAME",
    };
  });
}
export function compareSnapshots(a: ComparisonSnapshot, b: ComparisonSnapshot) {
  const courses = diffRows(a.courses, b.courses, (row) => row.courseId);
  const groups = diffRows(a.groups, b.groups, (row) => row.code);
  const outcomes = diffRows(a.outcomes, b.outcomes, (row) => row.code);
  return {
    a,
    b,
    courses,
    groups,
    outcomes,
    summary: {
      onlyA: courses.filter((x) => x.status === "ONLY_A").length,
      onlyB: courses.filter((x) => x.status === "ONLY_B").length,
      changed: courses.filter((x) => x.status === "CHANGED").length,
      same: courses.filter((x) => x.status === "SAME").length,
      // Catalog volume is not required credits for elective groups.
      listedCreditsA:
        a.courses.reduce((sum, row) => sum + Math.round(row.credits * 100), 0) /
        100,
      listedCreditsB:
        b.courses.reduce((sum, row) => sum + Math.round(row.credits * 100), 0) /
        100,
    },
  };
}
