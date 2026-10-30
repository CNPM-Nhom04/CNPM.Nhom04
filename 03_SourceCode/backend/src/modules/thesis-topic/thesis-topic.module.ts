import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { TopicRepository } from "./domain/thesis-topic";
import { MysqlTopicRepository } from "./infrastructure/thesis-topic.repository";
import { ThesisTopicService } from "./application/thesis-topic.service";
import { ThesisTopicController } from "./presentation/thesis-topic.controller";
import { ThesisTopicGuard } from "./presentation/thesis-topic.guard";
@Module({
  imports: [IdentityModule],
  controllers: [ThesisTopicController],
  providers: [
    ThesisTopicService,
    ThesisTopicGuard,
    { provide: TopicRepository, useClass: MysqlTopicRepository },
  ],
})
export class ThesisTopicModule {}
