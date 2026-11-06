import type { Product } from "../domain/product.js";
import type { MailMessage } from "../mail/Mailer.js";

export type Enquiry = {
  productId: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
};

/**
 * The email the sales team receives. Product details come from our product source, never from
 * the request, so a customer can't put a fake product name or price in front of sales.
 */
export function enquiryEmail(input: { enquiry: Enquiry; product: Product; reference: string; salesInbox: string }): MailMessage {
  const { enquiry, product, reference, salesInbox } = input;
  const price = `${product.price.currency} ${(product.price.amountMinor / 100).toFixed(2)}`;

  const text = [
    "New product enquiry",
    "",
    `Product:   ${product.title} (ID ${product.id})`,
    `Price:     ${price}`,
    `Reference: ${reference}`,
    "",
    "Customer",
    `Name:      ${enquiry.name}`,
    `Email:     ${enquiry.email}`,
    `Phone:     ${enquiry.phone ?? "not given"}`,
    "",
    "Message:",
    enquiry.message ?? "No message.",
    "",
    "Reply to this email to answer the customer directly.",
  ].join("\n");

  return {
    to: salesInbox,
    replyTo: { name: enquiry.name, address: enquiry.email },
    subject: `Enquiry ${reference.slice(0, 8)}: ${product.title}`,
    text,
  };
}
