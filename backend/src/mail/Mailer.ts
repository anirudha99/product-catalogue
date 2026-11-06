export type MailAddress = { name: string; address: string };

export type MailMessage = {
  to: string;
  /** The customer. Passed as a structured address, never a hand-built "Name <email>" string. */
  replyTo?: MailAddress;
  subject: string;
  /** Plain text only: nothing customer-typed is ever rendered as HTML. */
  text: string;
};

/**
 * How email leaves the system. SMTP (Mailpit locally, SES SMTP later) today;
 * an HTTP email API later would be one more class implementing this.
 * Implementations throw on failure; callers decide what that means.
 */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}
