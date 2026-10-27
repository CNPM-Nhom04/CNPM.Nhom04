import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { DEFENSE_STATUSES } from "../domain/thesis-defense";
const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class DefenseQueryDto {
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
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(trim)
  searchTerm?: string;
  @ApiPropertyOptional({ enum: ["ALL", ...DEFENSE_STATUSES] })
  @IsOptional()
  @IsIn(["ALL", ...DEFENSE_STATUSES])
  selectedStatus?: string;
}
export class CreateDefenseDto {
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(50)
  maHocVien: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(1000)
  tenDeTai: string;
  @ApiProperty({ example: "2026-10-27" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  ngayBaoVe: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(255)
  diaDiem: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(255)
  chuTichHoidong: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(255)
  phanBien?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(255)
  thuKy?: string;
}
export class RecordDefenseResultDto {
  @ApiProperty({ minimum: 0, maximum: 10, example: 8.6 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10)
  diemTrungBinh: number;
}
