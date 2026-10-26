import { IsString, IsNotEmpty, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({
    example: "admin hoặc admin@example.edu",
    description: "Tên đăng nhập hoặc Email",
  })
  @IsString()
  @IsNotEmpty({ message: "Tên đăng nhập hoặc Email không được để trống" })
  identifier: string;

  @ApiProperty({ example: "Demo@12345", description: "Mật khẩu" })
  @IsString()
  @IsNotEmpty({ message: "Mật khẩu không được để trống" })
  @MinLength(6, { message: "Mật khẩu phải có ít nhất 6 ký tự" })
  password: string;
}
