import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
import { AdminListQueryDto } from "./admin.dto";
import { MajorVersionDto } from "./major.dto";
const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
export class FacultyQueryDto extends AdminListQueryDto {
  @ApiPropertyOptional({ enum: ["ALL", "ACTIVE", "INACTIVE"] })
  @IsOptional()
  @IsIn(["ALL", "ACTIVE", "INACTIVE"])
  status?: string;
}
export class FacultyInputDto {
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @Matches(/^[A-Za-z0-9_-]{1,50}$/)
  code: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @MaxLength(1000)
  description: string;
  @ApiProperty({ enum: ["ACTIVE", "INACTIVE"] })
  @IsIn(["ACTIVE", "INACTIVE"])
  status: "ACTIVE" | "INACTIVE";
}
export class UpdateFacultyDto extends FacultyInputDto {
  @ApiProperty({ description: "updatedAt của bản đang xem" })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/)
  expectedUpdatedAt: string;
}
export class FacultyVersionDto extends MajorVersionDto {}
