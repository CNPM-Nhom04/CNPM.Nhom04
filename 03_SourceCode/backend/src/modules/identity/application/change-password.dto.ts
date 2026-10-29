import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { NewPasswordDto } from "./new-password.dto";
export class ChangePasswordDto extends NewPasswordDto {
  @ApiProperty({ description: "Mật khẩu hiện tại" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  oldPassword: string;
}
 
