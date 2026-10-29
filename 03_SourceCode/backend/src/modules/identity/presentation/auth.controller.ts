import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { AuthService } from "../application/auth.service";
import { LoginDto } from "../application/login.dto";
import { ChangePasswordDto } from "../application/change-password.dto";
import { ForgotPasswordDto } from "../application/forgot-password.dto";
import { ResetPasswordDto } from "../application/reset-password.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

import { AuthRateLimitGuard } from "./auth-rate-limit.guard";

@UseGuards(AuthRateLimitGuard)
@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post("login")
  @ApiOperation({ summary: "Đăng nhập vào hệ thống (FR-AUT-01, FR-AUT-02)" })
  @ApiResponse({
    status: 200,
    description: "Đăng nhập thành công, trả về JWT token.",
  })
  @ApiResponse({
    status: 401,
    description: "Sai thông tin hoặc tài khoản đang bị khóa.",
  })
  async login(@Body() loginDto: LoginDto, @Request() req) {
    return this.authService.login(loginDto, req.ip);
  }

  @Get("password-policy")
  passwordPolicy() {
    return this.authService.passwordPolicy();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get("profile")
  @ApiOperation({ summary: "Lấy thông tin tài khoản đang đăng nhập từ CSDL" })
  @ApiResponse({
    status: 200,
    description: "Trả về thông tin chi tiết của người dùng.",
  })
  @ApiResponse({
    status: 401,
    description: "Không có token hoặc token hết hạn (30 phút).",
  })
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Đổi mật khẩu khi đã đăng nhập (FR-AUT-07)" })
  @ApiResponse({ status: 200, description: "Đổi mật khẩu thành công." })
  @ApiResponse({
    status: 400,
    description: "Mật khẩu cũ sai hoặc mật khẩu mới không hợp lệ.",
  })
  @ApiResponse({
    status: 401,
    description: "Chưa đăng nhập hoặc token hết hạn.",
  })
  async changePassword(@Request() req, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(
      req.user.userId,
      req.user.username,
      dto,
    );
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Yêu cầu đặt lại mật khẩu qua Email (FR-AUT-05)" })
  @ApiResponse({
    status: 200,
    description:
      "Luôn trả về thông báo trung tính dù email có tồn tại hay không.",
  })
  async forgotPassword(@Request() req, @Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto, req.ip);
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Đặt lại mật khẩu mới bằng Token (FR-AUT-05)" })
  @ApiResponse({ status: 200, description: "Đặt lại mật khẩu thành công." })
  @ApiResponse({
    status: 400,
    description: "Token không hợp lệ, đã dùng hoặc đã quá hạn 30 phút.",
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Đăng xuất khỏi hệ thống (FR-AUT-06)" })
  @ApiResponse({ status: 200, description: "Đăng xuất thành công." })
  async logout(@Request() req) {
    return this.authService.logout(req.user.userId, req.user.sessionId);
  }
}
 
