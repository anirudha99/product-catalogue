import { EmailError, NotFoundError } from "../domain/errors.js";
import { silentLogger, type Logger } from "../log.js";
import type { Mailer } from "../mail/Mailer.js";
import type { ProductSource } from "../products/ProductSource.js";
import { enquiryEmail, type Enquiry } from "./enquiryEmail.js";

export type EnquiryServiceOptions = {
  source: ProductSource;
  mailer: Mailer;
  salesInbox: string;
  newId: () => string;
  logger?: Logger;
};

/**
 * Sends an enquiry to the sales inbox. Not stored: the email is the record (for now; see DECISIONS.md).
 * If sending fails the caller gets EmailError and the customer is asked to try again.
 */
export class EnquiryService {
  private readonly logger: Logger;

  constructor(private readonly options: EnquiryServiceOptions) {
    this.logger = options.logger ?? silentLogger;
  }

  async submit(enquiry: Enquiry): Promise<{ reference: string }> {
    const { source, mailer, salesInbox, newId } = this.options;

    const product = await source.getProduct(enquiry.productId);
    if (!product) throw new NotFoundError("Product not found.");

    const reference = newId();
    try {
      await mailer.send(enquiryEmail({ enquiry, product, reference, salesInbox }));
    } catch (err) {
      throw new EmailError(err instanceof Error ? err.message : String(err));
    }

    // IDs only: never the customer's name, email, phone or message.
    this.logger.info("enquiry sent", { reference, productId: product.id });
    return { reference };
  }
}
