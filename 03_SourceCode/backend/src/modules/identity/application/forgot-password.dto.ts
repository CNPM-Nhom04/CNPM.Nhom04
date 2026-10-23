import { IsEmail, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ForgotPasswordDto {
  @ApiProperty({
    example: "admin@example.edu.vn",
    description: "Email đã đăng ký của tài khoản",
  })
  @IsEmail({}, { message: "Định dạng email không hợp lệ" })
  @IsNotEmpty({ message: "Vui lòng nhập email" })
  email: string;
}
