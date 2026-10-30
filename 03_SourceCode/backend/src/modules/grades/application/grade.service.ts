import { BadRequestException, Injectable } from "@nestjs/common";
import {
  GradeActor,
  GradePolicyInput,
  GradeQuery,
  GradeRepository,
  GradeWrite,
  LegacyWrite,
} from "../domain/grade";
import { validatePolicy } from "../domain/calculate-grade";
@Injectable()
export class GradeService {
  constructor(private readonly repository: GradeRepository) {}
  private id(id: string) {
    if (!/^[1-9]\d{0,19}$/.test(id) || BigInt(id) > 18446744073709551615n)
      throw new BadRequestException("ID không hợp lệ.");
  }
  list(q: GradeQuery, a: GradeActor) {
    return this.repository.list(q, a);
  }
  classes(q: GradeQuery, a: GradeActor) {
    return this.repository.classes(q, a);
  }
  registrations(q: GradeQuery, a: GradeActor) {
    return this.repository.registrations(q, a);
  }
  detail(id: string, a: GradeActor) {
    this.id(id);
    return this.repository.detail(id, a);
  }
  policy(id: string, a: GradeActor) {
    this.id(id);
    return this.repository.policy(id, a);
  }
  savePolicy(id: string, b: GradePolicyInput, a: GradeActor) {
    this.id(id);
    validatePolicy(b);
    return this.repository.savePolicy(id, b, a);
  }
  create(b: GradeWrite, a: GradeActor) {
    this.id(b.registrationId);
    return this.repository.create(b, a);
  }
  update(id: string, b: GradeWrite, a: GradeActor) {
    this.id(id);
    return this.repository.update(id, b, a);
  }
  action(id: string, action: string, b: GradeWrite, a: GradeActor) {
    this.id(id);
    return this.repository.action(id, action, b, a);
  }
  legacy(id: string, b: LegacyWrite, a: GradeActor) {
    this.id(id);
    const pass = ["PASSED", "EXEMPTED"].includes(b.resultStatus);
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    if (
      pass &&
      (!b.passedDate || b.passedDate < "1000-01-01" || b.passedDate > today)
    )
      throw new BadRequestException(
        "Cần ngày đạt/miễn theo hồ sơ, không được ở tương lai.",
      );
    if (!pass && b.passedDate)
      throw new BadRequestException(
        "Kết quả chưa đạt/chưa hoàn tất không có ngày đạt.",
      );
    if (["PASSED", "FAILED"].includes(b.resultStatus) && !b.grade?.trim())
      throw new BadRequestException("Cần điểm/ký hiệu kết quả chính thức.");
    if (b.resultStatus === "INCOMPLETE" && b.grade?.trim())
      throw new BadRequestException(
        "Kết quả chưa hoàn tất phải để trống điểm.",
      );
    return this.repository.legacy(id, b, a);
  }
}
