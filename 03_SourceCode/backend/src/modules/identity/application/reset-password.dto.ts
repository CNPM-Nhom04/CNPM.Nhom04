import { IsString, IsNotEmpty, MinLength, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ResetPasswordDto {
  @ApiProperty({
    example: "d4f5e6a7b8c9...",
    description: "Chuỗi token nhận được từ đường link đặt lại mật khẩu",
  })
  @IsString()
  @IsNotEmpty({ message: "Token không được để trống" })
  token: string;

  @ApiProperty({
    example: "NewPass1234!",
    description: "Mật khẩu mới (tối thiểu 10 ký tự, gồm chữ và số)",
  })
  @IsString()
  @IsNotEmpty({ message: "Vui lòng nhập mật khẩu mới" })
  @MinLength(10, { message: "Mật khẩu mới phải có ít nhất 10 ký tự" })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: "Mật khẩu mới phải bao gồm cả chữ cái và chữ số",
  })
  newPassword: string;
}
