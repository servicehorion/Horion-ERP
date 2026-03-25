/**
 * TotpService — RFC 6238 TOTP implementation using only Node.js built-ins.
 * No external dependencies required.
 */

import { createHmac, randomBytes } from "crypto";

// ── Base32 ────────────────────────────────────────────────────────────────────

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += B32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const c of clean) {
    value = (value << 5) | B32_ALPHABET.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

// ── HOTP / TOTP ───────────────────────────────────────────────────────────────

function hotp(secretBuf: Buffer, counter: bigint): string {
  const ctrBuf = Buffer.alloc(8);
  ctrBuf.writeBigUInt64BE(counter);
  const hmac = createHmac("sha1", secretBuf).update(ctrBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}

export class TotpService {
  private static STEP_SECONDS = 30;
  private static DRIFT_WINDOW = 1; // accept ±1 time step

  /** Generate a new random TOTP secret (base32-encoded). */
  static generateSecret(): string {
    return base32Encode(randomBytes(20));
  }

  /** Generate 8 single-use backup codes. */
  static generateBackupCodes(): string[] {
    return Array.from({ length: 8 }, () =>
      randomBytes(4).toString("hex").toUpperCase()
    );
  }

  /**
   * Build the otpauth:// URI for QR code generation.
   * Paste the URI into a QR generator or open it directly in an authenticator.
   */
  static buildOtpAuthUri(params: {
    secret: string;
    email: string;
    issuer?: string;
  }): string {
    const issuer = encodeURIComponent(params.issuer ?? "Horion ERP");
    const account = encodeURIComponent(params.email);
    return `otpauth://totp/${issuer}:${account}?secret=${params.secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  }

  /** Verify a 6-digit TOTP code against a base32-encoded secret. */
  static verify(secret: string, code: string): boolean {
    if (!/^\d{6}$/.test(code)) return false;
    const secretBuf = base32Decode(secret);
    const counter = BigInt(Math.floor(Date.now() / 1000 / this.STEP_SECONDS));
    for (let i = -this.DRIFT_WINDOW; i <= this.DRIFT_WINDOW; i++) {
      if (hotp(secretBuf, counter + BigInt(i)) === code) return true;
    }
    return false;
  }
}
