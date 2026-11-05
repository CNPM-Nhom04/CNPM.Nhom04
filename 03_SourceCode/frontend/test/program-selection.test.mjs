import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import Module from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const filename = fileURLToPath(
  new URL("../lib/programs/selection.ts", import.meta.url),
);
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(dirname(filename));
compiled._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText,
  filename,
);
const { fillGroupCredits, selectCourses: selectForMajor } = compiled.exports;
const selectCourses = (input) =>
  selectForMajor(input, new Set(input.courses.map((c) => c.courseId)));
const course = (id, credits, required = false, groupId = "a") => ({
  id,
  courseId: id,
  credits,
  groupId,
  requirementType: required ? "REQUIRED" : "ELECTIVE",
});
const track = (courses, target = 8) => ({
  requiredCredits: target,
  groups: [{ id: "a", code: "A", minimumCredits: target, parentId: null }],
  courses,
});
test("finds an exact combination where greedy selection fails, preserving required courses", () => {
  const input = track([
    course("r", 1, true),
    course("six", 6),
    course("four", 4),
    course("three", 3),
  ]);
  assert.deepEqual(
    selectCourses(input).courses.map((c) => c.id),
    ["r", "four", "three"],
  );
  assert.equal(input.courses.length, 4);
});
test("handles fractional credits exactly", () =>
  assert.equal(
    selectCourses(
      track([course("x", 1.25), course("y", 2.5), course("z", 2)], 3.75),
    ).courses.length,
    2,
  ));
test("rejects impossible sums, required overrun and wrong total without changing input", () => {
  for (const input of [
    track([course("a", 3)], 4),
    track([course("a", 5, true)], 4),
    { ...track([course("a", 3)], 3), requiredCredits: 4 },
  ])
    assert.throws(() => selectCourses(input));
});
test("keeps prerequisites when selecting electives", () => {
  const input = track([
    { ...course("r", 3, true), prerequisites: [{ courseEntryId: "p" }] },
    course("p", 2),
    course("q", 3),
    course("other", 4),
  ]);
  assert.deepEqual(
    selectCourses(input).courses.map((c) => c.id),
    ["r", "p", "q"],
  );
});
test("sums each group and avoids counting nested groups twice", () => {
  const input = track([course("p", 3, false, "parent"), course("a", 2)]);
  input.groups = [
    { id: "parent", code: "A", parentId: null, minimumCredits: 0 },
    { id: "a", code: "A1", parentId: "parent", minimumCredits: 0 },
  ];
  assert.deepEqual(
    fillGroupCredits(input).groups.map((g) => g.minimumCredits),
    [0, 2],
  );
});
test("enforces parent group maximum", () => {
  const input = track([course("a", 3, true)], 3);
  input.groups.push({
    id: "parent",
    code: "P",
    parentId: null,
    minimumCredits: 0,
    maximumCredits: 2,
  });
  input.groups[0].parentId = "parent";
  assert.throws(() => selectCourses(input), /giới hạn/);
});
test("selects A–D independently without moving courses across groups", () => {
  const input = {
    requiredCredits: 12,
    groups: ["A", "B", "C", "D"].map((code) => ({
      id: code,
      code,
      parentId: null,
      minimumCredits: 3,
    })),
    courses: ["A", "B", "C", "D"].flatMap((code) => [
      course(code + "3", 3, false, code),
      course(code + "2", 2, false, code),
    ]),
  };
  assert.deepEqual(
    selectCourses(input).courses.map((c) => c.id),
    ["A3", "B3", "C3", "D3"],
  );
});

test("excludes courses outside the major even when their credits fit exactly", () => {
  const input = track(
    [course("foreign", 3), course("it1", 1), course("it2", 2)],
    3,
  );
  assert.deepEqual(
    selectForMajor(input, new Set(["it1", "it2"])).courses.map((c) => c.id),
    ["it1", "it2"],
  );
});
test("rejects an unverified required course instead of silently retaining or removing it", () => {
  const input = track([course("foreign", 3, true), course("it", 3)], 3);
  assert.throws(() => selectForMajor(input, new Set(["it"])), /Môn bắt buộc/);
  assert.equal(input.courses.length, 2);
});
test("does not fall back to arbitrary courses when major evidence is absent", () => {
  assert.throws(
    () => selectForMajor(track([course("any", 3)], 3), new Set()),
    /Chưa có môn phù hợp/,
  );
});
test("rejects a prerequisite outside the major", () => {
  const input = track(
    [
      {
        ...course("it", 3, true),
        prerequisites: [{ courseEntryId: "foreign" }],
      },
      course("foreign", 2),
    ],
    5,
  );
  assert.throws(() => selectForMajor(input, new Set(["it"])), /tiên quyết/);
});
