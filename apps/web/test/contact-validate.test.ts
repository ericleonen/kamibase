import { describe, expect, it } from "vitest";
import {
  MESSAGE_MAX,
  MESSAGE_MIN,
  formatContactEmail,
  looksAutomated,
  validateContact,
} from "@/lib/contact/validate";

/** The shape a browser would post, so the tests exercise the real entry point. */
function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const GOOD = {
  name: "Akira Yoshizawa",
  email: "akira@example.com",
  subject: "A missing crease",
  message: "The 16 by 12 Miura-ori is missing a valley on the third row.",
};

describe("validateContact", () => {
  it("accepts a filled-in form", () => {
    const result = validateContact(form(GOOD));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.email).toBe("akira@example.com");
  });

  it("accepts a form with only the two required fields", () => {
    const result = validateContact(form({ email: GOOD.email, message: GOOD.message }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("");
      expect(result.value.subject).toBe("");
    }
  });

  it("needs somewhere to reply to", () => {
    expect(validateContact(form({ message: GOOD.message })).ok).toBe(false);
  });

  it("rejects an address that is not one", () => {
    for (const email of ["nope", "no@spaces here", "@example.com", "a@b", "a@b."]) {
      expect(validateContact(form({ ...GOOD, email })).ok, email).toBe(false);
    }
  });

  it("rejects a message too short to answer", () => {
    expect(validateContact(form({ ...GOOD, message: "hi" })).ok).toBe(false);
    expect(validateContact(form({ ...GOOD, message: "x".repeat(MESSAGE_MIN) })).ok).toBe(true);
  });

  it("rejects a message past the ceiling", () => {
    expect(validateContact(form({ ...GOOD, message: "x".repeat(MESSAGE_MAX + 1) })).ok).toBe(false);
  });

  it("strips newlines out of the fields that become headers", () => {
    const result = validateContact(
      form({
        ...GOOD,
        subject: "Hello\r\nBcc: everyone@example.com",
        email: "akira@example.com\r\nBcc: everyone@example.com",
      }),
    );
    // The address is no longer an address once the injection is stripped, which
    // is the right answer: it was never one.
    expect(result.ok).toBe(false);
  });

  it("keeps a header injection out of the subject", () => {
    const result = validateContact(form({ ...GOOD, subject: "Hello\nBcc: someone@example.com" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.subject).not.toContain("\n");
  });

  it("keeps the paragraphs in the message", () => {
    const result = validateContact(form({ ...GOOD, message: "One line.\n\nAnd another." }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.message).toContain("\n\n");
  });

  it("drops control characters", () => {
    const result = validateContact(form({ ...GOOD, name: "Aki\u0007ra" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe("Akira");
  });
});

describe("looksAutomated", () => {
  it("is quiet for a form a person filled in", () => {
    expect(looksAutomated(form(GOOD))).toBe(false);
  });

  it("catches anything that filled the invisible field", () => {
    expect(looksAutomated(form({ ...GOOD, website: "https://example.com" }))).toBe(true);
  });
});

describe("formatContactEmail", () => {
  it("puts the sender in the body and the subject in the subject", () => {
    const { subject, text } = formatContactEmail({
      name: "Akira",
      email: "akira@example.com",
      subject: "A missing crease",
      message: "The third row.",
    });
    expect(subject).toBe("Kamibase: A missing crease");
    expect(text).toContain("Akira <akira@example.com>");
    expect(text).toContain("The third row.");
  });

  it("still says who it is from without a name", () => {
    const { subject, text } = formatContactEmail({
      name: "",
      email: "akira@example.com",
      subject: "",
      message: "Hello.",
    });
    expect(subject).toContain("help form");
    expect(text).toContain("From: akira@example.com");
  });
});
