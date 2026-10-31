import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { STATUS_LABELS } from "../domain/program";
const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
export class ProgramQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(trim)
  searchTerm?: string;
  @ApiPropertyOptional({ enum: ["ALL", ...Object.keys(STATUS_LABELS)] })
  @IsOptional()
  @IsIn(["ALL", ...Object.keys(STATUS_LABELS)])
  selectedStatus?: string;
}
export class ProgramInputDto {
  @ApiPropertyOptional({ default: "v1" })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @Matches(/^[A-Za-z0-9_.-]{1,50}$/)
  maPhienBan?: string;

  @ApiProperty()
  @IsString()
  @Transform(trim)
  @Matches(/^[A-Za-z0-9_-]{1,50}$/)
  maCTDT: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(255)
  tenCTDT: string;
  @ApiProperty() @IsString() @MaxLength(255) tenTiengAnh = "";
  @ApiProperty()
  @IsString()
  @Matches(/^[1-9]\d{0,19}$/)
  educationLevelId: string;
  @ApiProperty() @IsString() @Matches(/^[1-9]\d{0,19}$/) managingUnitId: string;
  @ApiProperty() @IsString() @Matches(/^[1-9]\d{0,19}$/) majorId: string;
  @ApiProperty()
  @IsIn(["CHINH_QUY", "VUA_LAM_VUA_HOC", "LIEN_KET"])
  hinhThucDaoTao = "CHINH_QUY";
  @ApiProperty() @IsString() @MaxLength(150) thoiGianDaoTao = "";
  @ApiProperty({ example: "2026 - 2028" })
  @IsString()
  @Matches(/^\d{4}\s*-\s*\d{4}$/)
  khoaTuyenSinh: string;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(9999)
  tongTinChiYeuCau: number;
  @ApiPropertyOptional() @IsString() @MaxLength(500) chuanDauRaTiengAnh = "";
  @ApiPropertyOptional() @IsString() @MaxLength(500) chuanDauRaTinHoc = "";
  @ApiPropertyOptional() @IsString() @MaxLength(150) soQuyetDinhBanHanh = "";
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  ngayBanHanh?: string;
  @ApiPropertyOptional() @IsString() @MaxLength(10000) moTa = "";
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) revision?: number;
}
export class GroupInputDto {
  @ApiProperty() @IsString() @Matches(/^[1-9]\d{0,19}$/) id: string;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999)
  minimumCredits: number;
}
export class CourseInputDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[1-9]\d{0,19}$/)
  courseVersionId: string;
  @ApiProperty() @IsString() @Matches(/^[1-9]\d{0,19}$/) groupId: string;
  @ApiProperty() @IsIn(["REQUIRED", "ELECTIVE"]) requirementType:
    "REQUIRED" | "ELECTIVE";
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  semester: number | null;
}
export class TrackInputDto {
  @ApiProperty() @IsString() @Matches(/^[1-9]\d{0,19}$/) id: string;
  @ApiProperty({ type: [GroupInputDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((item) => item.id)
  @ValidateNested({ each: true })
  @Type(() => GroupInputDto)
  groups: GroupInputDto[];
  @ApiProperty({ type: [CourseInputDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique((item) => item.courseVersionId)
  @ValidateNested({ each: true })
  @Type(() => CourseInputDto)
  courses: CourseInputDto[];
}
export class CurriculumDto {
  @ApiProperty() @IsInt() @Min(0) revision: number;
  @ApiProperty({ type: [TrackInputDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique((item) => item.id)
  @ValidateNested({ each: true })
  @Type(() => TrackInputDto)
  tracks: TrackInputDto[];
}
export class RevisionDto {
  @ApiProperty() @IsInt() @Min(0) revision: number;
}
export class ReviewDto extends RevisionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[1-9]\d{0,19}$/)
  requestId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  requestRevision?: number;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(255)
  hoiDongThamDinh: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(255)
  chuTichHoidong: string;
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(255)
  thuKhao: string;
  @ApiProperty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  ngayHop: string;
  @ApiProperty()
  @IsIn(["DAT_DIEU_KIEN", "YEU_CAU_SUA_DOI", "KHONG_DAT"])
  ketLuan: "DAT_DIEU_KIEN" | "YEU_CAU_SUA_DOI" | "KHONG_DAT";
  @ApiPropertyOptional() @IsString() @MaxLength(10000) yKienDongGop = "";
  @ApiPropertyOptional() @IsString() @MaxLength(150) soBienBan = "";
}
