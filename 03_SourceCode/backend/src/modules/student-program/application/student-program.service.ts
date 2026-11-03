import { Injectable } from "@nestjs/common";
import { StudentProgramRepository } from "../domain/student-program";
@Injectable()
export class StudentProgramService {
  constructor(private readonly repository: StudentProgramRepository) {}
  own(userId: string) {
    return this.repository.own(userId);
  }
}
