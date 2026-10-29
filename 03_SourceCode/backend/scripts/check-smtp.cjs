const path = require("node:path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
const nodemailer = require("nodemailer");
(async () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS)
    throw new Error(
      "Fill SMTP_USER and SMTP_PASS (Google app password for Gmail) in backend/.env first.",
    );
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
  await transport.verify();
  console.log(
    "SMTP connection and authentication verified. Use /quen-mat-khau with a real account email to test delivery.",
  );
})().catch((error) => {
  console.error("SMTP verification failed:", error.code || error.message);
  process.exitCode = 1;
});
 
