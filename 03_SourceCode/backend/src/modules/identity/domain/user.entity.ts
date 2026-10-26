import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("increment", { type: "bigint", unsigned: true })
  id: string;

  @Column({
    name: "organizational_unit_id",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  organizationalUnitId: string;

  @Column({ name: "username", type: "varchar", length: 100, unique: true })
  username: string;

  @Column({
    name: "email",
    type: "varchar",
    length: 255,
    nullable: true,
    unique: true,
  })
  email: string;

  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash: string;

  @Column({ name: "full_name", type: "varchar", length: 255 })
  fullName: string;

  @Column({
    name: "account_status",
    type: "varchar",
    length: 30,
    default: "ACTIVE",
  })
  accountStatus: string;

  @Column({
    name: "failed_login_count",
    type: "int",
    unsigned: true,
    default: 0,
  })
  failedLoginCount: number;

  @Column({
    name: "locked_until",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  lockedUntil: Date;

  @Column({
    name: "last_login_at",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  lastLoginAt: Date;

  @Column({ name: "must_change_password", type: "boolean", default: false })
  mustChangePassword: boolean;

  @Column({
    name: "password_changed_at",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  passwordChangedAt: Date;

  @CreateDateColumn({ name: "created_at", type: "datetime", precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "datetime", precision: 6 })
  updatedAt: Date;

  @DeleteDateColumn({
    name: "deleted_at",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  deletedAt: Date;
}
