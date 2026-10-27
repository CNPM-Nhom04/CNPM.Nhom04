import { BadRequestException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { Workbook } from "exceljs";
import {
  Actor,
  AdminRepository,
  SETTING_DEFAULTS,
} from "../domain/admin.repository";
import {
  AdminListQueryDto,
  AuditQueryDto,
  CategoriesQueryDto,
  CategoryInputDto,
  CreateUserDto,
  SettingsDto,
  UserInputDto,
  UsersQueryDto,
} from "./admin.dto";

@Injectable()
export class AdminService {
  constructor(private readonly repository: AdminRepository) {}

  listUsers(query: UsersQueryDto) {
    return this.repository.listUsers(query);
  }
  userOptions() {
    return this.repository.userOptions();
  }
  async createUser(input: CreateUserDto, actor: Actor) {
    if (Buffer.byteLength(input.password, "utf8") > 72)
      throw new BadRequestException("Mật khẩu tối đa 72 byte UTF-8.");
    const { username, password, ...profile } = input;
    return this.repository.createUser(
      profile,
      username,
      await bcrypt.hash(password, 12),
      actor,
    );
  }
  private userId(id: string) {
    if (!/^[1-9]\d{0,19}$/.test(id))
      throw new BadRequestException("ID tài khoản không hợp lệ.");
  }
  updateUser(id: string, input: UserInputDto, actor: Actor) {
    this.userId(id);
    return this.repository.updateUser(id, input, actor);
  }
  async deleteUser(id: string, actor: Actor) {
    this.userId(id);
    await this.repository.deleteUser(id, actor);
    return { message: "Đã xóa tài khoản." };
  }
  listCategories(query: CategoriesQueryDto) {
    return this.repository.listCategories(query);
  }
  private categoryId(id: string) {
    if (!/^(KHOA_QUAN_LY|BAC_DAO_TAO|KHOI_KIEN_THUC):[1-9]\d{0,19}$/.test(id)) {
      throw new BadRequestException("ID danh mục không hợp lệ.");
    }
  }
  saveCategory(id: string | null, input: CategoryInputDto, actor: Actor) {
    if (id) this.categoryId(id);
    return this.repository.saveCategory(id, input, actor);
  }
  async deleteCategory(id: string, actor: Actor) {
    this.categoryId(id);
    await this.repository.deleteCategory(id, actor);
    return { message: "Đã xóa danh mục." };
  }
  getSettings() {
    return this.repository.getSettings();
  }
  saveSettings(settings: SettingsDto, actor: Actor) {
    for (const key of [
      "maxTinChiHocKy",
      "minTinChiTotNghiepThacSi",
      "minTinChiTotNghiepTienSi",
      "thoiHanDangKyToiDa",
    ]) {
      const upper =
        key === "thoiHanDangKyToiDa"
          ? 365
          : key === "maxTinChiHocKy"
            ? 100
            : 999;
      if (Number(settings[key]) < 1 || Number(settings[key]) > upper)
        throw new BadRequestException(`${key} phải từ 1 đến ${upper}.`);
    }
    return this.repository.saveSettings(settings, actor);
  }
  resetSettings(actor: Actor) {
    return this.repository.saveSettings({ ...SETTING_DEFAULTS }, actor);
  }
  listAudit(query: AuditQueryDto) {
    return this.repository.listAudit(query);
  }

  async exportAudit(query: AuditQueryDto): Promise<Buffer> {
    const { data } = await this.repository.listAudit(query, true);
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet("Nhật ký hệ thống");
    sheet.columns = [
      { header: "Thời gian (UTC)", key: "thoiGian", width: 28 },
      { header: "Người thực hiện", key: "nguoiThucHien", width: 30 },
      { header: "Vai trò", key: "vaiTro", width: 25 },
      { header: "Hành động", key: "hanhDong", width: 20 },
      { header: "Nội dung", key: "moTa", width: 70 },
      { header: "Địa chỉ IP", key: "diaChiIP", width: 25 },
    ];
    sheet.addRows(data);
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = "A1:F1";
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
