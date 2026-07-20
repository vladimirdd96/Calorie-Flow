import { cp, copyFile, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const output = ".sites-output";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npm", ["run", "build"]);

await rm(output, { recursive: true, force: true });
await mkdir(`${output}/.open-next/assets/_next`, { recursive: true });
await mkdir(`${output}/.openai`, { recursive: true });
await cp("public", `${output}/.open-next/assets`, { recursive: true });
await cp(".next/static", `${output}/.open-next/assets/_next/static`, { recursive: true });
await copyFile(".next/server/app/index.html", `${output}/.open-next/assets/index.html`);
await copyFile("cloudflare/sites-worker.js", `${output}/.open-next/worker.js`);
await copyFile(".openai/hosting.json", `${output}/.openai/hosting.json`);
await copyFile("wrangler.jsonc", `${output}/wrangler.jsonc`);

console.log(`Sites artifact prepared in ${output}`);
