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
export class CourseQueryDto {
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
  search?: string;
  @ApiPropertyOptional({ enum: ["ALL", "ACTIVE", "INACTIVE", "RETIRED"] })
  @IsOptional()
  @IsIn(["ALL", "ACTIVE", "INACTIVE", "RETIRED"])
  status?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d{0,19}$/)
  unitId?: string;
}
export class CourseVersionDto {
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(255)
  courseName: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(255)
  englishName?: string;
  @ApiProperty({ minimum: 0.01, maximum: 999.99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999.99)
  credits: number;
  @ApiProperty({ minimum: 0, maximum: 65535 })
  @IsInt()
  @Min(0)
  @Max(65535)
  theoryHours: number;
  @ApiProperty({ minimum: 0, maximum: 65535 })
  @IsInt()
  @Min(0)
  @Max(65535)
  practiceHours: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(15000)
  description?: string;
  @ApiProperty({ example: "2026-10-30" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  effectiveFrom: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  effectiveTo?: string;
}
export class CreateCourseDto extends CourseVersionDto {
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(50)
  courseCode: string;
  @ApiProperty() @IsString() @Matches(/^[1-9]\d{0,19}$/) unitId: string;
}
export class ReviseCourseDto extends CourseVersionDto {
  @ApiProperty({ description: "ID phiên bản mới nhất đang xem" })
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,19})$/)
  expectedLatestVersionId: string;
}
export class CourseStatusDto {
  @ApiProperty({ enum: ["ACTIVE", "INACTIVE"] })
  @IsIn(["ACTIVE", "INACTIVE"])
  status: string;
  @ApiProperty({ enum: ["ACTIVE", "INACTIVE"] })
  @IsIn(["ACTIVE", "INACTIVE"])
  expectedStatus: string;
}
