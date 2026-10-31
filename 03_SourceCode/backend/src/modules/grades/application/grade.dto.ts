import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
export class GradeQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(255)
  searchTerm?: string;
  @ApiPropertyOptional({
    enum: ["ALL", "PASSED", "FAILED", "INCOMPLETE", "EXEMPTED"],
  })
  @IsOptional()
  @IsIn(["ALL", "PASSED", "FAILED", "INCOMPLETE", "EXEMPTED"])
  resultStatus?: string;
  @ApiPropertyOptional({
    enum: ["ALL", "LEGACY", "DRAFT", "FINALIZED", "VOIDED"],
  })
  @IsOptional()
  @IsIn(["ALL", "LEGACY", "DRAFT", "FINALIZED", "VOIDED"])
  state?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d{0,19}$/)
  offeringId?: string;
}
export class GradeReasonDto {
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @MinLength(10)
  @MaxLength(1000)
  note: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(255)
  reference: string;
}
export class GradeScoresDto extends GradeReasonDto {
  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 10 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10)
  attendanceScore?: number | null;
  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 10 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10)
  midtermScore?: number | null;
  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 10 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10)
  examScore?: number | null;
}
export class CreateGradeDto extends GradeScoresDto {
  @ApiProperty() @IsString() @Matches(/^[1-9]\d{0,19}$/) registrationId: string;
}
export class UpdateGradeDto extends GradeScoresDto {
  @ApiProperty() @IsInt() @Min(0) @Max(4294967294) revision: number;
}
export class GradeActionDto extends GradeReasonDto {
  @ApiProperty() @IsInt() @Min(0) @Max(4294967294) revision: number;
}
export class LegacyGradeDto extends GradeActionDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(20)
  grade?: string | null;
  @ApiProperty({ enum: ["PASSED", "FAILED", "INCOMPLETE", "EXEMPTED"] })
  @IsIn(["PASSED", "FAILED", "INCOMPLETE", "EXEMPTED"])
  resultStatus: "PASSED" | "FAILED" | "INCOMPLETE" | "EXEMPTED";
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  passedDate?: string | null;
}
export class GradePolicyDto {
  @ApiProperty({
    description:
      "0 khi lớp chưa có quy tắc; dùng revision hiện tại nếu cập nhật",
  })
  @IsInt()
  @Min(0)
  @Max(4294967294)
  revision: number;
  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  attendanceWeight: number;
  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  midtermWeight: number;
  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  examWeight: number;
  @ApiProperty({ minimum: 0.01, maximum: 10 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10)
  passingScore: number;
  @ApiProperty({ enum: [0, 1, 2] })
  @IsInt()
  @Min(0)
  @Max(2)
  decimalPlaces: number;
  @ApiProperty({ enum: ["HALF_UP", "TRUNCATE"] })
  @IsIn(["HALF_UP", "TRUNCATE"])
  rounding: "HALF_UP" | "TRUNCATE";
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(255)
  reference: string;
}
