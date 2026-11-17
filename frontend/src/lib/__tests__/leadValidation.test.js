import { formatPhoneBR, normalizePhoneBR, validateLead } from "../leadValidation";

describe("normalizePhoneBR mirrors the server (_shared/phone.ts)", () => {
  test.each([
    ["(11) 99999-9999", "+5511999999999"],
    ["11 3333-4444", "+551133334444"],
    ["+55 11 99999-9999", "+5511999999999"],
    ["011999999999", "+5511999999999"],
    ["5511999999999", "+5511999999999"],
    ["551133334444", "+551133334444"],
  ])("%s -> %s", (raw, e164) => expect(normalizePhoneBR(raw)).toBe(e164));

  test.each(["", null, "9999-9999", "123", "(11) 9999-999", "441199999999", "1199999999999"])(
    "%s -> null", (raw) => expect(normalizePhoneBR(raw)).toBeNull(),
  );
});

describe("formatPhoneBR (mask)", () => {
  test.each([
    ["", ""],
    ["1", "(1"],
    ["11", "(11"],
    ["119", "(11) 9"],
    ["1133334444", "(11) 3333-4444"],
    ["11999999999", "(11) 99999-9999"],
    ["119999999999999", "(11) 99999-9999"], // extra digits dropped
    ["+55 (11) 99999-9999", "(11) 99999-9999"], // pasted with country code
    ["0 11 99999-9999", "(11) 99999-9999"], // trunk zero
    ["abc", ""],
  ])("%s -> %s", (raw, out) => expect(formatPhoneBR(raw)).toBe(out));
});

describe("validateLead", () => {
  const ok = { name: "Ana Souza", phone: "(11) 99999-9999", email: "" };

  test("valid lead has no errors", () => expect(validateLead(ok)).toEqual({}));
  test("name too short / too long / blank", () => {
    expect(validateLead({ ...ok, name: " A " }).name).toBeTruthy();
    expect(validateLead({ ...ok, name: "   " }).name).toBeTruthy();
    expect(validateLead({ ...ok, name: "a".repeat(81) }).name).toBeTruthy();
    expect(validateLead({ ...ok, name: "a".repeat(80) }).name).toBeUndefined();
  });
  test("phone must normalize", () => {
    expect(validateLead({ ...ok, phone: "" }).phone).toBeTruthy();
    expect(validateLead({ ...ok, phone: "(11) 9999" }).phone).toBeTruthy();
    expect(validateLead({ ...ok, phone: "(11) 3333-4444" }).phone).toBeUndefined();
  });
  test("email optional but valid when present", () => {
    expect(validateLead({ ...ok, email: "   " }).email).toBeUndefined();
    expect(validateLead({ ...ok, email: "ana@x" }).email).toBeTruthy();
    expect(validateLead({ ...ok, email: "ana @x.com" }).email).toBeTruthy();
    expect(validateLead({ ...ok, email: "ana@email.com.br" }).email).toBeUndefined();
  });
});
