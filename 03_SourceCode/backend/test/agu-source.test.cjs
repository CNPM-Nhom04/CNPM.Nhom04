const test = require("node:test"),
  assert = require("node:assert/strict");
const { manifest, metadata } = require("../scripts/agu/manifest.cjs");
test("official snapshot preserves source identities and distinguishes absent data", () => {
  const majors = manifest(),
    rows = majors.flatMap((m) => m.programmes);
  assert.equal(majors.length, 18);
  assert.equal(rows.length, 38);
  assert.equal(new Set(rows.map((r) => r.id)).size, 38);
  assert.equal(rows.find((r) => r.id === 25).credits, 60);
  assert.equal(rows.find((r) => r.id === 25).cohortLabel, "2025 - 2027");
  assert.equal(rows.find((r) => r.id === 40).credits, null);
  assert.equal(rows.find((r) => r.id === 40).cohortYear, null);
  assert.equal(rows.find((r) => r.id === 30).credits, 60);
  assert.equal(majors.find((m) => m.id === 7).programmes.length, 0);
  assert.equal(metadata("Số tín chỉ yêu cầu 6 0").credits, 60);
  assert.equal(metadata("Thời gian đào tạo: 0 2 năm").duration, "2 năm");
  assert.equal(metadata("Học phần tự chọn 12 tín chỉ").credits, null);
});
