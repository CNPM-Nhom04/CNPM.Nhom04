import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
export class NewPasswordDto {
  @ApiProperty({
    description:
      "Mật khẩu mới có chữ và số; tối thiểu theo cấu hình hệ thống, tối đa 72 byte UTF-8",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: "Mật khẩu mới phải có chữ và số.",
  })
  newPassword: string;

  @ApiProperty({ description: "Nhập lại mật khẩu mới" })
  @IsString()
  @IsNotEmpty({ message: "Vui lòng xác nhận mật khẩu." })
  @MaxLength(72)
  confirmPassword: string;
}
 
