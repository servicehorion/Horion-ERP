import { BrandLogo } from "@/components/layout/brand-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="w-full max-w-md px-4">
        <div className="mb-6 flex justify-center">
          <BrandLogo width={180} height={44} priority />
        </div>
        {children}
      </div>
    </div>
  );
}
