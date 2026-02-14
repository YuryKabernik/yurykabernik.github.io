import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadInstructions() {
  try {
    const instructionsPath = join(__dirname, "..", "instructions", "instructions.json");
    const data = await readFile(instructionsPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading instructions:", error.message);
    return [];
  }
}
