
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";

import { ProjectOrmEntity } from "./ProjectOrmEntity";
import { UserOrmEntity } from "./UserOrmEntity";

import {
  TaskStatus,
  TaskPriority,
} from "../../../domain/entities/Task";

@Entity({ name: "tasks" })
export class TaskOrmEntity {
  @PrimaryGeneratedColumn("increment", {
    type: "bigint",
    name: "id",
  })
  taskId!: number;

  @Column({
    name: "project_id",
    type: "bigint",
  })
  projectId!: number;

  @ManyToOne(() => ProjectOrmEntity, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({
    name: "project_id",
    referencedColumnName: "projectId",
  })
  project!: ProjectOrmEntity;

  @Column({
    name: "assignee_id",
    type: "bigint",
    nullable: true,
  })
  assigneeId!: number | null;

  @ManyToOne(() => UserOrmEntity, {
    nullable: true,
    onDelete: "RESTRICT",
  })
  @JoinColumn({
    name: "assignee_id",
    referencedColumnName: "userId",
  })
  assignee!: UserOrmEntity | null;

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
    name: "title",
    type: "varchar",
    length: 200,
  })
  title!: string;

  @Column({
    name: "description",
    type: "text",
    nullable: true,
  })
  description!: string | null;

  @Column({
    name: "status",
    type: "varchar",
    length: 20,
    default: "TODO",
  })
  status!: TaskStatus;

  @Column({
    name: "priority",
    type: "varchar",
    length: 10,
    default: "MEDIUM",
  })
  priority!: TaskPriority;

  @Column({
    name: "due_at",
    type: "timestamptz",
    nullable: true,
  })
  dueAt!: Date | null;

  @Column({
    name: "version",
    type: "integer",
    default: 1,
  })
  version!: number;

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
