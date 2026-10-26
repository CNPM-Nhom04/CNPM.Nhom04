import { IsString, IsNotEmpty, MinLength, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ChangePasswordDto {
  @ApiProperty({ example: "Demo@12345", description: "Mật khẩu hiện tại" })
  @IsString()
  @IsNotEmpty({ message: "Vui lòng nhập mật khẩu hiện tại" })
  oldPassword: string;

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
