export interface BaseEmailInput {
  title: string;
  preheader?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatParagraphs(text?: string) {
  if (!text) return "";
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin: 0 0 12px 0; color: #1f2937;">${escapeHtml(line)}</p>`)
    .join("");
}

export function renderBaseEmail(input: BaseEmailInput) {
  const preheader = input.preheader ? escapeHtml(input.preheader) : "";
  const cta =
    input.ctaLabel && input.ctaUrl
      ? `<a href="${input.ctaUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">${escapeHtml(
          input.ctaLabel
        )}</a>`
      : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,0.08);padding:24px;font-family:Arial, sans-serif;">
            <tr>
              <td style="font-size:20px;font-weight:700;color:#111827;padding-bottom:12px;">
                ${escapeHtml(input.title)}
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;line-height:1.5;">
                ${input.bodyHtml}
              </td>
            </tr>
            ${
              cta
                ? `<tr><td style="padding-top:16px;">${cta}</td></tr>`
                : ""
            }
            <tr>
              <td style="padding-top:20px;font-size:12px;color:#6b7280;">
                Horion ERP automated notification.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

