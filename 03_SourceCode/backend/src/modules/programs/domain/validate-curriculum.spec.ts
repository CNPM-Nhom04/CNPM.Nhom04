import { ProgramItem } from "./program";
import { validateCurriculum } from "./validate-curriculum";
function fixture(): ProgramItem {
  return {
    rules: { minCredits: 60, maxCredits: 60, minElective: 10, maxElective: 40 },
    tracks: [
      {
        id: "1",
        code: "RESEARCH",
        name: "Nghiên cứu",
        requiredCredits: 60,
        groups: [
          {
            id: "1",
            code: "A",
            name: "Nhóm chung",
            parentId: null,
            minimumCredits: 60,
          },
        ],
        courses: [
          {
            id: "1",
            courseId: "1",
            courseVersionId: "1",
            code: "R",
            name: "Bắt buộc",
            credits: 54,
            groupId: "1",
            requirementType: "REQUIRED",
            semester: 1,
          },
          {
            id: "2",
            courseId: "2",
            courseVersionId: "2",
            code: "E",
            name: "Tự chọn",
            credits: 6,
            groupId: "1",
            requirementType: "ELECTIVE",
            semester: 1,
          },
        ],
      },
    ],
  } as ProgramItem;
}
describe("Curriculum rules", () => {
  it("accepts a 60-credit track with 10 percent elective at the boundary", () =>
    expect(validateCurriculum(fixture(), ["RESEARCH"])).toEqual([]));
  it("rejects missing level-required tracks", () =>
    expect(
      validateCurriculum(fixture(), ["RESEARCH", "APPLICATION"]).join(" "),
    ).toContain("APPLICATION"));
  it("rejects an empty track", () => {
    const item = fixture();
    item.tracks[0].courses = [];
    expect(validateCurriculum(item).length).toBeGreaterThan(0);
  });
  it("does not mistake a large elective bank for earned credits", () => {
    const item = fixture();
    item.tracks[0].courses[1].credits = 30;
    expect(validateCurriculum(item)).toEqual([]);
  });
  it("rejects an elective ratio below the allowed boundary", () => {
    const item = fixture();
    item.tracks[0].courses[0].credits = 55;
    expect(validateCurriculum(item).join(" ")).toContain("tự chọn thấp");
  });
  it("rejects unattainable group minimums", () => {
    const item = fixture();
    item.tracks[0].groups[0].minimumCredits = 70;
    expect(validateCurriculum(item).join(" ")).toContain("không đủ");
  });
  it("rejects totals outside degree limits", () => {
    const item = fixture();
    item.tracks[0].requiredCredits = 90;
    expect(validateCurriculum(item).join(" ")).toContain("vượt tối đa");
  });
  it("counts nested group allocations once", () => {
    const item = fixture();
    item.tracks[0].groups.push({
      id: "2",
      code: "B",
      name: "Nhóm con",
      parentId: "1",
      minimumCredits: 60,
    });
    item.tracks[0].courses.forEach((course) => (course.groupId = "2"));
    expect(validateCurriculum(item)).toEqual([]);
  });
  it("rejects cyclic group structures", () => {
    const item = fixture();
    item.tracks[0].groups[0].parentId = "1";
    expect(validateCurriculum(item).join(" ")).toContain("không hợp lệ");
  });
  it("enforces the maximum credits declared by the SQL group", () => {
    const item = fixture();
    item.tracks[0].groups[0].maximumCredits = 59;
    expect(validateCurriculum(item).join(" ")).toContain("vượt tín chỉ tối đa");
  });
  it("does not validate an inactive historical track as an active curriculum", () => {
    const item = fixture();
    item.tracks.push({
      ...item.tracks[0],
      id: "2",
      code: "OLD",
      status: "INACTIVE",
      courses: [],
    });
    expect(validateCurriculum(item, ["RESEARCH"])).toEqual([]);
  });
});
