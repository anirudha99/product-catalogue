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
      // Worst case 5 + 5 + 10 s, plus up to 5 s for the product lookup: still inside the app's 30 s enquiry timeout,
      // so the app never gives up on a request that then succeeds (which would invite a duplicate enquiry).
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
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
