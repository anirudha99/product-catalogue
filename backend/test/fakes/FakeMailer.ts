import type { MailMessage, Mailer } from "../../src/mail/Mailer.js";

/** Records every message instead of sending it. Set `failWith` to simulate the mail server being down. */
export class FakeMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  failWith: Error | undefined;

  async send(message: MailMessage): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.sent.push(message);
  }
}
