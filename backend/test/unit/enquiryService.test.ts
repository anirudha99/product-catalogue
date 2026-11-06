import { describe, expect, it, vi } from "vitest";
import { EmailError, NotFoundError } from "../../src/domain/errors.js";
import { EnquiryService } from "../../src/enquiries/EnquiryService.js";
import type { Logger } from "../../src/log.js";
import { FakeMailer } from "../fakes/FakeMailer.js";
import { snapshotSource } from "../support/snapshot.js";

const REF = "0a1b2c3d-0000-4000-8000-000000000009";

function setup() {
  const mailer = new FakeMailer();
  const logger: Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const service = new EnquiryService({
    source: snapshotSource(),
    mailer,
    salesInbox: "sales@example.test",
    newId: () => REF,
    logger,
  });
  return { mailer, logger, service };
}

const enquiry = {
  productId: "3",
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+44 20 7946 0000",
  message: "Do you ship to India?",
};

describe("EnquiryService.submit", () => {
  it("sends one email to the sales inbox and returns the reference", async () => {
    const { mailer, service } = setup();

    const receipt = await service.submit(enquiry);

    expect(receipt).toEqual({ reference: REF });
    expect(mailer.sent).toHaveLength(1);
    const email = mailer.sent[0]!;
    expect(email.to).toBe("sales@example.test");
    expect(email.replyTo).toEqual({ name: "Ada Lovelace", address: "ada@example.com" });
    expect(email.subject).toBe("Enquiry 0a1b2c3d: Mens Cotton Jacket");
  });

  it("puts product details from our source in the email, plus the customer's details", async () => {
    const { mailer, service } = setup();

    await service.submit(enquiry);

    const text = mailer.sent[0]!.text;
    expect(text).toContain("Product:   Mens Cotton Jacket (ID 3)");
    expect(text).toContain("Price:     USD 55.99");
    expect(text).toContain(`Reference: ${REF}`);
    expect(text).toContain("Name:      Ada Lovelace");
    expect(text).toContain("Email:     ada@example.com");
    expect(text).toContain("Phone:     +44 20 7946 0000");
    expect(text).toContain("Do you ship to India?");
  });

  it("says when optional details were not given", async () => {
    const { mailer, service } = setup();

    await service.submit({ productId: "3", name: "Ada", email: "ada@example.com" });

    expect(mailer.sent[0]!.text).toContain("Phone:     not given");
    expect(mailer.sent[0]!.text).toContain("No message.");
  });

  it("rejects an unknown product and sends nothing", async () => {
    const { mailer, service } = setup();

    await expect(service.submit({ ...enquiry, productId: "999" })).rejects.toBeInstanceOf(NotFoundError);
    expect(mailer.sent).toHaveLength(0);
  });

  it("turns a mail failure into EmailError", async () => {
    const { mailer, service } = setup();
    mailer.failWith = new Error("ECONNREFUSED");

    await expect(service.submit(enquiry)).rejects.toBeInstanceOf(EmailError);
  });

  it("logs the reference and product, never the customer's details", async () => {
    const { logger, service } = setup();

    await service.submit(enquiry);

    const logged = JSON.stringify(vi.mocked(logger.info).mock.calls);
    expect(logged).toContain(REF);
    for (const secret of ["Ada", "ada@example.com", "7946", "India"]) {
      expect(logged).not.toContain(secret);
    }
  });
});
