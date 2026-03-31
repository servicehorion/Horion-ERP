import fs from "node:fs";
import path from "node:path";

const nextDir = path.resolve(process.cwd(), ".next");

if (!fs.existsSync(nextDir)) {
  console.log("[clean:next] Aucun dossier .next a nettoyer.");
  process.exit(0);
}

try {
  fs.rmSync(nextDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  console.log("[clean:next] Cache .next supprime.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[clean:next] Impossible de supprimer .next. Fermez d'abord les process Next/Node encore actifs, puis relancez la commande.");
  console.error(`[clean:next] ${message}`);
  process.exit(1);
}
