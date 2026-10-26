
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";

import { UserOrmEntity } from "./UserOrmEntity";

@Entity({ name: "projects" })
export class ProjectOrmEntity {
  @PrimaryGeneratedColumn("increment", {
    type: "bigint",
    name: "id",
  })
  projectId!: number;

  @Column({
    name: "name",
    type: "varchar",
    length: 200,
  })
  name!: string;

  @Column({
    name: "description",
    type: "text",
    nullable: true,
  })
  description!: string | null;

  @Column({
    name: "created_by",
    type: "bigint",
  })
  createdBy!: number;

  @ManyToOne(() => UserOrmEntity, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({
    name: "created_by",
    referencedColumnName: "userId",
  })
  creator!: UserOrmEntity;

  @Column({
    name: "is_archived",
    type: "boolean",
    default: false,
  })
  isArchived!: boolean;

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
