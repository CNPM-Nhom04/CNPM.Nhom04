import { User } from "./user.entity";
export interface AuthPolicy {
  lockThreshold: number;
  lockMinutes: number;
  sessionMinutes: number;
  resetMinutes: number;
  passwordMinLength: number;
}
export interface AccountAccess {
  roles: string[];
  roleNames: string[];
  permissions: string[];
  orgUnitName: string | null;
}
export abstract class AuthSecurityRepository {
  abstract policy(): Promise<AuthPolicy>;
  abstract access(userId: string): Promise<AccountAccess>;
  abstract recordFailure(
    userId: string,
    hash: string,
    policy: AuthPolicy,
    ip?: string,
  ): Promise<void>;
  abstract completeLogin(
    userId: string,
    hash: string,
    sessionId: string,
    minutes: number,
    ip?: string,
  ): Promise<User | null>;
  abstract validSession(userId: string, sessionId: string): Promise<boolean>;
  abstract revokeSession(userId: string, sessionId: string): Promise<void>;
  abstract changePassword(
    userId: string,
    oldHash: string,
    newHash: string,
  ): Promise<boolean>;
  abstract createReset(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    ip?: string,
  ): Promise<boolean>;
  abstract consumeReset(tokenHash: string, newHash: string): Promise<boolean>;
}
