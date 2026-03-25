import { promises as fs } from "fs";
import path from "path";

const CANDIDATE_LOGO_PATHS = [
  "src/assets/horion-logo.png",
  "src/assets/logo.png",
  "public/horion-logo.png",
  "public/logo.png",
];

export async function loadLogoDataUri(): Promise<string | null> {
  for (const rel of CANDIDATE_LOGO_PATHS) {
    try {
      const filePath = path.resolve(process.cwd(), rel);
      const data = await fs.readFile(filePath);
      const base64 = data.toString("base64");
      return `data:image/png;base64,${base64}`;
    } catch {
      // try next
    }
  }
  return null;
}
