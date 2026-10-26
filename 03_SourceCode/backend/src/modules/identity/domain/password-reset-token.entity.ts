import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("password_reset_tokens")
export class PasswordResetToken {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: string;

  @Column({ name: "user_id", type: "bigint", unsigned: true })
  userId: string;

  @Column({ name: "token_hash", type: "varchar", length: 255, unique: true })
  tokenHash: string;

  @Column({ name: "expires_at", type: "datetime", precision: 6 })
  expiresAt: Date;

  @Column({ name: "used_at", type: "datetime", precision: 6, nullable: true })
  usedAt: Date | null;

  @Column({ name: "requested_ip", type: "varchar", length: 45, nullable: true })
  requestedIp: string | null;

  @CreateDateColumn({ name: "created_at", type: "datetime", precision: 6 })
  createdAt: Date;
}
