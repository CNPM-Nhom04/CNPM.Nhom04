import { Transform, Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import {
  Equals,
  IsBoolean,
  IsOptional,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { AdminListQueryDto } from "../../admin/application/admin.dto";
const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
export class StudentClassQueryDto extends AdminListQueryDto {
  @IsOptional() @IsIn(["ALL", "ACTIVE", "INACTIVE"]) status?: string;
}
export class CreateStudentClassDto {
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @Matches(/^[A-Za-z0-9_.-]{1,50}$/)
  code: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
  @ApiProperty() @IsString() @Matches(/^[1-9]\d{0,19}$/) trackId: string;
  @ApiProperty() @IsInt() @Min(1900) @Max(2200) admissionYear: number;
}
export class UpdateStudentClassDto {
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
  @ApiProperty() @IsIn(["ACTIVE", "INACTIVE"]) status: "ACTIVE" | "INACTIVE";
  @ApiProperty() @IsInt() @Min(1) @Max(2147483647) revision: number;
}
export class StudentClassRevisionDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  revision: number;
}
export class ConfirmStudentAccountsDto {
  @ApiProperty() @IsString() @Matches(/^[a-f0-9]{64}$/) previewHash: string;
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  classRevision: number;
}

export class LinkStudentAccountDto {
  @ApiProperty() @IsString() @Matches(/^[1-9]\d{0,19}$/) userId: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d{0,19}$/)
  studentId?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @Matches(/^[A-Za-z0-9_.-]{1,50}$/)
  studentCode?: string;
  @ApiProperty() @IsInt() @Min(1) @Max(2147483647) revision: number;
  @ApiProperty() @IsBoolean() @Equals(true) confirmed: boolean;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
