import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import * as nodemailer from "nodemailer";

@Injectable()
export class PasswordMailer {
  assertConfigured() {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new ServiceUnavailableException(
        "Chức năng gửi email chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
      );
    }
    const url = new URL(process.env.FRONTEND_URL || "http://localhost:3000");
    if (!["http:", "https:"].includes(url.protocol))
      throw new ServiceUnavailableException(
        "Địa chỉ frontend chưa được cấu hình đúng.",
      );
  }
  async sendReset(
    to: string,
    fullName: string,
    token: string,
    minutes: number,
  ) {
    this.assertConfigured();
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS: !secure,
      auth: {
        user: process.env.SMTP_USER,
        pass:
          host === "smtp.gmail.com"
            ? process.env.SMTP_PASS.replace(/\s/g, "")
            : process.env.SMTP_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    const link = new URL(
      "/reset-password",
      process.env.FRONTEND_URL || "http://localhost:3000",
    );
    link.searchParams.set("token", token);
    const escape = (text: string) =>
      text.replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
    const result = await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: "[CTĐT] Đặt lại mật khẩu",
      text: `Xin chào ${fullName}. Mở liên kết để đặt lại mật khẩu: ${link.toString()}. Liên kết dùng một lần, hết hạn sau ${minutes} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
      html: `<p>Xin chào ${escape(fullName)},</p><p><a href="${escape(link.toString())}">Đặt lại mật khẩu</a></p><p>Liên kết dùng một lần, hết hạn sau ${minutes} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
    });
    if (!result.accepted?.length) throw new Error("SMTP_RECIPIENT_REJECTED");
  }
}
 
