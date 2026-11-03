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
const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
export class MajorsQueryDto extends AdminListQueryDto {
  @ApiPropertyOptional({ enum: ["ALL", "ACTIVE", "INACTIVE"] })
  @IsOptional()
  @IsIn(["ALL", "ACTIVE", "INACTIVE"])
  status?: "ALL" | "ACTIVE" | "INACTIVE";
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d{0,19}$/)
  unitId?: string;
}
export class MajorInputDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @Transform(trim)
  @Matches(/^[A-Za-z0-9_-]{1,50}$/)
  majorCode: string;
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(255)
  majorName: string;
  @ApiProperty()
  @IsString()
  @Matches(/^[1-9]\d{0,19}$/)
  unitId: string;
  @ApiProperty({ enum: ["ACTIVE", "INACTIVE"] })
  @IsIn(["ACTIVE", "INACTIVE"])
  status: "ACTIVE" | "INACTIVE";
}
export class MajorVersionDto {
  @ApiProperty({
    description:
      "updatedAt nhận từ API, giữ nguyên chuỗi để tránh ghi đè thay đổi mới",
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/)
  expectedUpdatedAt: string;
}
export class UpdateMajorDto extends MajorInputDto {
  @ApiProperty({ description: "updatedAt nhận từ API" })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/)
  expectedUpdatedAt: string;
}

export class CommitMajorImportDto {
  @ApiProperty({ description: "fileHash nhận từ bước kiểm tra file" })
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  previewHash: string;
}
