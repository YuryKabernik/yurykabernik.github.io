import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadPrompts() {
  try {
    const promptsPath = join(__dirname, "..", "prompts", "prompts.json");
    const data = await readFile(promptsPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading prompts:", error.message);
    return [];
  }
}
