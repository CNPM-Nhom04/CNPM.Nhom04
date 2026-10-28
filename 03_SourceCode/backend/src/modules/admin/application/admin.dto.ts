import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  CATEGORY_TYPES,
  CategoryType,
  ROLE_CODES,
  SETTING_DEFAULTS,
  USER_ROLES,
  UserRole,
} from "../domain/admin.repository";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class AdminListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(trim)
  searchTerm?: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
export class UsersQueryDto extends AdminListQueryDto {
  @ApiPropertyOptional({ enum: ["ALL", ...USER_ROLES] })
  @IsOptional()
  @IsIn(["ALL", ...USER_ROLES])
  selectedRole?: string;
}
export class CategoriesQueryDto extends AdminListQueryDto {
  @ApiPropertyOptional({ enum: ["ALL", ...CATEGORY_TYPES] })
  @IsOptional()
  @IsIn(["ALL", ...CATEGORY_TYPES])
  selectedType?: string;
}
export class AuditQueryDto extends AdminListQueryDto {
  @ApiPropertyOptional({
    description: "ALL hoặc mã hành động",
    example: "CREATE",
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Z_]+$/)
  selectedAction?: string;
}
export class UserInputDto {
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(255)
  hoTen: string;
  @ApiProperty()
  @Transform(trim)
  @IsEmail()
  @MaxLength(255)
  email: string;
  @ApiProperty({ description: "ID đơn vị trong database" })
  @IsString()
  @Matches(/^[1-9]\d{0,19}$/)
  donViId: string;
  @ApiProperty({ enum: USER_ROLES })
  @IsIn(USER_ROLES)
  vaiTro: UserRole;
  @ApiProperty({ default: true })
  @IsBoolean()
  trangThai = true;
}
export class CreateUserDto extends UserInputDto {
  @ApiProperty({ minLength: 3, maxLength: 100 })
  @IsString()
  @Transform(trim)
  @Matches(/^[a-zA-Z0-9_.@-]{3,100}$/)
  username: string;
  @ApiProperty({ minLength: 10, maxLength: 72, writeOnly: true })
  @IsString()
  @MinLength(10)
  @MaxLength(72)
  password: string;
}
export class CategoryInputDto {
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  maDanhMuc: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(150)
  tenDanhMuc: string;
  @ApiProperty({ enum: CATEGORY_TYPES })
  @IsIn(CATEGORY_TYPES)
  loaiDanhMuc: CategoryType;
  @ApiProperty({ default: "" })
  @IsString()
  @MaxLength(1000)
  moTa = "";
  @ApiProperty({ default: true })
  @IsBoolean()
  trangThai = true;
}
export class SettingsDto {
  @ApiProperty({ example: "18" })
  @IsNumberString({ no_symbols: true })
  @MaxLength(3)
  maxTinChiHocKy: string;
  @ApiProperty({ example: "60" })
  @IsNumberString({ no_symbols: true })
  @MaxLength(3)
  minTinChiTotNghiepThacSi: string;
  @ApiProperty({ example: "90" })
  @IsNumberString({ no_symbols: true })
  @MaxLength(3)
  minTinChiTotNghiepTienSi: string;
  @ApiProperty({ example: "5.5" })
  @IsString()
  @Matches(/^(?:[0-9](?:\.\d{1,2})?|10(?:\.0{1,2})?)$/)
  diemDatHocPhan: string;
  @ApiProperty({ example: "14" })
  @IsNumberString({ no_symbols: true })
  @MaxLength(3)
  thoiHanDangKyToiDa: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(255)
  ngoaiNguBatBuocThacSi: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(255)
  ngoaiNguBatBuocTienSi: string;
}
