import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  CreateTopicDto,
  TopicDecisionDto,
  CreateSupervisorDto,
  TopicQueryDto,
} from "./thesis-topic.dto";
describe("Thesis topic request boundaries", () => {
  const valid = {
    assignmentId: "1",
    supervisorId: "2",
    title: "Actual proposal",
    description: "",
  };
  it("accepts identifiers, not editable student identity snapshots", async () => {
    expect(await validate(plainToInstance(CreateTopicDto, valid))).toHaveLength(
      0,
    );
  });
  it.each([
    { title: " " },
    { title: null },
    { title: "a".repeat(1001) },
    { assignmentId: 1 },
    { assignmentId: "0" },
    { supervisorId: "1 OR 1=1" },
    { supervisorId: null },
    { description: "x".repeat(15001) },
  ])("rejects invalid topic %j", async (extra) => {
    expect(
      (await validate(plainToInstance(CreateTopicDto, { ...valid, ...extra })))
        .length,
    ).toBeGreaterThan(0);
  });
  it.each([
    { revision: "0" },
    { revision: -1 },
    { note: "short" },
    { note: "          " },
    { reference: " " },
    { reference: null },
  ])("requires a real decision record %j", async (extra) => {
    const value = {
      revision: 0,
      note: "Verified actual documents",
      reference: "REAL-DOC",
      ...extra,
    };
    expect(
      (await validate(plainToInstance(TopicDecisionDto, value))).length,
    ).toBeGreaterThan(0);
  });
  it("allows blank optional supervisor qualifications without deriving eligibility", async () => {
    const value = {
      unitId: "1",
      code: "REAL-001",
      fullName: "Actual staff member",
      qualification: "",
    };
    expect(
      await validate(plainToInstance(CreateSupervisorDto, value)),
    ).toHaveLength(0);
  });
  it("rejects malformed optional email", async () => {
    const value = {
      unitId: "1",
      code: "REAL-001",
      fullName: "Actual staff member",
      email: "invalid",
    };
    expect(
      (await validate(plainToInstance(CreateSupervisorDto, value))).length,
    ).toBeGreaterThan(0);
  });
  it("rejects unbounded pagination", async () => {
    expect(
      (await validate(plainToInstance(TopicQueryDto, { limit: 101 }))).length,
    ).toBeGreaterThan(0);
  });
});
