import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  Equals,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
export class PortalQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 12;
  @IsOptional() @IsString() @Transform(trim) @MaxLength(255) search?: string;
  @IsOptional() @Matches(/^[1-9]\d{0,19}$/) levelId?: string;
  @IsOptional()
  @IsIn(["ALL", "REGULATION", "ADMISSION", "GUIDE"])
  category?: string;
  @IsOptional()
  @IsIn(["ALL", "NEW", "CONTACTED", "DRAFT", "PUBLISHED"])
  status?: string;
}
export class SubscriptionDto {
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(150)
  familyName: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(100)
  givenName: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsEmail()
  @MaxLength(255)
  email: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @Matches(/^\+?[0-9][0-9 .()-]{7,28}[0-9]$/)
  phone: string;
  @ApiProperty() @Matches(/^[1-9]\d{0,19}$/) levelId: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[1-9]\d{0,19}$/)
  majorId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(["MALE", "FEMALE", "OTHER"])
  gender?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(255)
  previousMajor?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  graduationYear?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(2000)
  message?: string;
  @ApiProperty() @IsBoolean() @Equals(true) consent: boolean;
  @IsOptional() @IsString() @Matches(/^$/) website?: string;
}
export class PublicDocumentDto {
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(255)
  title: string;
  @ApiProperty() @IsIn(["REGULATION", "ADMISSION", "GUIDE"]) category: string;
  @ApiProperty() @IsString() @Transform(trim) @MaxLength(2000) summary: string;
  @ApiProperty()
  @IsUrl({ protocols: ["https"], require_protocol: true, require_tld: true })
  @MaxLength(2000)
  documentUrl: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(150)
  referenceNumber?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  issuedOn?: string;
  @ApiProperty() @IsIn(["DRAFT", "PUBLISHED"]) status: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  revision?: number;
}
export class PortalRevisionDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) revision: number;
}
