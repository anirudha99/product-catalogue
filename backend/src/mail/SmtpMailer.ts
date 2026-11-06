import nodemailer, { type Transporter } from "nodemailer";
import type { MailMessage, Mailer } from "./Mailer.js";

export type SmtpOptions = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

/** The only file that knows about SMTP. Works with Mailpit locally and with any SMTP provider (e.g. SES). */
export class SmtpMailer implements Mailer {
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(options: SmtpOptions) {
    this.from = options.from;
    this.transport = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      ...(options.user ? { auth: { user: options.user, pass: options.pass ?? "" } } : {}),
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      ...(message.replyTo ? { replyTo: { name: message.replyTo.name, address: message.replyTo.address } } : {}),
      subject: message.subject,
      text: message.text,
    });
  }
}
