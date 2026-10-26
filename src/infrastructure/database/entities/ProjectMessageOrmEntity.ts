import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Check, Index } from "typeorm";
import { ProjectOrmEntity } from "./ProjectOrmEntity";
import { UserOrmEntity } from "./UserOrmEntity";

@Entity({name: "project_messages"})
@Index("idx_project_messages_thread", ["projectId", "messageId"])
@Check("chk_project_messages_body", `length(btrim("body")) > 0 AND char_length("body") <= 2000`)
export class ProjectMessageOrmEntity {
  @PrimaryGeneratedColumn("increment", {type: "bigint", name: "id"}) messageId!: number;
  @Column({type: "bigint", name: "project_id"}) projectId!: number;
  @Column({type: "bigint", name: "author_id"}) authorId!: number;
  @Column({type: "text", name: "body"}) body!: string;
  @CreateDateColumn({type: "timestamptz", name: "created_at"}) createdAt!: Date;
  @ManyToOne(() => ProjectOrmEntity, {nullable: false, onDelete: "RESTRICT"})
  @JoinColumn({name: "project_id", referencedColumnName: "projectId", foreignKeyConstraintName: "fk_project_messages_project"}) project!: ProjectOrmEntity;
  @ManyToOne(() => UserOrmEntity, {nullable: false, onDelete: "RESTRICT"})
  @JoinColumn({name: "author_id", referencedColumnName: "userId", foreignKeyConstraintName: "fk_project_messages_author"}) author!: UserOrmEntity;
}
