import { PasswordResetToken } from "./password-reset-token.entity";

export interface IPasswordResetTokenRepository {
  findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null>;
  save(token: Partial<PasswordResetToken>): Promise<PasswordResetToken>;
}
