import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

const browserSession = "calorie-flow-e2e";
const browserProfile = "calorie-flow-agent-ui";
const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const artifactDir = process.env.E2E_ARTIFACT_DIR ?? "artifacts/e2e";

function required(value, name) {
  if (!value) throw new Error(`${name} must be supplied by the local secret store or GitHub environment secrets.`);
  return value;
}

function runBrowser(args, { stdin } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("agent-browser", ["--session", browserSession, ...args], {
      stdio: [stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      env: { ...process.env, AGENT_BROWSER_STATE_EXPIRE_DAYS: "7" },
    });
    let output = "";
    let error = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { error += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`agent-browser ${args[0]} failed (${code}): ${error || output}`));
    });
    if (stdin !== undefined) child.stdin.end(stdin);
  });
}

function assertAuthenticatedShell(snapshot) {
  if (!/Primary navigation/.test(snapshot) || !/Add breakfast/.test(snapshot) || /Welcome back/.test(snapshot)) {
    throw new Error("The authenticated diary shell did not render after sign-in.");
  }
}

async function clickAndSettle(name) {
  await runBrowser(["find", "role", "button", "click", "--name", name]);
  await runBrowser(["wait", "500"]);
  return runBrowser(["snapshot", "-i"]);
}

async function finishFirstRunSetup() {
  let snapshot = await runBrowser(["snapshot", "-i"]);
  for (let step = 0; step < 5; step += 1) {
    if (/About you|Activity & goal/.test(snapshot)) snapshot = await clickAndSettle("Next");
    else if (/Nutrition style/.test(snapshot)) snapshot = await clickAndSettle("Start tracking");
    else if (/Which measurements feel natural/.test(snapshot)) snapshot = await clickAndSettle("Metric (cm, kg)");
    else if (/Want to track your weight/.test(snapshot)) snapshot = await clickAndSettle("Not now");
    else break;
  }
  return snapshot;
}

await mkdir(artifactDir, { recursive: true });
const email = required(process.env.E2E_EMAIL, "E2E_EMAIL");
const password = required(process.env.E2E_PASSWORD, "E2E_PASSWORD");

try {
  await runBrowser([
    "auth", "save", browserProfile,
    "--url", baseUrl,
    "--username", email,
    "--password-stdin",
  ], { stdin: password });
  await runBrowser(["auth", "login", browserProfile]);
  await runBrowser(["wait", "500"]);
  await finishFirstRunSetup();

  await runBrowser(["set", "viewport", "390", "844"]);
  const phoneSnapshot = await runBrowser(["snapshot", "-i"]);
  assertAuthenticatedShell(phoneSnapshot);
  await runBrowser(["screenshot", join(artifactDir, "authenticated-phone.png")]);

  await runBrowser(["set", "viewport", "1440", "960"]);
  const desktopSnapshot = await runBrowser(["snapshot", "-i"]);
  assertAuthenticatedShell(desktopSnapshot);
  await runBrowser(["screenshot", join(artifactDir, "authenticated-desktop.png")]);
  console.log("Hosted staging authentication and narrow/desktop visual smoke test passed.");
} finally {
  await runBrowser(["close"]).catch(() => undefined);
}
