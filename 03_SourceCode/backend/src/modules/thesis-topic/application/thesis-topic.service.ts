import { BadRequestException, Injectable } from "@nestjs/common";
import {
  TopicActor,
  TopicRepository,
  TopicQuery,
  TopicInput,
  TopicChange,
  SupervisorInput,
} from "../domain/thesis-topic";
@Injectable()
export class ThesisTopicService {
  constructor(private readonly repository: TopicRepository) {}
  private id(id: string) {
    if (!/^[1-9]\d{0,19}$/.test(id) || BigInt(id) > 18446744073709551615n)
      throw new BadRequestException("ID không hợp lệ.");
  }
  list(q: TopicQuery, a: TopicActor) {
    return this.repository.list(q, a);
  }
  students(q: TopicQuery, a: TopicActor) {
    return this.repository.students(q, a);
  }
  supervisors(q: TopicQuery, a: TopicActor) {
    return this.repository.supervisors(q, a);
  }
  units(a: TopicActor) {
    return this.repository.units(a);
  }
  detail(id: string, a: TopicActor) {
    this.id(id);
    return this.repository.detail(id, a);
  }
  create(input: TopicInput, a: TopicActor) {
    this.id(input.assignmentId);
    this.id(input.supervisorId);
    return this.repository.create(input, a);
  }
  change(id: string, action: string, input: TopicChange, a: TopicActor) {
    this.id(id);
    if (input.supervisorId) this.id(input.supervisorId);
    return this.repository.change(id, action, input, a);
  }
  createSupervisor(input: SupervisorInput, a: TopicActor) {
    this.id(input.unitId);
    return this.repository.createSupervisor(input, a);
  }
  supervisorStatus(
    id: string,
    status: string,
    expected: string,
    a: TopicActor,
  ) {
    this.id(id);
    return this.repository.supervisorStatus(id, status, expected, a);
  }
}
