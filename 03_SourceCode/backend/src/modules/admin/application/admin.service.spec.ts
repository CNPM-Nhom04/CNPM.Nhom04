import { BadRequestException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { Readable } from "stream";
import { Workbook } from "exceljs";
import { AdminRepository, SETTING_DEFAULTS } from "../domain/admin.repository";
import { AuthSecurityRepository } from "../../identity/domain/auth-security.repository";
import { AdminService } from "./admin.service";

describe("AdminService", () => {
  const actor = { id: "1", username: "admin", ip: "127.0.0.1" };
  let service: AdminService;
  let repository;
  beforeEach(() => {
    repository = {
      createUser: jest.fn().mockResolvedValue({ id: "10" }),
      saveSettings: jest.fn(),
      listAudit: jest.fn(),
    };
    service = new AdminService(
      repository as AdminRepository,
      {
        policy: jest.fn().mockResolvedValue({ passwordMinLength: 10 }),
      } as unknown as AuthSecurityRepository,
    );
  });
  it("hashes the password and keeps credentials out of the public profile", async () => {
    await service.createUser(
      {
        username: "new-admin",
        password: "NewPassword123!",
        confirmPassword: "NewPassword123!",
        scopeMode: "KEEP",
        hoTen: "Test",
        email: "test@example.com",
        donViId: "1",
        vaiTro: "QUAN_TRI",
        trangThai: true,
      },
      actor,
    );
    const [profile, username, hash] = repository.createUser.mock.calls[0];
    expect(profile).not.toHaveProperty("password");
    expect(username).toBe("new-admin");
    expect(hash).not.toBe("NewPassword123!");
    expect(await bcrypt.compare("NewPassword123!", hash)).toBe(true);
  });
  it("rejects passwords exceeding bcrypt's byte limit", async () => {
    await expect(
      service.createUser(
        {
          username: "test",
          password: "ế".repeat(30),
          confirmPassword: "ế".repeat(30),
          scopeMode: "KEEP",
          hoTen: "Test",
          email: "test@example.com",
          donViId: "1",
          vaiTro: "GIANG_VIEN",
          trangThai: true,
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createUser).not.toHaveBeenCalled();
  });
  it("rejects a zero semester credit limit before persisting", () => {
    expect(() =>
      service.saveSettings({ ...SETTING_DEFAULTS, maxTinChiHocKy: "0" }, actor),
    ).toThrow(BadRequestException);
    expect(repository.saveSettings).not.toHaveBeenCalled();
  });
  it("rejects category IDs that could inject SQL", async () => {
    await expect(
      service.deleteCategory("KHOA_QUAN_LY:1 OR 1=1", actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it("exports all matching audit rows as text-safe XLSX", async () => {
    repository.listAudit.mockResolvedValue({
      data: [
        {
          thoiGian: "2026-10-27T10:00:00.000Z",
          nguoiThucHien: "=1+1",
          vaiTro: "Quản trị viên",
          hanhDong: "CREATE",
          moTa: "Thêm tài khoản",
          diaChiIP: "127.0.0.1",
        },
      ],
    });
    const query = {
      searchTerm: "Thêm",
      selectedAction: "CREATE",
      page: 1,
      limit: 20,
    };
    const workbook = new Workbook();
    await workbook.xlsx.read(Readable.from([await service.exportAudit(query)]));
    expect(repository.listAudit).toHaveBeenCalledWith(query, true);
    expect(workbook.worksheets[0].getCell("B2").value).toBe("=1+1");
    expect(workbook.worksheets[0].getCell("B2").type).toBe(3);
    expect(workbook.worksheets[0].getCell("E2").value).toBe("Thêm tài khoản");
  });
});
 
