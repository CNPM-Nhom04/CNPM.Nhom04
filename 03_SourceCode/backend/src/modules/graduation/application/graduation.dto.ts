import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import {
  IsBoolean,
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
} from "class-validator";
const trim = ({ value }) => (typeof value === "string" ? value.trim() : value);
export class GraduationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(trim)
  searchTerm?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[1-9]\d{0,19}$/)
  educationLevelId?: string;
  @ApiPropertyOptional()
  @IsIn(["ALL", "DU_DIEN_KIEN", "CHUA_DU_DIEN_KIEN", "THIEU_THONG_TIN"])
  status = "ALL";
  @ApiPropertyOptional() @IsIn(["ALL", "ACTIVE", "ENDED"]) assignmentStatus =
    "ACTIVE";
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @ApiPropertyOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit =
    20;
}
export class GraduationPolicyDto {
  @ApiProperty() @IsInt() @Min(0) revision: number;
  @ApiProperty() @IsBoolean() requireGpa: boolean;
  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10)
  minimumGpa: number | null;
  @ApiProperty() @IsBoolean() requireLanguage: boolean;
  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(trim)
  languageRule: string | null;
  @ApiProperty() @IsBoolean() requireDefense: boolean;
  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(trim)
  otherRequirements: string | null;
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  @Matches(/\S/)
  @Transform(trim)
  reference: string;
}
export class GraduationEvidenceDto {
  @ApiProperty() @IsInt() @Min(0) revision: number;
  @ApiProperty() @IsInt() @Min(1) policyRevision: number;
  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10)
  gpa: number | null;
  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(trim)
  gpaReference: string | null;
  @ApiProperty() @IsIn(["UNKNOWN", "MET", "NOT_MET"]) languageState:
    "UNKNOWN" | "MET" | "NOT_MET";
  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(trim)
  languageReference: string | null;
  @ApiProperty({ nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  languageValidUntil: string | null;
  @ApiProperty() @IsBoolean() languageNoExpiry: boolean;
  @ApiProperty() @IsIn(["UNKNOWN", "MET", "NOT_MET"]) otherState:
    "UNKNOWN" | "MET" | "NOT_MET";
  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(trim)
  otherReference: string | null;
}
export class GraduationBatchDto {
  @ApiProperty() @Matches(/^[1-9]\d{0,19}$/) educationLevelId: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[1-9]\d{0,19}$/)
  afterId?: string;
  @ApiPropertyOptional() @IsInt() @Min(1) @Max(100) limit = 25;
}
export class GraduationHistoryDto {
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
}
