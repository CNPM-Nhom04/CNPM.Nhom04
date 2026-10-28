import { IsString, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { NewPasswordDto } from "./new-password.dto";
export class ResetPasswordDto extends NewPasswordDto {
  @ApiProperty({ description: "Token nhận qua email" })
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i, {
    message: "Liên kết đặt lại mật khẩu không hợp lệ.",
  })
  token: string;
}
