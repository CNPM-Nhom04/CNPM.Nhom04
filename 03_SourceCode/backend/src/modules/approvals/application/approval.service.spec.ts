import { ApprovalService } from "./approval.service";
import { ApprovalRepository } from "../domain/approval";
import { ProgramActor, ProgramRepository } from "../../programs/domain/program";
import { ProgramService } from "../../programs/application/program.service";
describe("Approval cycle isolation", () => {
  const actor: ProgramActor = {
    id: "9",
    username: "reviewer",
    permissions: ["PROGRAM_APPROVE"],
    ip: "",
  };
  function setup(status = "PENDING", requesterId = "2") {
    const repository = {
      detail: jest.fn().mockResolvedValue({
        id: "12",
        versionId: "4",
        status,
        requesterId,
        documents: [],
      }),
    };
    const programs = {
      detail: jest
        .fn()
        .mockResolvedValue({ id: "4", status: "SUBMITTED", revision: 7 }),
      review: jest.fn(),
      startReview: jest.fn(),
    };
    const upload = { upload: jest.fn() };
    const service = new ApprovalService(
      repository as unknown as ApprovalRepository,
      programs as unknown as ProgramRepository,
      upload as unknown as ProgramService,
    );
    return { service, repository, programs, upload };
  }
  it("does not enable review actions for requesters even with permission", async () => {
    const { service } = setup("PENDING", "9");
    expect((await service.detail("12", actor)).permissions).toEqual({
      canStart: false,
      canDecide: false,
      canUpload: false,
    });
  });
  it("closed request does not inherit actions from a newly resubmitted version", async () => {
    const { service, upload } = setup("RETURNED");
    expect((await service.detail("12", actor)).permissions.canDecide).toBe(
      false,
    );
    await expect(service.upload("12", undefined, actor)).rejects.toMatchObject({
      status: 409,
    });
    expect(upload.upload).not.toHaveBeenCalled();
  });
  it("binds the specific request identity into the transactional decision", async () => {
    const { service, programs } = setup();
    const input = { revision: 7, requestRevision: 3 } as never;
    await service.decide("12", input, actor);
    expect(programs.review).toHaveBeenCalledWith(
      "4",
      { revision: 7, requestRevision: 3, requestId: "12" },
      7,
      actor,
    );
  });
  it("validates IDs before querying SQL", async () => {
    const { service, repository } = setup();
    await expect(service.detail("1 OR 1=1", actor)).rejects.toMatchObject({
      status: 400,
    });
    expect(repository.detail).not.toHaveBeenCalled();
  });
});
