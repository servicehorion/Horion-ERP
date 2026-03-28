import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/providers/providers";
import { auth } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Horion ERP",
  description: "Infrastructure commerciale Chine - Congo",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore
    .getAll()
    .some((cookie) =>
      /(authjs|next-auth)\.session-token/.test(cookie.name)
    );

  // Skip auth() on fully public requests with no session cookie.
  // This keeps the public website fast and avoids unnecessary auth/db work.
  const session = hasAuthCookie ? await auth().catch(() => null) : null;

  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          Aller au contenu principal
        </a>
        <Providers session={session}>
          {children}
          <Toaster position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
