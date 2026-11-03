import { BadRequestException, Injectable } from "@nestjs/common";
import { Actor, AdminRepository } from "../domain/admin.repository";
import { FacultyInput, FacultyQuery } from "../domain/faculty";
@Injectable()
export class FacultyService {
  constructor(private readonly repository: AdminRepository) {}
  private id(id: string) {
    if (!/^[1-9]\d{0,19}$/.test(id) || BigInt(id) > 18446744073709551615n)
      throw new BadRequestException("ID khoa không hợp lệ.");
  }
  list(query: FacultyQuery) {
    return this.repository.listFaculties(query);
  }
  save(
    id: string | null,
    input: FacultyInput,
    actor: Actor,
    expected?: string,
  ) {
    if (id) this.id(id);
    return this.repository.saveFaculty(id, input, actor, expected);
  }
  remove(id: string, expected: string, actor: Actor) {
    this.id(id);
    return this.repository
      .deleteFaculty(id, expected, actor)
      .then(() => ({ message: "Đã xóa khoa chưa sử dụng." }));
  }
}
