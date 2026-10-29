import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ThesisDefenseService } from "./thesis-defense.service";
import { DefenseActor, DefenseRepository } from "../domain/thesis-defense";
describe("ThesisDefenseService", () => {
  const repository = {
    recordResult: jest.fn(),
    policy: jest.fn(),
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
    permissions: ["DEFENSE_READ", "DEFENSE_SCHEDULE", "DEFENSE_RESULT"],
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
          assignmentId: "1",
          diemDat: 6,
          eligibilityConfirmed: true,
          eligibilityNote: "Confirmed conditions",
          phanBien: "Reviewer",
          thuKy: "Secretary",
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

describe("Defense schedule business checks", () => {
  const repo = { create: jest.fn(), policy: jest.fn() };
  const service = new ThesisDefenseService(
    repo as unknown as DefenseRepository,
  );
  const actor: DefenseActor = {
    id: "2",
    username: "staff",
    permissions: ["DEFENSE_READ", "DEFENSE_SCHEDULE"],
    canSchedule: true,
    canRecord: false,
    ip: "",
  };
  const valid = () => ({
    maHocVien: "SV001",
    assignmentId: "1",
    tenDeTai: "Actual title",
    ngayBaoVe: service.today(),
    diaDiem: "Room",
    chuTichHoidong: "Chair",
    phanBien: "Reviewer",
    thuKy: "Secretary",
    diemDat: 6.25,
    eligibilityConfirmed: true,
    eligibilityNote: "Verified against actual documents",
  });
  beforeEach(() => jest.clearAllMocks());
  it("does not invent a threshold when SQL has none", async () => {
    repo.policy.mockResolvedValue({ passingScore: null });
    expect((await service.policy()).passingScore).toBeNull();
  });
  it("rejects new schedules in the past", () => {
    expect(() =>
      service.create({ ...valid(), ngayBaoVe: "2000-01-01" }, actor),
    ).toThrow(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("requires explicit eligibility evidence", () => {
    expect(() =>
      service.create({ ...valid(), eligibilityConfirmed: false }, actor),
    ).toThrow(BadRequestException);
  });
  it("rejects duplicate council names despite case/spacing", () => {
    expect(() =>
      service.create({ ...valid(), phanBien: "  CHAIR  " }, actor),
    ).toThrow(BadRequestException);
  });
  it("preserves the explicitly supplied threshold", () => {
    const input = valid();
    service.create(input, actor);
    expect(repo.create).toHaveBeenCalledWith(input, actor);
    expect(input.diemDat).toBe(6.25);
  });
});
