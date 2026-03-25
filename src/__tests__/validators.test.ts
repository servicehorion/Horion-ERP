import { describe, it, expect } from "vitest";
import { createPaymentSchema } from "@/lib/validators/payment";
import { createContactSchema } from "@/lib/validators/contact";

describe("createPaymentSchema", () => {
  const validPayload = {
    orderId: "order-abc",
    direction: "INBOUND",
    type: "CLIENT_DEPOSIT",
    amount: 150000,
    amountXAF: 150000,
    currency: "XAF",
  };

  it("accepts a valid payment payload", () => {
    expect(() => createPaymentSchema.parse(validPayload)).not.toThrow();
  });

  it("rejects negative amounts", () => {
    expect(() =>
      createPaymentSchema.parse({ ...validPayload, amount: -100 })
    ).toThrow();
  });

  it("rejects zero amount", () => {
    expect(() =>
      createPaymentSchema.parse({ ...validPayload, amount: 0 })
    ).toThrow();
  });

  it("requires orderId", () => {
    const { orderId, ...rest } = validPayload;
    expect(() => createPaymentSchema.parse(rest)).toThrow();
  });

  it("requires direction", () => {
    const { direction, ...rest } = validPayload;
    expect(() => createPaymentSchema.parse(rest)).toThrow();
  });

  it("requires type", () => {
    const { type, ...rest } = validPayload;
    expect(() => createPaymentSchema.parse(rest)).toThrow();
  });

  it("rejects invalid direction", () => {
    expect(() =>
      createPaymentSchema.parse({ ...validPayload, direction: "INVALID" })
    ).toThrow();
  });
});

describe("createContactSchema", () => {
  const validContact = {
    name: "Jeanne Dupont",
    email: "jeanne@example.com",
    phone: "+242 06 123 4567",
    type: "PROSPECT",
  };

  it("accepts a valid contact", () => {
    expect(() => createContactSchema.parse(validContact)).not.toThrow();
  });

  it("rejects invalid email", () => {
    expect(() =>
      createContactSchema.parse({ ...validContact, email: "not-an-email" })
    ).toThrow();
  });

  it("rejects invalid phone format", () => {
    expect(() =>
      createContactSchema.parse({ ...validContact, phone: "abc" })
    ).toThrow();
  });

  it("requires name", () => {
    const { name, ...rest } = validContact;
    expect(() => createContactSchema.parse(rest)).toThrow();
  });

  it("rejects invalid contact type", () => {
    expect(() =>
      createContactSchema.parse({ ...validContact, type: "INVALID_TYPE" })
    ).toThrow();
  });

  it("accepts contact without optional fields", () => {
    expect(() =>
      createContactSchema.parse({ name: "Simple Contact", type: "CLIENT" })
    ).not.toThrow();
  });
});
