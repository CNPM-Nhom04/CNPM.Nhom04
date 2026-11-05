const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const sourceRoot = path.resolve(__dirname, "../../../../artifacts/agu-source");
function markdown(name) {
  const text = fs.readFileSync(path.join(sourceRoot, name), "utf8");
  if (!text.includes("Markdown Content:"))
    throw Error("Missing source content: " + name);
  return text
    .split("Markdown Content:")
    .slice(1)
    .join("Markdown Content:")
    .trim();
}
function metadata(text) {
  const plain = text
    .normalize("NFC")
    .replace(/[*_#]/g, "")
    .replace(/\u00a0/g, " ");
  const creditMatch = plain.match(
    /(?:Số tín chỉ yêu cầu|Tổng số tín chỉ phải tích lũy|Tổng số tín chỉ của toàn chương trình|Khối lượng kiến thức toàn khóa)[\s:：]*([0-9](?:[ \t]*[0-9]){1,2})(?!\d)/i,
  );
  const credits = creditMatch
    ? Number(creditMatch[1].replace(/\s/g, ""))
    : null;
  const durationMatch = plain.match(
    /Thời gian đào tạo[\s:：]*([0-9](?:[ \t]*[0-9])?(?:[.,]5)?)\s*năm/i,
  );
  const englishMatch = plain.match(
    /(?:Tên chương trình đào tạo \(tiếng Anh\)|\+ Tiếng Anh:)[ \t]*([^\n]+)/i,
  );
  return {
    credits: credits !== null && credits > 0 && credits < 1000 ? credits : null,
    duration: durationMatch
      ? Number(durationMatch[1].replace(/\s/g, "").replace(",", ".")) + " năm"
      : "",
    englishName: englishMatch ? englishMatch[1].trim().replace(/\.$/, "") : "",
  };
}
function manifest() {
  const index = markdown("majors.md"),
    majors = [];
  const sourceIds = new Set();
  for (const line of index.split("\n")) {
    const match = line.match(
      /^\|\s*\d+\s*\|\s*\[([^\]]+)\]\((https:\/\/pgd\.agu\.edu\.vn\/trainings\/majors\/(\d+)\/programmes)\)\s*\|\s*([^|]+)\|/,
    );
    if (!match) continue;
    const [, name, url, id, institution] = match;
    const listed = markdown(`major-${id}.md`),
      programmes = [];
    for (const row of listed.split("\n")) {
      const r = row.match(
        /^\|\s*\d+\s*\|\s*([^|]+)\|\s*\[([^\]]+)\]\((https:\/\/pgd\.agu\.edu\.vn\/trainings\/majors\/programme\/(\d+))\)\s*\|\s*([^|]+)\|/,
      );
      if (!r) continue;
      const [, code, title, sourceUrl, programmeId, studyForm] = r;
      if (sourceIds.has(programmeId))
        throw Error("Duplicate source programme " + programmeId);
      sourceIds.add(programmeId);
      const detail = markdown(`programme-${programmeId}.md`);
      const main = detail.split(/## TRA CỨU VĂN BẰNG|\nTRA CỨU VĂN BẰNG/)[0];
      const document =
        main.match(
          /\]\((https:\/\/pgd\.agu\.edu\.vn\/storage\/[^)]+\.pdf)\)/,
        )?.[1] || null;
      let content = main;
      if (document) {
        const file = path.join(sourceRoot, `document-${programmeId}.md`);
        if (fs.existsSync(file)) {
          const full = markdown(`document-${programmeId}.md`);
          if (full.trim()) content = full;
        }
      }
      // Strip page navigation when a reader includes it before the actual curriculum.
      const start = content.search(
        /(?:^|\n)(?:#+\s*)?(?:\*\*)?CHƯƠNG TRÌNH ĐÀO TẠO/,
      );
      if (start >= 0) content = content.slice(start).trim();
      content = content.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim();
      const years = title.match(
        /\b((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2})\b/,
      );
      programmes.push({
        id: Number(programmeId),
        code: code.trim(),
        name: title.replace(/\s*\(Xem\)\s*$/, "").trim(),
        url: sourceUrl,
        documentUrl: document,
        studyForm: studyForm.trim(),
        cohortYear: years ? Number(years[1]) : null,
        cohortLabel: years ? `${years[1]} - ${years[2]}` : "",
        ...metadata(content),
        content,
        hash: crypto.createHash("sha256").update(content).digest("hex"),
      });
    }
    majors.push({
      id: Number(id),
      name: name.trim(),
      url,
      institution: institution.trim(),
      programmes,
    });
  }
  if (majors.length !== 18)
    throw Error("Source major list incomplete: " + majors.length);
  if (majors.reduce((n, m) => n + m.programmes.length, 0) < 30)
    throw Error("Source programme list incomplete");
  return majors;
}
module.exports = { manifest, metadata, sourceRoot };
if (require.main === module) {
  const data = manifest();
  console.log(
    JSON.stringify(
      {
        majors: data.length,
        programmes: data.flatMap((m) => m.programmes).length,
        rows: data.map((m) => ({
          id: m.id,
          name: m.name,
          institution: m.institution,
          versions: m.programmes.map((p) => ({
            id: p.id,
            name: p.name,
            credits: p.credits,
            cohort: p.cohortLabel,
            pdf: !!p.documentUrl,
          })),
        })),
      },
      null,
      2,
    ),
  );
}
