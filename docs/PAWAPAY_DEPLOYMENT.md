# PawaPay Deployment

## DNS and hosting

Use dedicated app subdomains under `horion.tech`.

- Sandbox / staging: `https://staging.horion.tech`
- Production app: `https://app.horion.tech`

Recommended callback URLs:

- Sandbox: `https://staging.horion.tech/api/pay/pawapay/webhook`
- Production: `https://app.horion.tech/api/pay/pawapay/webhook`

Use the same callback URL for:

- Deposits
- Payments
- Refunds

If you configure `PAWAPAY_CALLBACK_TOKEN`, append it to the callback URL you register in pawaPay:

- `https://staging.horion.tech/api/pay/pawapay/webhook?token=YOUR_TOKEN`
- `https://app.horion.tech/api/pay/pawapay/webhook?token=YOUR_TOKEN`

## pawaPay onboarding choices

Select:

- Industry: `E-commerce, including SaaS`
- Money movement: `Receive and refund payments from your customers`

Do not select `Make payments to your customers` for Day 1.

## Day 1 market scope in Horion

Collections and refunds are prepared for:

- Benin: `MOOV_BEN`, `MTN_MOMO_BEN`
- Cameroun: `MTN_MOMO_CMR`, `ORANGE_CMR`
- Congo-Brazzaville: `AIRTEL_COG`, `MTN_MOMO_COG`
- RDC: `AIRTEL_COD`, `ORANGE_COD`, `VODACOM_MPESA_COD`
- Gabon: `AIRTEL_GAB`
- Cote d'Ivoire: `MTN_MOMO_CIV`, `ORANGE_CIV`
- Senegal: `FREE_SEN` (YAS), `ORANGE_SEN`

Wave is scaffolded but hidden by default. Enable it only after pawaPay confirms it in your account:

- `PAWAPAY_ENABLE_WAVE=true`

## Required environment variables

```env
PAYMENT_GATEWAY_PROVIDER=PAWAPAY
PAWAPAY_BASE_URL=https://api.sandbox.pawapay.io
PAWAPAY_API_TOKEN=...
PAWAPAY_CALLBACK_URL=https://staging.horion.tech/api/pay/pawapay/webhook
PAWAPAY_CALLBACK_TOKEN=
PAWAPAY_ENABLE_WAVE=false
PAWAPAY_COLLECTION_MARKUP_PCT=0
PAWAPAY_COLLECTION_MARKUP_FIXED=0
NEXT_PUBLIC_PAWAPAY_ENABLE_WAVE=false
NEXT_PUBLIC_PAWAPAY_COLLECTION_MARKUP_PCT=0
NEXT_PUBLIC_PAWAPAY_COLLECTION_MARKUP_FIXED=0
CRON_SECRET=...
```

For production, switch:

```env
PAWAPAY_BASE_URL=https://api.pawapay.io
PAWAPAY_CALLBACK_URL=https://app.horion.tech/api/pay/pawapay/webhook
```

## What the app now supports

- pawaPay deposit initiation
- pawaPay deposit callback handling
- pawaPay pending status polling via cron
- country/provider selection on the public payment page
- provider-specific fee estimate on the public payment page
- refund service scaffold for confirmed inbound payments
- refund callback handling
- refund status polling via cron

## External steps still required

1. Point `staging.horion.tech` and `app.horion.tech` to your hosting provider.
2. Enable HTTPS on both subdomains.
3. Register the callback URL(s) in the pawaPay dashboard.
4. Generate and store the sandbox API token.
5. Confirm activated providers in your pawaPay account.
6. Configure settlement bank account(s) and settlement frequency.
7. Add pawaPay callback IPs to your allowlist if your infra uses a firewall/WAF.
8. Set `PAYMENT_GATEWAY_PROVIDER=PAWAPAY` in staging, validate, then promote to production.

## Cron

`vercel.json` includes:

- `/api/cron/pawapay-status` every 15 minutes

This polls pending deposits and refunds as a safety net when callbacks are delayed.

## Operational note

A payment is considered confirmed in Horion only when pawaPay returns a final successful status via callback or polling.
