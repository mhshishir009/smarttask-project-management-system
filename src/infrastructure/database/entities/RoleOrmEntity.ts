import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Check,
} from "typeorm";

@Entity({ name: "roles" })
@Check("chk_role_code", `"code" IN ('ADMIN', 'TEAM_MEMBER')`)
@Check("chk_role_name", `length(btrim("name")) > 0`)
export class RoleOrmEntity {
  @PrimaryGeneratedColumn("identity", {
    type: "smallint",
    name: "id",
  })
  roleId!: number;

  @Column({
    name: "code",
    type: "varchar",
    length: 30,
    unique: true,
  })
  roleCode!: string;

  @Column({
    name: "name",
    type: "varchar",
    length: 100,
  })
  roleName!: string;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamptz",
  })
  createdAt!: Date;
}
