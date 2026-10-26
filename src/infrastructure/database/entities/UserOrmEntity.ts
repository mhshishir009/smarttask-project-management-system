
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Check,
} from "typeorm";

import { RoleOrmEntity } from "./RoleOrmEntity";

@Entity({ name: "users" })
@Check("chk_users_full_name", `length(btrim("full_name")) > 0`)
@Check("chk_users_email", `length(btrim("email")) > 3 AND "email" = btrim("email") AND position('@' IN "email") > 1`)
@Check("chk_users_password_hash", `length("password_hash") > 0`)
@Check("chk_users_auth_version", `"auth_version" >= 0`)
export class UserOrmEntity {
  @PrimaryGeneratedColumn("identity", {
    type: "bigint",
    name: "id",
  })
  userId!: number;

  @Column({
    name: "role_id",
    type: "smallint",
  })
  roleId!: number;

  @ManyToOne(() => RoleOrmEntity, {
    nullable: false,
    onDelete: "RESTRICT",
    onUpdate: "RESTRICT",
  })
  @JoinColumn({
    name: "role_id",
    referencedColumnName: "roleId",
  })
  role!: RoleOrmEntity;

  @Column({
    name: "full_name",
    type: "varchar",
    length: 150,
  })
  fullName!: string;

  @Column({
    name: "email",
    type: "varchar",
    length: 255,
  })
  email!: string;

  @Column({
    name: "password_hash",
    type: "text",
    select: false,
  })
  passwordHash!: string;

  @Column({
    name: "is_active",
    type: "boolean",
    default: true,
  })
  isActive!: boolean;

  @Column({
    name: "is_system_admin",
    type: "boolean",
    default: false,
  })
  isSystemAdmin!: boolean;

  @Column({
    name: "must_change_password",
    type: "boolean",
    default: false,
  })
  mustChangePassword!: boolean;

  @Column({
    name: "auth_version",
    type: "bigint",
    default: 0,
  })
  authVersion!: number;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamptz",
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: "updated_at",
    type: "timestamptz",
  })
  updatedAt!: Date;
}
