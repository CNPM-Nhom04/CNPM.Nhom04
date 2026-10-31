import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
export class ComparisonOptionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  searchTerm?: string;
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @ApiPropertyOptional({ default: 30 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}
export class ComparisonDto {
  @ApiProperty() @Matches(/^[1-9]\d{0,19}$/) versionA: string;
  @ApiProperty() @Matches(/^[1-9]\d{0,19}$/) trackA: string;
  @ApiProperty() @Matches(/^[1-9]\d{0,19}$/) versionB: string;
  @ApiProperty() @Matches(/^[1-9]\d{0,19}$/) trackB: string;
}
