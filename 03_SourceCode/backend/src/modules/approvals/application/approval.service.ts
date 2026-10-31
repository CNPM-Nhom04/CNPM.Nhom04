import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ApprovalRepository } from "../domain/approval";
import { ProgramActor, ProgramRepository } from "../../programs/domain/program";
import {
  ProgramService,
  ProgramUpload,
} from "../../programs/application/program.service";
import {
  ApprovalDecisionDto,
  ApprovalQueryDto,
  ApprovalRevisionDto,
} from "./approval.dto";
@Injectable()
export class ApprovalService {
  constructor(
    private readonly repository: ApprovalRepository,
    private readonly programs: ProgramRepository,
    private readonly programService: ProgramService,
  ) {}
  private id(id: string) {
    if (!/^[1-9]\d{0,19}$/.test(id))
      throw new BadRequestException("ID hồ sơ không hợp lệ.");
  }
  list(query: ApprovalQueryDto, actor: ProgramActor) {
    return this.repository.list(query, actor.id);
  }
  async detail(id: string, actor: ProgramActor) {
    this.id(id);
    const request = await this.repository.detail(id, actor.id);
    const program = await this.programs.detail(request.versionId, actor);
    const eligible =
      request.status === "PENDING" &&
      ["SUBMITTED", "REVIEWING"].includes(program.status) &&
      request.requesterId !== actor.id;
    return {
      ...request,
      program,
      permissions: {
        canStart: eligible && program.status === "SUBMITTED",
        canDecide: eligible,
        canUpload: eligible,
      },
    };
  }
  async start(id: string, input: ApprovalRevisionDto, actor: ProgramActor) {
    this.id(id);
    const request = await this.repository.detail(id, actor.id);
    await this.programs.startReview(
      request.versionId,
      id,
      input.requestRevision,
      actor,
    );
    return this.detail(id, actor);
  }
  async decide(id: string, input: ApprovalDecisionDto, actor: ProgramActor) {
    this.id(id);
    const request = await this.repository.detail(id, actor.id);
    await this.programs.review(
      request.versionId,
      { ...input, requestId: id },
      input.revision,
      actor,
    );
    return this.detail(id, actor);
  }
  async upload(
    id: string,
    file: ProgramUpload | undefined,
    actor: ProgramActor,
  ) {
    this.id(id);
    const request = await this.repository.detail(id, actor.id);
    if (request.status !== "PENDING")
      throw new ConflictException(
        "Hồ sơ đã kết thúc, không thể thêm tài liệu.",
      );
    return this.programService.upload(request.versionId, file, actor, id);
  }
  async download(id: string, documentId: string, actor: ProgramActor) {
    this.id(id);
    this.id(documentId);
    const request = await this.repository.detail(id, actor.id);
    if (!request.documents.some((d) => d.id === documentId))
      throw new NotFoundException("Không tìm thấy tài liệu thuộc hồ sơ này.");
    return this.programService.download(request.versionId, documentId, actor);
  }
}
