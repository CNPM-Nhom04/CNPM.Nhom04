import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  SubscriptionDto,
  PublicDocumentDto,
  PortalQueryDto,
} from "./portal.dto";
describe("Public portal input boundaries", () => {
  const valid = {
    familyName: "Nguyễn Văn",
    givenName: "An",
    email: "an@example.com",
    phone: "0901234567",
    levelId: "2",
    consent: true,
  };
  it("requires consent and rejects malformed contact/reference data", async () => {
    for (const patch of [
      { consent: false },
      { email: "invalid" },
      { phone: "no phone" },
      { majorId: "1 OR 1=1" },
      { familyName: "   " },
      { website: "https://bot.invalid" },
      { message: "a".repeat(2001) },
    ])
      expect(
        (
          await validate(
            plainToInstance(SubscriptionDto, { ...valid, ...patch }),
          )
        ).length,
      ).toBeGreaterThan(0);
    expect(
      await validate(plainToInstance(SubscriptionDto, valid)),
    ).toHaveLength(0);
  });
  it("only permits explicit HTTPS document links", async () => {
    const input = {
      title: "Văn bản",
      category: "REGULATION",
      summary: "",
      status: "DRAFT",
    };
    for (const documentUrl of [
      "javascript:alert(1)",
      "data:text/html,hi",
      "http://example.org/file.pdf",
    ])
      expect(
        (
          await validate(
            plainToInstance(PublicDocumentDto, { ...input, documentUrl }),
          )
        ).length,
      ).toBeGreaterThan(0);
    expect(
      await validate(
        plainToInstance(PublicDocumentDto, {
          ...input,
          documentUrl: "https://example.org/file.pdf",
        }),
      ),
    ).toHaveLength(0);
  });
  it("bounds pagination instead of passing unbounded public requests to SQL", async () => {
    expect(
      (await validate(plainToInstance(PortalQueryDto, { limit: "101" })))
        .length,
    ).toBeGreaterThan(0);
  });
  it("only accepts postgraduate catalog sections", async () => {
    for (const levelCode of ["MASTER", "DOCTOR"])
      expect(
        await validate(plainToInstance(PortalQueryDto, { levelCode })),
      ).toHaveLength(0);
    expect(
      (
        await validate(
          plainToInstance(PortalQueryDto, { levelCode: "BACHELOR" }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
