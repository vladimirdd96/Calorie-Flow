import { readFileSync, existsSync } from "node:fs";

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const vars = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const fileVars = parseEnvFile(new URL("../../.env.local", import.meta.url));

export function requireEnv(name) {
  const value = process.env[name] || fileVars[name];
  if (!value) throw new Error(`Missing required env var ${name} (set it in .env.local)`);
  return value;
}

export function optionalEnv(name) {
  return process.env[name] || fileVars[name] || undefined;
}
