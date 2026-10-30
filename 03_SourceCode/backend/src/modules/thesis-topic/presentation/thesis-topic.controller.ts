import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../identity/presentation/jwt-auth.guard";
import { ThesisTopicService } from "../application/thesis-topic.service";
import {
  CreateSupervisorDto,
  CreateTopicDto,
  SupervisorStatusDto,
  TopicDecisionDto,
  TopicNoteDto,
  TopicQueryDto,
  UpdateTopicDto,
} from "../application/thesis-topic.dto";
import {
  ThesisTopicGuard,
  TopicPermission,
  TopicRequest,
} from "./thesis-topic.guard";
@ApiTags("Thesis Topics - Đề tài và GVHD")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ThesisTopicGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller("de-tai-luan-van")
export class ThesisTopicController {
  constructor(private readonly service: ThesisTopicService) {}
  @Get() @ApiOperation({ summary: "Danh sách đề tài theo phạm vi SQL" }) list(
    @Query() q: TopicQueryDto,
    @Req() r: TopicRequest,
  ) {
    return this.service.list(q, r.topicActor);
  }
  @Get("hoc-vien") students(@Query() q: TopicQueryDto, @Req() r: TopicRequest) {
    return this.service.students(q, r.topicActor);
  }
  @Get("don-vi") units(@Req() r: TopicRequest) {
    return this.service.units(r.topicActor);
  }
  @Get("giang-vien") supervisors(
    @Query() q: TopicQueryDto,
    @Req() r: TopicRequest,
  ) {
    return this.service.supervisors(q, r.topicActor);
  }
  @Post("giang-vien") @TopicPermission("TOPIC_MANAGE") createSupervisor(
    @Body() b: CreateSupervisorDto,
    @Req() r: TopicRequest,
  ) {
    return this.service.createSupervisor(b, r.topicActor);
  }
  @Post("giang-vien/:id/trang-thai")
  @TopicPermission("TOPIC_MANAGE")
  supervisorStatus(
    @Param("id") id: string,
    @Body() b: SupervisorStatusDto,
    @Req() r: TopicRequest,
  ) {
    return this.service.supervisorStatus(
      id,
      b.status,
      b.expectedStatus,
      r.topicActor,
    );
  }
  @Get(":id") detail(@Param("id") id: string, @Req() r: TopicRequest) {
    return this.service.detail(id, r.topicActor);
  }
  @Post() @TopicPermission("TOPIC_MANAGE") create(
    @Body() b: CreateTopicDto,
    @Req() r: TopicRequest,
  ) {
    return this.service.create(b, r.topicActor);
  }
  @Post(":id/cap-nhat") @TopicPermission("TOPIC_MANAGE") update(
    @Param("id") id: string,
    @Body() b: UpdateTopicDto,
    @Req() r: TopicRequest,
  ) {
    return this.service.change(id, "edit", b, r.topicActor);
  }
  @Post(":id/duyet") @TopicPermission("TOPIC_APPROVE") approve(
    @Param("id") id: string,
    @Body() b: TopicDecisionDto,
    @Req() r: TopicRequest,
  ) {
    return this.service.change(id, "approve", b, r.topicActor);
  }
  @Post(":id/tu-choi") @TopicPermission("TOPIC_APPROVE") reject(
    @Param("id") id: string,
    @Body() b: TopicNoteDto,
    @Req() r: TopicRequest,
  ) {
    return this.service.change(id, "reject", b, r.topicActor);
  }
  @Post(":id/huy") @TopicPermission("TOPIC_MANAGE") cancel(
    @Param("id") id: string,
    @Body() b: TopicNoteDto,
    @Req() r: TopicRequest,
  ) {
    return this.service.change(id, "cancel", b, r.topicActor);
  }
  @Post(":id/nghiem-thu") @TopicPermission("TOPIC_COMPLETE") complete(
    @Param("id") id: string,
    @Body() b: TopicDecisionDto,
    @Req() r: TopicRequest,
  ) {
    return this.service.change(id, "complete", b, r.topicActor);
  }
}
