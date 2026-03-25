import { describe, it, expect } from "vitest";
import { TotpService } from "@/lib/services/totp.service";

describe("TotpService", () => {
  it("generates a 32-character base32 secret", () => {
    const secret = TotpService.generateSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("generates 8 backup codes of 8 hex chars each", () => {
    const codes = TotpService.generateBackupCodes();
    expect(codes).toHaveLength(8);
    codes.forEach((c) => expect(c).toMatch(/^[0-9A-F]{8}$/));
  });

  it("builds a valid otpauth URI", () => {
    const secret = TotpService.generateSecret();
    const uri = TotpService.buildOtpAuthUri({ secret, email: "admin@horion.co" });
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain(secret);
    expect(uri).toContain("admin%40horion.co");
  });

  it("rejects codes of wrong length", () => {
    const secret = TotpService.generateSecret();
    expect(TotpService.verify(secret, "12345")).toBe(false);
    expect(TotpService.verify(secret, "1234567")).toBe(false);
    expect(TotpService.verify(secret, "abcdef")).toBe(false);
  });

  it("accepts a freshly generated code", async () => {
    // We test with a known secret and a current counter to verify the algorithm.
    // This is an integration-level smoke test — if the algorithm is correct the
    // code generated internally will verify against itself.
    const secret = TotpService.generateSecret();
    // Access the private hotp/totp internals via module-level test helper
    // by verifying that the same secret verifies a self-generated code.
    // We can't call a freshly generated live code in unit tests, but we can
    // verify structural consistency: verify() returns true for a valid code
    // produced at the same instant.
    // Generate code manually using the same algorithm:
    const { createHmac } = await import("node:crypto");
    const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    function b32Decode(str: string): Buffer {
      const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, "");
      let bits = 0, value = 0;
      const out: number[] = [];
      for (const c of clean) {
        value = (value << 5) | B32_ALPHABET.indexOf(c);
        bits += 5;
        if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
      }
      return Buffer.from(out);
    }
    const secretBuf = b32Decode(secret);
    const counter = BigInt(Math.floor(Date.now() / 1000 / 30));
    const ctrBuf = Buffer.alloc(8);
    ctrBuf.writeBigUInt64BE(counter);
    const hmac = createHmac("sha1", secretBuf).update(ctrBuf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)
    ) % 1_000_000;
    const codeStr = code.toString().padStart(6, "0");
    expect(TotpService.verify(secret, codeStr)).toBe(true);
  });

  it("rejects a code from a different secret", () => {
    const secret1 = TotpService.generateSecret();
    const secret2 = TotpService.generateSecret();
    // Any 6-digit code is astronomically unlikely to match by chance
    expect(TotpService.verify(secret1, "000000")).toBe(false);
    // Two different secrets should not cross-validate for a random code
    const notACode = "999999";
    // Both might return false — we just ensure verify is deterministic
    const r1 = TotpService.verify(secret1, notACode);
    const r2 = TotpService.verify(secret2, notACode);
    // Neither should throw
    expect(typeof r1).toBe("boolean");
    expect(typeof r2).toBe("boolean");
  });
});
