// Split this project's line-delimited SQL, including DELIMITER blocks.
function statements(source) {
  let delimiter = ";",
    buffer = "";
  const result = [];
  for (const line of source.replaceAll("\r\n", "\n").split("\n")) {
    if (/^\s*--/.test(line) || !line.trim()) continue;
    const directive = line.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
    if (directive) {
      if (buffer.trim()) throw new Error("Unterminated SQL before DELIMITER");
      delimiter = directive[1];
      continue;
    }
    buffer += line + "\n";
    if (buffer.trimEnd().endsWith(delimiter)) {
      result.push(buffer.trimEnd().slice(0, -delimiter.length).trim());
      buffer = "";
    }
  }
  if (buffer.trim()) throw new Error("Unterminated SQL statement");
  return result;
}
module.exports = { statements };
