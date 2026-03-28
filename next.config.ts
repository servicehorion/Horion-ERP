import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// unsafe-eval is required by Turbopack HMR in dev only.
// In production it defeats CSP entirely — remove it.
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: `default-src 'self'; img-src 'self' data: blob: https:; ${scriptSrc}; style-src 'self' 'unsafe-inline'; connect-src 'self' https: wss:; frame-ancestors 'none'`,
  },
];

const nextConfig: NextConfig = {
  // `next build` typecheck can fail with `spawn EPERM` on some Windows setups.
  // We run `tsc --noEmit` separately in CI/local before build.
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    // Tree-shake barrel packages: avoids parsing all 563 lucide icons on every file import.
    // Without this, compilation is 3-5x slower for large icon/chart libraries.
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@tanstack/react-query",
      "@tanstack/react-table",
      "@tanstack/react-virtual",
      "date-fns",
      "@hello-pangea/dnd",
      "radix-ui",
    ],
  },
  // Prisma, pg, bcrypt, and heavy server-only libs — must not be bundled by Turbopack
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "pg-native",
    "bcryptjs",
    "@react-pdf/renderer",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

type WithSentryConfig = (
  config: NextConfig,
  sentryBuildOptions?: Record<string, unknown>,
  sentryWebpackPluginOptions?: Record<string, unknown>
) => NextConfig;

let withSentryConfig: WithSentryConfig | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ({ withSentryConfig } = require("@sentry/nextjs"));
} catch {
  withSentryConfig = null;
}

export default withSentryConfig
  && process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, { silent: true }, { hideSourceMaps: true })
  : nextConfig;
