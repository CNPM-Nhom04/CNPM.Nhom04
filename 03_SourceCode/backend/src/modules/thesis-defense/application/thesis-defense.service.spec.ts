import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ThesisDefenseService } from "./thesis-defense.service";
import { DefenseActor, DefenseRepository } from "../domain/thesis-defense";
describe("ThesisDefenseService", () => {
  const repository = {
    recordResult: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };
  const service = new ThesisDefenseService(
    repository as unknown as DefenseRepository,
  );
  const actor: DefenseActor = {
    id: "1",
    username: "staff",
    ip: "127.0.0.1",
    isAdmin: false,
    canSchedule: true,
    canRecord: true,
  };
  beforeEach(() => jest.clearAllMocks());
  it("rejects IDs before querying", () => {
    expect(() => service.findById("1 OR 1=1", actor)).toThrow(
      BadRequestException,
    );
    expect(repository.findById).not.toHaveBeenCalled();
  });
  it("prevents approvers from scheduling when they only have result permissions", () => {
    expect(() =>
      service.create(
        {
          maHocVien: "HV1",
          tenDeTai: "Đề tài",
          ngayBaoVe: "2026-10-27",
          diaDiem: "A",
          chuTichHoidong: "B",
        },
        { ...actor, canSchedule: false },
      ),
    ).toThrow(ForbiddenException);
    expect(repository.create).not.toHaveBeenCalled();
  });
  it("keeps score zero and passes an ISO calendar date in the business timezone", () => {
    service.recordResult("1", { diemTrungBinh: 0 }, actor);
    expect(repository.recordResult).toHaveBeenCalledWith(
      "1",
      0,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      actor,
    );
  });
  it("denies result changes without result permission", () => {
    expect(() =>
      service.recordResult(
        "1",
        { diemTrungBinh: 8 },
        { ...actor, canRecord: false },
      ),
    ).toThrow(ForbiddenException);
  });
});
