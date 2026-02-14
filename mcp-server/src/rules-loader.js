import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadRules() {
  try {
    const rulesPath = join(__dirname, "..", "rules", "rules.json");
    const data = await readFile(rulesPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading rules:", error.message);
    return [];
  }
}
