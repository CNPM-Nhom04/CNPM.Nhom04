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
  CancelDefenseDto,
} from "./thesis-defense.dto";
@Injectable()
export class ThesisDefenseService {
  constructor(private readonly repository: DefenseRepository) {}
  today() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
  async policy() {
    return { ...(await this.repository.policy()), today: this.today() };
  }
  cancel(id: string, input: CancelDefenseDto, actor: DefenseActor) {
    this.validateId(id);
    if (!actor.canSchedule)
      throw new ForbiddenException("Bạn không có quyền hủy lịch bảo vệ.");
    return this.repository.cancel(id, input.reason, actor);
  }
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
    if (!input.eligibilityConfirmed || !input.eligibilityNote?.trim())
      throw new BadRequestException(
        "Cần xác nhận và ghi căn cứ kiểm tra điều kiện bảo vệ.",
      );
    if (input.ngayBaoVe < this.today())
      throw new BadRequestException("Lịch mới không được trước ngày hiện tại.");
    const names = [input.chuTichHoidong, input.phanBien, input.thuKy].map(
      (name) =>
        (name || "")
          .normalize("NFKC")
          .trim()
          .replace(/\s+/g, " ")
          .toLocaleLowerCase("vi"),
    );
    if (names.some((name) => !name) || new Set(names).size !== 3)
      throw new BadRequestException(
        "Cần nhập chủ tịch, phản biện và thư ký khác nhau theo hồ sơ hội đồng.",
      );
    return this.repository.create(input, actor);
  }
  recordResult(id: string, input: RecordDefenseResultDto, actor: DefenseActor) {
    this.validateId(id);
    if (!actor.canRecord)
      throw new ForbiddenException("Bạn không có quyền ghi kết quả bảo vệ.");
    const today = this.today();
    return this.repository.recordResult(id, input.diemTrungBinh, today, actor);
  }
}
