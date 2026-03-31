"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { StorageService } from "@/lib/services/storage.service";
import { revalidatePath } from "next/cache";

type BrandingSettings = {
  logoUrl?: string;
  primaryColor?: string;
  companyName?: string;
  address?: string;
  nif?: string;
  phone?: string;
  email?: string;
};

const getBranding = (settings: Record<string, unknown> | null | undefined): BrandingSettings => {
  const raw = settings?.branding;
  if (raw && typeof raw === "object") return raw as BrandingSettings;
  return {};
};

const parseStorageRef = (value?: string) => {
  if (!value || !value.startsWith("storage://")) return null;
  const trimmed = value.replace("storage://", "");
  const [bucket, ...rest] = trimmed.split("/");
  if (!bucket || rest.length === 0) return null;
  return { bucket, path: rest.join("/") };
};

export async function getTenantSettings() {
  const user = await getSession();
  checkPermission(user.role, "user.manage");

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { id: true, name: true, currency: true, timezone: true, settings: true },
  });

  if (!tenant) return { error: "Tenant introuvable" };

  const settings = (tenant.settings as Record<string, unknown>) ?? {};
  const branding = getBranding(settings);

  let logoPreviewUrl = branding.logoUrl;
  const storageRef = parseStorageRef(branding.logoUrl);
  if (storageRef) {
    try {
      logoPreviewUrl = await StorageService.createSignedUrl({
        bucket: storageRef.bucket,
        path: storageRef.path,
        expiresIn: 3600,
      });
    } catch {
      logoPreviewUrl = undefined;
    }
  }

  return {
    data: {
      id: tenant.id,
      name: tenant.name,
      currency: tenant.currency,
      timezone: tenant.timezone,
      branding: {
        ...branding,
        logoPreviewUrl,
      },
    },
  };
}

export async function updateTenantSettings(formData: FormData) {
  const user = await getSession();
  checkPermission(user.role, "user.manage");

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { settings: true },
  });
  if (!tenant) return { error: "Tenant introuvable" };

  const settings = (tenant.settings as Record<string, unknown>) ?? {};
  const branding = getBranding(settings);

  const currency = String(formData.get("currency") || "").trim();
  const timezone = String(formData.get("timezone") || "").trim();
  const primaryColor = String(formData.get("primaryColor") || "").trim();
  const companyName = String(formData.get("companyName") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const nif = String(formData.get("nif") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const externalLogoUrl = String(formData.get("logoUrl") || "").trim();
  const clearLogo = String(formData.get("clearLogo") || "") === "on";

  let logoUrl = branding.logoUrl;
  if (clearLogo) logoUrl = undefined;
  if (!clearLogo && externalLogoUrl) logoUrl = externalLogoUrl;

  const file = formData.get("logo") as File | null;
  if (file && file.size > 0) {
    StorageService.assertPrivateUploads();
    StorageService.validateUpload({
      filename: file.name || "logo",
      mimeType: file.type,
      size: file.size,
      kind: "image",
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    await StorageService.scanBufferIfEnabled({
      buffer,
      filename: file.name || "logo",
      mimeType: file.type,
      size: file.size,
    });

    const path = StorageService.buildObjectPath(
      ["tenants", user.tenantId, "branding"],
      file.name || "logo"
    );
    const upload = await StorageService.upload({
      path,
      data: buffer,
      contentType: file.type || "application/octet-stream",
    });
    logoUrl = `storage://${upload.bucket}/${upload.path}`;
  }

  await prisma.tenant.update({
    where: { id: user.tenantId },
    data: {
      currency: currency || undefined,
      timezone: timezone || undefined,
      settings: {
        ...settings,
        branding: {
          ...branding,
          logoUrl,
          primaryColor: primaryColor || branding.primaryColor,
          companyName: companyName || branding.companyName,
          address: address || branding.address,
          nif: nif || branding.nif,
          phone: phone || branding.phone,
          email: email || branding.email,
        },
      },
    },
  });

  revalidatePath("/settings/branding");
  revalidatePath("/settings");
  return { data: true };
}
