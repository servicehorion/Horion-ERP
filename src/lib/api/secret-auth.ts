import { timingSafeEqual } from "crypto";

type SecretCheck = { ok: true } | { ok: false; status: number; error: string };

export function requireSecretHeader(
  req: Request,
  envVar: string,
  headerName = "x-horion-secret"
): SecretCheck {
  const secret = process.env[envVar];
  if (!secret) {
    return { ok: false, status: 503, error: `${envVar} non configure` };
  }

  const received = req.headers.get(headerName);
  if (!received) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const a = Buffer.from(received);
  const b = Buffer.from(secret);
  if (a.length !== b.length) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  if (!timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}
