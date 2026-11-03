import { BadRequestException } from "@nestjs/common";
import { inflateRawSync } from "node:zlib";
// XLSX is a ZIP archive. Bound actual decompression before ExcelJS allocates XML objects.
export function checkWorkbookArchive(buffer: Buffer) {
  try {
    let end = -1;
    for (
      let i = buffer.length - 22;
      i >= Math.max(0, buffer.length - 65557);
      i--
    )
      if (
        buffer.readUInt32LE(i) === 0x06054b50 &&
        i + 22 + buffer.readUInt16LE(i + 20) === buffer.length
      ) {
        end = i;
        break;
      }
    if (
      end < 0 ||
      buffer.readUInt16LE(end + 4) !== 0 ||
      buffer.readUInt16LE(end + 6) !== 0
    )
      throw Error();
    const count = buffer.readUInt16LE(end + 10);
    if (!count || count > 256 || count !== buffer.readUInt16LE(end + 8))
      throw Error();
    let cursor = buffer.readUInt32LE(end + 16),
      total = 0;
    const names = new Set<string>();
    for (let i = 0; i < count; i++) {
      if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw Error();
      const flags = buffer.readUInt16LE(cursor + 8),
        method = buffer.readUInt16LE(cursor + 10);
      const compressed = buffer.readUInt32LE(cursor + 20),
        size = buffer.readUInt32LE(cursor + 24);
      const nameSize = buffer.readUInt16LE(cursor + 28);
      const name = buffer
        .subarray(cursor + 46, cursor + 46 + nameSize)
        .toString("utf8");
      if (
        names.has(name) ||
        name.includes("..") ||
        flags & 1 ||
        ![0, 8].includes(method)
      )
        throw Error();
      names.add(name);
      total += size;
      if (total > 40 * 1024 * 1024) throw Error();
      const local = buffer.readUInt32LE(cursor + 42);
      if (buffer.readUInt32LE(local) !== 0x04034b50) throw Error();
      const start =
        local +
        30 +
        buffer.readUInt16LE(local + 26) +
        buffer.readUInt16LE(local + 28);
      if (start + compressed > buffer.length) throw Error();
      const zipped = buffer.subarray(start, start + compressed);
      const bytes =
        method === 0
          ? zipped
          : inflateRawSync(zipped, { maxOutputLength: Math.max(1, size) });
      if (bytes.length !== size) throw Error();
      if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) {
        const xml = bytes.toString("utf8");
        if ((xml.match(/<row[ >]/g) || []).length > 5001) throw Error();
        for (const match of xml.matchAll(/<row\b[^>]*\br="(\d+)"/g))
          if (Number(match[1]) > 5001) throw Error();
      }
      cursor +=
        46 +
        nameSize +
        buffer.readUInt16LE(cursor + 30) +
        buffer.readUInt16LE(cursor + 32);
    }
    if (
      !names.has("[Content_Types].xml") ||
      !names.has("xl/workbook.xml") ||
      names.has("xl/vbaProject.bin")
    )
      throw Error();
  } catch {
    throw new BadRequestException(
      "File XLSX không hợp lệ hoặc vượt giới hạn giải nén/số dòng. Hãy dùng file mẫu.",
    );
  }
}
