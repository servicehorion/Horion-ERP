import { PrismaClient, UserRole, AccountType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Horion ERP database...");

  // 1. Create tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: "horion-congo" },
    update: {},
    create: {
      id: "horion-congo",
      name: "Horion Congo",
      country: "CG",
      currency: "XAF",
      timezone: "Africa/Brazzaville",
      settings: {
        commissionRate: 0.10,
        insuranceRate: 0.03,
      },
    },
  });
  console.log(`Tenant: ${tenant.name}`);

  // 2. Create users
  // Password read from SEED_PASSWORD env var; falls back to dev default.
  // Set SEED_PASSWORD in CI/staging to avoid hardcoded credentials in logs.
  const seedPassword = process.env.SEED_PASSWORD || "horion2026";
  const passwordHash = await bcrypt.hash(seedPassword, 10);

  const users = [
    { id: "user-admin", email: "admin@horion.co", name: "Admin Horion", role: UserRole.ADMIN },
    { id: "user-ops", email: "ops@horion.co", name: "Ops Manager", role: UserRole.OPS },
    { id: "user-finance", email: "finance@horion.co", name: "Finance Manager", role: UserRole.FINANCE },
    { id: "user-commercial", email: "commercial@horion.co", name: "Commercial", role: UserRole.COMMERCIAL },
    { id: "user-direction", email: "ceo@horion.co", name: "CEO Horion", role: UserRole.DIRECTION },
  ];

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        id: u.id,
        tenantId: tenant.id,
        email: u.email,
        password: passwordHash,
        name: u.name,
        role: u.role,
      },
    });
    console.log(`User: ${user.name} (${user.role})`);
  }

  // 3. Create FX rates
  const fxRates = [
    { fromCurrency: "USD", toCurrency: "XAF", rate: 605 },
    { fromCurrency: "RMB", toCurrency: "XAF", rate: 83 },
    { fromCurrency: "EUR", toCurrency: "XAF", rate: 655.957 },
    { fromCurrency: "USD", toCurrency: "RMB", rate: 7.25 },
  ];

  for (const fx of fxRates) {
    await prisma.fXRate.create({
      data: {
        fromCurrency: fx.fromCurrency,
        toCurrency: fx.toCurrency,
        rate: fx.rate,
        source: "manual",
      },
    });
    console.log(`FX Rate: ${fx.fromCurrency}/${fx.toCurrency} = ${fx.rate}`);
  }

  // 4. Create delegation rules (permissions-based model)
  const delegationRules = [
    { permissions: ["approve_payment"], maxAmountXAF: 500000 },
    { permissions: ["select_supplier"], maxAmountXAF: 2000000 },
    { permissions: ["approve_payment", "approve_refund"], maxAmountXAF: 5000000 },
    { permissions: ["approve_payment", "approve_refund"], maxAmountXAF: null },
  ];

  for (const rule of delegationRules) {
    await prisma.delegationRule.create({
      data: {
        tenantId: tenant.id,
        permissions: rule.permissions,
        maxAmountXAF: rule.maxAmountXAF,
        isActive: true,
      },
    });
    console.log(`Delegation rule: ${rule.permissions.join("+")} up to ${rule.maxAmountXAF ?? "unlimited"} XAF`);
  }

  // 5. Create ledger accounts
  const accounts = [
    { code: "1000", name: "Tresorerie XAF", type: AccountType.ASSET, currency: "XAF" },
    { code: "1010", name: "Tresorerie USD", type: AccountType.ASSET, currency: "USD" },
    { code: "1020", name: "Tresorerie RMB", type: AccountType.ASSET, currency: "RMB" },
    { code: "1100", name: "Clients a recevoir", type: AccountType.ASSET, currency: "XAF" },
    { code: "2000", name: "Fournisseurs a payer", type: AccountType.LIABILITY, currency: "RMB" },
    { code: "2010", name: "Fret a payer", type: AccountType.LIABILITY, currency: "USD" },
    { code: "4000", name: "Commissions", type: AccountType.REVENUE, currency: "XAF" },
    { code: "4010", name: "Frais logistiques factures", type: AccountType.REVENUE, currency: "XAF" },
    { code: "4020", name: "Assurance", type: AccountType.REVENUE, currency: "XAF" },
    { code: "5000", name: "Achats marchandises", type: AccountType.EXPENSE, currency: "RMB" },
    { code: "5010", name: "Frais de fret", type: AccountType.EXPENSE, currency: "USD" },
    { code: "5020", name: "Droits de douane", type: AccountType.EXPENSE, currency: "XAF" },
    { code: "5030", name: "Frais QC", type: AccountType.EXPENSE, currency: "USD" },
  ];

  for (const acc of accounts) {
    await prisma.ledgerAccount.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: acc.code } },
      update: {},
      create: {
        tenantId: tenant.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        currency: acc.currency,
      },
    });
    console.log(`Account: ${acc.code} - ${acc.name}`);
  }

  // 6. Create WhatsApp channels
  const channels = [
    { platform: "whatsapp", type: "channel", name: "Horion Officiel", category: "broadcast" },
    { platform: "whatsapp", type: "group", name: "Horion - Electronique", category: "electronique" },
    { platform: "whatsapp", type: "group", name: "Horion - Mode & Textile", category: "mode" },
    { platform: "whatsapp", type: "group", name: "Horion - Maison & Deco", category: "maison" },
    { platform: "whatsapp", type: "group", name: "Horion - Commandes", category: "commandes" },
    { platform: "facebook", type: "page", name: "Horion Congo", category: "main" },
  ];

  for (const ch of channels) {
    await prisma.channel.create({
      data: {
        tenantId: tenant.id,
        ...ch,
      },
    });
    console.log(`Channel: ${ch.name} (${ch.platform}/${ch.type})`);
  }

  console.log("\nSeed completed successfully!");
  console.log("Seeded users: admin@horion.co, ops@horion.co, finance@horion.co, ceo@horion.co");
  console.log("Password set from SEED_PASSWORD env var (or dev default if not set).");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
