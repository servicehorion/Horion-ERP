export function isAuthErrorMessage(message?: string | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  if (lower.includes("authent")) return true;
  if (lower.includes("jwt") && lower.includes("session")) return true;
  return lower.includes("tenant") && lower.includes("configur");
}
