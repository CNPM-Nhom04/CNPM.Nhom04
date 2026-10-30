import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { TOPIC_STATUSES } from "../domain/thesis-topic";
const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
export class TopicQueryDto {
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
  @ApiPropertyOptional({ enum: ["ALL", ...TOPIC_STATUSES] })
  @IsOptional()
  @IsIn(["ALL", ...TOPIC_STATUSES])
  selectedStatus?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d{0,19}$/)
  unitId?: string;
  @ApiPropertyOptional({ enum: ["ALL", "ACTIVE", "INACTIVE"] })
  @IsOptional()
  @IsIn(["ALL", "ACTIVE", "INACTIVE"])
  status?: string;
}
export class TopicContentDto {
  @ApiProperty() @IsString() @Matches(/^[1-9]\d{0,19}$/) supervisorId: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(1000)
  title: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(15000)
  description?: string;
}
export class CreateTopicDto extends TopicContentDto {
  @ApiProperty() @IsString() @Matches(/^[1-9]\d{0,19}$/) assignmentId: string;
}
export class RevisionDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(4294967294)
  revision: number;
}
export class UpdateTopicDto extends TopicContentDto {
  @ApiProperty() @IsInt() @Min(0) @Max(4294967294) revision: number;
}
export class TopicNoteDto extends RevisionDto {
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @MinLength(10)
  @MaxLength(1000)
  note: string;
}
export class TopicDecisionDto extends TopicNoteDto {
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(255)
  reference: string;
}
export class CreateSupervisorDto {
  @ApiProperty() @IsString() @Matches(/^[1-9]\d{0,19}$/) unitId: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(50)
  code: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(255)
  fullName: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(255)
  institution?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(255)
  qualification?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email?: string;
}
export class SupervisorStatusDto {
  @ApiProperty({ enum: ["ACTIVE", "INACTIVE"] })
  @IsIn(["ACTIVE", "INACTIVE"])
  status: string;
  @ApiProperty({ enum: ["ACTIVE", "INACTIVE"] })
  @IsIn(["ACTIVE", "INACTIVE"])
  expectedStatus: string;
}
