import { ServiceUnavailableException } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { PasswordMailer } from "./password-mailer";
jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));
describe("PasswordMailer", () => {
  const savedEnv = { ...process.env };
  const sendMail = jest.fn();
  const mailer = new PasswordMailer();
  beforeEach(() => {
    process.env = {
      ...savedEnv,
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "owner@example.invalid",
      SMTP_PASS: "abcd efgh ijkl mnop",
      FRONTEND_URL: "http://localhost:3000",
    };
    delete process.env.SMTP_FROM;
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    sendMail.mockResolvedValue({ accepted: ["owner@example.invalid"] });
  });
  afterAll(() => {
    process.env = savedEnv;
  });
  it("uses authenticated TLS SMTP, escapes HTML and constructs the reset link", async () => {
    await mailer.sendReset(
      "owner@example.invalid",
      "<img src=x>",
      "a".repeat(64),
      30,
    );
    expect(nodemailer.createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        port: 587,
        requireTLS: true,
        auth: { user: "owner@example.invalid", pass: "abcdefghijklmnop" },
      }),
    );
    const email = sendMail.mock.calls.at(-1)[0];
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img");
    expect(email.text).toContain(
      "http://localhost:3000/reset-password?token=" + "a".repeat(64),
    );
  });
  it("rejects missing configuration without pretending to send mail", () => {
    delete process.env.SMTP_PASS;
    expect(() => mailer.assertConfigured()).toThrow(
      ServiceUnavailableException,
    );
  });
  it("detects rejected recipients", async () => {
    sendMail.mockResolvedValue({ accepted: [] });
    await expect(
      mailer.sendReset("owner@example.invalid", "Owner", "a".repeat(64), 30),
    ).rejects.toThrow("SMTP_RECIPIENT_REJECTED");
  });
});
 
