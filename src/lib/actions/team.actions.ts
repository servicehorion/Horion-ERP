"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { EmailNotificationChannel } from "@/lib/services/notification-channels.service";
import type { UserRole } from "@prisma/client";

const ROLE_VALUES: UserRole[] = [
  "ADMIN",
  "CEO",
  "DIRECTION",
  "CTO",
  "AI_ENGINEER",
  "CRM_MANAGER",
  "COMMERCIAL",
  "COMMUNITY_MANAGER",
  "LOGISTICS_MANAGER",
  "LOGISTICS_ASSISTANT",
  "SOURCING_ASSISTANT",
  "FINANCE_MANAGER",
  "FINANCE",
  "OPS",
];

function generateTempPassword() {
  return randomBytes(9).toString("base64url");
}

export async function getTeamMembers() {
  try {
    const user = await getSession();
    checkPermission(user.role, "user.manage");

    const members = await prisma.user.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return { data: members };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur equipe" };
  }
}

export async function inviteTeamMember(params: {
  email: string;
  name?: string;
  role: UserRole;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "user.manage");

    const email = params.email.trim().toLowerCase();
    if (!email) return { error: "Email requis" };
    if (!ROLE_VALUES.includes(params.role)) return { error: "Role invalide" };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.tenantId !== user.tenantId) return { error: "Email deja utilise" };
      return { error: "Utilisateur existe deja" };
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const name = params.name?.trim() || email.split("@")[0];

    const created = await prisma.user.create({
      data: {
        tenantId: user.tenantId,
        email,
        name,
        role: params.role,
        password: passwordHash,
        isActive: true,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";
    const loginUrl = appUrl ? `${appUrl}/login` : "";

    await EmailNotificationChannel.send({
      to: email,
      type: "TEAM_INVITE",
      title: "Bienvenue sur Horion ERP",
      message: [
        `Bonjour ${name},`,
        "",
        "Votre compte Horion ERP vient d'etre cree.",
        `Email: ${email}`,
        `Mot de passe temporaire: ${tempPassword}`,
        "Veuillez changer votre mot de passe apres votre premiere connexion.",
        loginUrl ? `Connexion: ${loginUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      entityType: "user",
      entityId: created.id,
      urgency: "normal",
    });

    revalidatePath("/settings/team");
    return { data: { id: created.id } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur invitation" };
  }
}

export async function checkTeamMemberEmailAvailability(emailInput: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "user.manage");

    const email = emailInput.trim().toLowerCase();
    if (!email) return { available: false, error: "Email requis" };
    if (!email.includes("@")) return { available: false, error: "Format email invalide" };

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, tenantId: true },
    });

    if (!existing) return { available: true };
    if (existing.tenantId !== user.tenantId) return { available: false, error: "Email deja utilise" };
    return { available: false, error: "Utilisateur existe deja" };
  } catch (error) {
    return { available: false, error: error instanceof Error ? error.message : "Erreur validation email" };
  }
}

export async function updateMemberRole(memberId: string, role: UserRole) {
  try {
    const user = await getSession();
    checkPermission(user.role, "user.manage");

    if (!ROLE_VALUES.includes(role)) return { error: "Role invalide" };

    const updated = await prisma.user.update({
      where: { id: memberId },
      data: { role },
    });

    revalidatePath("/settings/team");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur role" };
  }
}

export async function deactivateMember(memberId: string, isActive: boolean) {
  try {
    const user = await getSession();
    checkPermission(user.role, "user.manage");

    const updated = await prisma.user.update({
      where: { id: memberId },
      data: { isActive },
    });

    revalidatePath("/settings/team");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur activation" };
  }
}
