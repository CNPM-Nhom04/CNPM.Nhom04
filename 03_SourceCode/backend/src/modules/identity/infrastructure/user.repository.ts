import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../domain/user.entity";
import { IUserRepository } from "../domain/user.repository.interface";

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(User)
    private readonly typeOrmRepo: Repository<User>,
  ) {}

  async findByUsernameOrEmail(identifier: string): Promise<User | null> {
    return this.typeOrmRepo.findOne({
      where: [{ username: identifier }, { email: identifier }],
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.typeOrmRepo.findOne({ where: { id } });
  }

  async save(user: User): Promise<User> {
    return this.typeOrmRepo.save(user);
  }

  async findRoleCodes(userId: string): Promise<string[]> {
    const rows = await this.typeOrmRepo.manager.query(
      "SELECT r.role_code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? AND r.status = 'ACTIVE' ORDER BY r.id",
      [userId],
    );
    return rows.map((row) => row.role_code);
  }
}
