import { User } from "./user.entity";

export interface IUserRepository {
  findByUsernameOrEmail(identifier: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<User>;
}
