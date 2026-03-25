import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  width?: number;
  height?: number;
  alt?: string;
  priority?: boolean;
};

export function BrandLogo({
  className,
  width = 160,
  height = 40,
  alt = "Horion",
  priority = false,
}: BrandLogoProps) {
  return (
    <Image
      src="/horion-logo.png"
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={cn("h-auto w-auto object-contain", className)}
    />
  );
}
