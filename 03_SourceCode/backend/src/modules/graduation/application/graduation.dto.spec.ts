import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  GraduationBatchDto,
  GraduationEvidenceDto,
  GraduationPolicyDto,
  GraduationQueryDto,
} from "./graduation.dto";
describe("Graduation boundary validation", () => {
  it("requires explicit policy booleans and official reference", async () => {
    expect((await validate(new GraduationPolicyDto())).length).toBeGreaterThan(
      0,
    );
    expect(
      await validate(
        plainToInstance(GraduationPolicyDto, {
          revision: 0,
          requireGpa: false,
          minimumGpa: null,
          requireLanguage: false,
          languageRule: null,
          requireDefense: false,
          otherRequirements: null,
          reference: "QD",
        }),
      ),
    ).toHaveLength(0);
  });
  it.each([0, "7.0", true, 10.01])(
    "does not accept malformed official GPA %p",
    async (v) => {
      const base = {
        revision: 0,
        policyRevision: 1,
        gpa: v,
        gpaReference: "Transcript",
        languageState: "UNKNOWN",
        languageNoExpiry: false,
        otherState: "UNKNOWN",
      };
      const errors = await validate(
        plainToInstance(GraduationEvidenceDto, base),
      );
      if (v === 0) expect(errors).toHaveLength(0);
      else expect(errors.length).toBeGreaterThan(0);
    },
  );
  it("requires explicit actual level for batch; no hardcoded Master/PhD", async () => {
    expect((await validate(new GraduationBatchDto())).length).toBeGreaterThan(
      0,
    );
    expect(
      (
        await validate(
          plainToInstance(GraduationBatchDto, {
            educationLevelId: "1",
            afterId: "0",
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it.each([
    { page: 0 },
    { limit: 101 },
    { status: "GRADUATED" },
    { educationLevelId: "1 OR 1=1" },
  ])("rejects query %p", async (value) => {
    expect(
      (await validate(plainToInstance(GraduationQueryDto, value))).length,
    ).toBeGreaterThan(0);
  });
});
