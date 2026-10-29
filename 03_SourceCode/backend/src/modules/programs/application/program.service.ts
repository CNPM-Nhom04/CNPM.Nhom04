import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import { mkdir, stat, unlink, writeFile } from "fs/promises";
import { basename, dirname, extname, resolve } from "path";
import { ProgramActor, ProgramRepository } from "../domain/program";
import {
  CurriculumDto,
  ProgramInputDto,
  ProgramQueryDto,
  ReviewDto,
} from "./program.dto";
export interface ProgramUpload {
  buffer: Buffer;
  originalname: string;
  size: number;
}
@Injectable()
export class ProgramService {
  constructor(private readonly repository: ProgramRepository) {}
  private id(id: string) {
    if (!/^[1-9]\d{0,19}$/.test(id))
      throw new BadRequestException("ID không hợp lệ.");
  }
  list(query: ProgramQueryDto, actor: ProgramActor) {
    return this.repository.list(query, actor);
  }
  unversioned(query: ProgramQueryDto, actor: ProgramActor) {
    return this.repository.unversioned(query, actor);
  }
  baseProgram(id: string, actor: ProgramActor) {
    this.id(id);
    return this.repository.baseProgram(id, actor);
  }
  createVersion(id: string, input: ProgramInputDto, actor: ProgramActor) {
    this.id(id);
    return this.repository.create(input, actor, id);
  }
  options(actor: ProgramActor) {
    return this.repository.options(actor);
  }
  catalog(query: ProgramQueryDto, actor: ProgramActor) {
    return this.repository.catalog(query, actor);
  }
  detail(id: string, actor: ProgramActor) {
    this.id(id);
    return this.repository.detail(id, actor);
  }
  create(input: ProgramInputDto, actor: ProgramActor) {
    return this.repository.create(input, actor);
  }
  update(id: string, input: ProgramInputDto, actor: ProgramActor) {
    this.id(id);
    return this.repository.update(id, input, actor);
  }
  structure(id: string, input: CurriculumDto, actor: ProgramActor) {
    this.id(id);
    return this.repository.structure(id, input, actor);
  }
  async validate(id: string, actor: ProgramActor) {
    this.id(id);
    const issues = await this.repository.validate(id, actor);
    return { valid: issues.length === 0, issues };
  }
  submit(id: string, revision: number, actor: ProgramActor) {
    this.id(id);
    return this.repository.submit(id, revision, actor);
  }
  review(id: string, input: ReviewDto, actor: ProgramActor) {
    this.id(id);
    return this.repository.review(id, input, input.revision, actor);
  }
  private storage(key: string) {
    if (!/^[a-f0-9-]{36}\.(pdf|docx)$/.test(key))
      throw new NotFoundException("Đường dẫn tài liệu không hợp lệ.");
    return resolve(
      process.env.PROGRAM_UPLOAD_DIR ||
        resolve(process.cwd(), "storage", "program-reviews"),
      key,
    );
  }
  async upload(
    id: string,
    file: ProgramUpload | undefined,
    actor: ProgramActor,
  ) {
    this.id(id);
    if (!file || file.size === 0 || file.size > 25 * 1024 * 1024)
      throw new BadRequestException(
        "Tài liệu phải có nội dung và không vượt 25MB.",
      );
    const decodedName = Buffer.from(file.originalname, "latin1").toString(
      "utf8",
    );
    const originalName = decodedName.includes("\uFFFD")
      ? file.originalname
      : decodedName;
    const name = basename(originalName.replace(/\\/g, "/")).slice(0, 255),
      extension = extname(name).toLowerCase();
    const pdf =
      extension === ".pdf" && file.buffer.subarray(0, 5).toString() === "%PDF-";
    const docx =
      extension === ".docx" &&
      file.buffer
        .subarray(0, 4)
        .equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) &&
      file.buffer.includes(Buffer.from("[Content_Types].xml")) &&
      file.buffer.includes(Buffer.from("word/document.xml"));
    if (!pdf && !docx)
      throw new BadRequestException(
        "Chỉ nhận file PDF hoặc DOCX đúng định dạng.",
      );
    await this.repository.detail(id, actor);
    const storageKey = randomUUID() + extension,
      path = this.storage(storageKey);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, file.buffer, { flag: "wx", mode: 0o600 });
    try {
      return await this.repository.addDocument(
        id,
        {
          storageKey,
          name,
          mime: pdf
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          size: file.size,
        },
        actor,
      );
    } catch (error) {
      await unlink(path).catch(() => undefined);
      throw error;
    }
  }
  async download(id: string, documentId: string, actor: ProgramActor) {
    this.id(id);
    this.id(documentId);
    const document = await this.repository.document(id, documentId, actor),
      path = this.storage(document.storageKey);
    try {
      await stat(path);
    } catch {
      throw new NotFoundException("Tệp không còn trên máy chủ.");
    }
    return {
      stream: createReadStream(path),
      name: document.name,
      mime: document.mime,
    };
  }
}
