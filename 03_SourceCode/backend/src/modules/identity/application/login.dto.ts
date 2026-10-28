import { Transform } from "class-transformer";
import { IsString, IsNotEmpty, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
export class LoginDto {
  @ApiProperty({ description: "Tên đăng nhập hoặc email" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  identifier: string;
  @ApiProperty({ description: "Mật khẩu" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  password: string;
}
