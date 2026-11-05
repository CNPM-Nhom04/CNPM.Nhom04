import { BadRequestException, Injectable } from "@nestjs/common";
import {
  PortalActor,
  PortalQuery,
  PortalRepository,
  PublicDocumentInput,
  SubscriptionInput,
} from "../domain/portal";
@Injectable()
export class PortalService {
  constructor(private readonly repository: PortalRepository) {}
  private id(id: string) {
    if (!/^[1-9]\d{0,19}$/.test(id) || BigInt(id) > 18446744073709551615n)
      throw new BadRequestException("ID không hợp lệ.");
  }
  options() {
    return this.repository.options();
  }
  programs(q: PortalQuery, viewerId?: string) {
    return this.repository.programs(q, viewerId);
  }
  program(id: string, viewerId?: string) {
    this.id(id);
    return this.repository.program(id, viewerId);
  }
  documents(q: PortalQuery, admin = false) {
    return this.repository.documents(q, admin);
  }
  async subscribe(input: SubscriptionInput) {
    this.id(input.levelId);
    if (input.majorId) this.id(input.majorId);
    if (input.graduationYear && input.graduationYear > new Date().getFullYear())
      throw new BadRequestException(
        "Năm tốt nghiệp không được lớn hơn năm hiện tại.",
      );
    await this.repository.subscribe(input);
    return {
      message:
        "Đã ghi nhận yêu cầu nhận thông tin tuyển sinh. Bộ phận phụ trách sẽ liên hệ theo thông tin bạn cung cấp.",
    };
  }
  saveDocument(
    id: string | null,
    input: PublicDocumentInput,
    actor: PortalActor,
  ) {
    if (id) {
      this.id(id);
      if (!input.revision)
        throw new BadRequestException("Thiếu revision của văn bản.");
    }
    return this.repository.saveDocument(id, input, actor);
  }
  deleteDocument(id: string, revision: number, actor: PortalActor) {
    this.id(id);
    return this.repository.deleteDocument(id, revision, actor);
  }
  subscriptions(q: PortalQuery) {
    return this.repository.subscriptions(q);
  }
  contact(id: string, revision: number, actor: PortalActor) {
    this.id(id);
    return this.repository.contact(id, revision, actor);
  }
}
