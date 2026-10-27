import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { DefenseActor, DefenseRepository } from "../domain/thesis-defense";
import {
  CreateDefenseDto,
  DefenseQueryDto,
  RecordDefenseResultDto,
} from "./thesis-defense.dto";
@Injectable()
export class ThesisDefenseService {
  constructor(private readonly repository: DefenseRepository) {}
  list(query: DefenseQueryDto, actor: DefenseActor) {
    return this.repository.list(query, actor);
  }
  students(query: DefenseQueryDto, actor: DefenseActor) {
    return this.repository.students(query, actor);
  }
  private validateId(id: string) {
    if (!/^[1-9]\d{0,19}$/.test(id))
      throw new BadRequestException("ID lịch bảo vệ không hợp lệ.");
  }
  findById(id: string, actor: DefenseActor) {
    this.validateId(id);
    return this.repository.findById(id, actor);
  }
  create(input: CreateDefenseDto, actor: DefenseActor) {
    if (!actor.canSchedule)
      throw new ForbiddenException("Bạn không có quyền lập lịch bảo vệ.");
    return this.repository.create(input, actor);
  }
  recordResult(id: string, input: RecordDefenseResultDto, actor: DefenseActor) {
    this.validateId(id);
    if (!actor.canRecord)
      throw new ForbiddenException("Bạn không có quyền ghi kết quả bảo vệ.");
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return this.repository.recordResult(id, input.diemTrungBinh, today, actor);
  }
}
