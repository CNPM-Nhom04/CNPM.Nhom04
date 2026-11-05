import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../identity/presentation/jwt-auth.guard";
import { AdminGuard, AdminRequest } from "../../admin/presentation/admin.guard";
import { PortalService } from "../application/portal.service";
import {
  PortalQueryDto,
  PortalRevisionDto,
  PublicDocumentDto,
  SubscriptionDto,
} from "../application/portal.dto";
import { OptionalPortalAuthGuard } from "./optional-portal-auth.guard";
import { SubscriptionRateGuard } from "./subscription-rate.guard";
@ApiTags("Public - Cổng thông tin")
@Controller("public")
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class PortalController {
  constructor(private readonly service: PortalService) {}
  @Get("options") options() {
    return this.service.options();
  }
  @Get("chuong-trinh-dao-tao")
  @UseGuards(OptionalPortalAuthGuard)
  @Header("Cache-Control", "private, no-store")
  programs(
    @Query() q: PortalQueryDto,
    @Req() req: { user?: { userId: string } },
  ) {
    return this.service.programs(q, req.user?.userId);
  }
  @Get("chuong-trinh-dao-tao/:id")
  @UseGuards(OptionalPortalAuthGuard)
  @Header("Cache-Control", "private, no-store")
  program(@Param("id") id: string, @Req() req: { user?: { userId: string } }) {
    return this.service.program(id, req.user?.userId);
  }
  @Get("van-ban") documents(@Query() q: PortalQueryDto) {
    return this.service.documents(q);
  }
  @Post("dang-ky-thong-tin")
  @UseGuards(SubscriptionRateGuard)
  subscribe(@Body() body: SubscriptionDto) {
    return this.service.subscribe(body);
  }
}
@ApiTags("Admin - Cổng thông tin")
@ApiBearerAuth()
@Controller("admin/cong-thong-tin")
@UseGuards(JwtAuthGuard, AdminGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class PortalAdminController {
  constructor(private readonly service: PortalService) {}
  private actor(req: AdminRequest) {
    return {
      id: req.user.userId,
      username: req.user.username,
      ip: req.ip || "",
    };
  }
  @Get("van-ban") documents(@Query() q: PortalQueryDto) {
    return this.service.documents(q, true);
  }
  @Post("van-ban") create(
    @Body() body: PublicDocumentDto,
    @Req() req: AdminRequest,
  ) {
    return this.service.saveDocument(null, body, this.actor(req));
  }
  @Put("van-ban/:id") update(
    @Param("id") id: string,
    @Body() body: PublicDocumentDto,
    @Req() req: AdminRequest,
  ) {
    return this.service.saveDocument(id, body, this.actor(req));
  }
  @Delete("van-ban/:id") remove(
    @Param("id") id: string,
    @Query() query: PortalRevisionDto,
    @Req() req: AdminRequest,
  ) {
    return this.service.deleteDocument(id, query.revision, this.actor(req));
  }
  @Get("dang-ky") subscriptions(@Query() query: PortalQueryDto) {
    return this.service.subscriptions(query);
  }
  @Post("dang-ky/:id/da-lien-he") contact(
    @Param("id") id: string,
    @Body() body: PortalRevisionDto,
    @Req() req: AdminRequest,
  ) {
    return this.service.contact(id, body.revision, this.actor(req));
  }
}
