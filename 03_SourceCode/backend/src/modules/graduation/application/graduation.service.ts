import { BadRequestException, Injectable } from "@nestjs/common";
import { GraduationActor, GraduationRepository } from "../domain/graduation";
import {
  GraduationBatchDto,
  GraduationEvidenceDto,
  GraduationPolicyDto,
  GraduationQueryDto,
} from "./graduation.dto";
@Injectable()
export class GraduationService {
  constructor(private readonly repository: GraduationRepository) {}
  private id(id: string) {
    if (!/^[1-9]\d{0,19}$/.test(id))
      throw new BadRequestException("ID không hợp lệ.");
  }
  list(query: GraduationQueryDto, actor: GraduationActor) {
    return this.repository.list(query, actor);
  }
  detail(id: string, actor: GraduationActor) {
    this.id(id);
    return this.repository.detail(id, actor);
  }
  options(actor: GraduationActor) {
    return this.repository.options(actor);
  }
  policy(id: string, actor: GraduationActor) {
    this.id(id);
    return this.repository.policy(id, actor);
  }
  savePolicy(id: string, input: GraduationPolicyDto, actor: GraduationActor) {
    this.id(id);
    return this.repository.savePolicy(id, input, actor);
  }
  saveEvidence(
    id: string,
    input: GraduationEvidenceDto,
    actor: GraduationActor,
  ) {
    this.id(id);
    return this.repository.saveEvidence(id, input, actor);
  }
  check(id: string, actor: GraduationActor) {
    this.id(id);
    return this.repository.check(id, actor);
  }
  batch(input: GraduationBatchDto, actor: GraduationActor) {
    return this.repository.batch(input, actor);
  }
  history(id: string, page: number, actor: GraduationActor) {
    this.id(id);
    return this.repository.history(id, page, actor);
  }
}
