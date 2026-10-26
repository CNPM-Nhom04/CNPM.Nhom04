import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PasswordResetToken } from "../domain/password-reset-token.entity";
import { IPasswordResetTokenRepository } from "../domain/password-reset-token.repository.interface";

@Injectable()
export class PasswordResetTokenRepository implements IPasswordResetTokenRepository {
  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly typeOrmRepo: Repository<PasswordResetToken>,
  ) {}

  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.typeOrmRepo.findOne({
      where: { tokenHash },
    });
  }

  async save(token: Partial<PasswordResetToken>): Promise<PasswordResetToken> {
    return this.typeOrmRepo.save(token);
  }
}
