import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { Manifest, FileEntry } from "../api/types";

/**
 * Scan a project directory for files and compute SHA-256 hashes.
 * Skips: gostforge.yml, out/ directory, nested gostforge.yml,
 * and patterns from gostforge.exclude config.
 */
export async function scanAndHash(
  projectRoot: string
): Promise<{ manifest: Manifest; fileMap: Map<string, Buffer> }> {
  const manifest: Manifest = {};
  const fileMap = new Map<string, Buffer>();

  const excludePatterns = vscode.workspace
    .getConfiguration("gostforge")
    .get<string[]>("exclude") ?? ["node_modules/**", ".git/**", "out/**"];

  await walkDir(projectRoot, projectRoot, manifest, fileMap, excludePatterns);
  return { manifest, fileMap };
}

async function walkDir(
  baseDir: string,
  currentDir: string,
  manifest: Manifest,
  fileMap: Map<string, Buffer>,
  excludePatterns: string[]
): Promise<void> {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");

    // Skip out/ directory
    if (entry.isDirectory() && entry.name === "out") {
      continue;
    }

    // Skip .git, node_modules, etc.
    if (entry.isDirectory() && shouldExclude(relativePath + "/", excludePatterns)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Skip directories containing a nested gostforge.yml (they're separate projects)
      const nestedConfig = path.join(fullPath, "gostforge.yml");
      if (fs.existsSync(nestedConfig)) {
        continue;
      }
      await walkDir(baseDir, fullPath, manifest, fileMap, excludePatterns);
    } else if (entry.isFile()) {
      // Skip gostforge.yml itself
      if (entry.name === "gostforge.yml") {
        continue;
      }

      // Skip excluded patterns
      if (shouldExclude(relativePath, excludePatterns)) {
        continue;
      }

      const data = fs.readFileSync(fullPath);
      const hash = sha256(data);
      manifest[relativePath] = hash;
      fileMap.set(relativePath, data);
    }
  }
}

function shouldExclude(relativePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (matchGlob(relativePath, pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Simple glob matching supporting ** and *.
 */
function matchGlob(filePath: string, pattern: string): boolean {
  // Escape regex special chars, then convert glob syntax
  let regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/{{GLOBSTAR}}/g, ".*");
  return new RegExp(`^${regex}$`).test(filePath);
}

export function sha256(data: Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Filter fileMap to only include files from the missing list.
 */
export function filterMissing(
  fileMap: Map<string, Buffer>,
  missingPaths: string[]
): FileEntry[] {
  return missingPaths
    .filter((p) => fileMap.has(p))
    .map((p) => ({ path: p, data: fileMap.get(p)! }));
}
