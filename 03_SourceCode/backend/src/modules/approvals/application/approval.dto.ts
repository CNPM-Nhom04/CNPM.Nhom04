import { ApiProperty, ApiPropertyOptional, OmitType } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { ReviewDto } from "../../programs/application/program.dto";
export class ApprovalQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  searchTerm?: string;
  @ApiPropertyOptional({ default: "PENDING" })
  @IsIn(["ALL", "PENDING", "APPROVED", "RETURNED", "CANCELLED"])
  status: "ALL" | "PENDING" | "APPROVED" | "RETURNED" | "CANCELLED" = "PENDING";
  @ApiPropertyOptional({ default: "ALL" })
  @IsIn(["ALL", "NOT_STARTED", "STARTED", "MINE"])
  reviewState: "ALL" | "NOT_STARTED" | "STARTED" | "MINE" = "ALL";
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[1-9]\d{0,19}$/)
  versionId?: string;
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
}
export class ApprovalRevisionDto {
  @ApiProperty() @IsInt() @Min(0) requestRevision: number;
}
export class ApprovalDecisionDto extends OmitType(ReviewDto, [
  "requestId",
  "requestRevision",
] as const) {
  @ApiProperty() @IsInt() @Min(0) requestRevision: number;
}
