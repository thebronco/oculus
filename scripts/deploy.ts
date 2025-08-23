// scripts/deploy.ts
// ESM-friendly deploy script for Windows/macOS/Linux

import { execSync } from "node:child_process";
import type { ExecSyncOptions } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Opts = ExecSyncOptions & { cwd?: string };

function sh(cmd: string, opts: Opts = {}) {
  const merged: Opts = {
    stdio: "inherit",
    env: process.env,
    ...opts,
  };
  execSync(cmd, merged);
}

function shCap(cmd: string, opts: Opts = {}) {
  const merged: Opts = {
    stdio: "pipe",
    env: process.env,
    ...opts,
  };
  return execSync(cmd, merged).toString().trim();
}

function section(title: string) {
  console.log(`\n==[ ${title} ]==\n`);
}

function ensureFile(p: string, message?: string) {
  if (!fs.existsSync(p)) {
    throw new Error(message ?? `Missing required file: ${p}`);
  }
}

function ensureDepIsPresent(pkgJsonPath: string, depName: string) {
  const json = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  const has =
    (json.dependencies && json.dependencies[depName]) ||
    (json.devDependencies && json.devDependencies[depName]);
  if (!has) {
    throw new Error(
      `Required dependency "${depName}" not found in ${pkgJsonPath}. ` +
        `Run "npm i -D ${depName}" (or add it) in the UI folder.`
    );
  }
  return String(
    (json.dependencies && json.dependencies[depName]) ||
      (json.devDependencies && json.devDependencies[depName])
  );
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const rootDir = path.resolve(__dirname, "..");
  const uiDir = path.join(rootDir, "app");
  const cdkDir = path.join(rootDir, "cdk");

  // Step 1: Build UI
  section("1/7 Build UI");
  ensureFile(path.join(uiDir, "package.json"), "app/package.json not found.");
  const uiPkg = path.join(uiDir, "package.json");

  // Helpful checks: make sure 'next' is present and compatible
  const nextVersion = ensureDepIsPresent(uiPkg, "next");
  console.log(`next detected in ui: ${nextVersion}`);

  // Prefer npm ci if lockfile exists (faster & reproducible)
  const uiHasLock = fs.existsSync(path.join(uiDir, "package-lock.json"));
  try {
    if (uiHasLock) {
      sh("npm ci", { cwd: uiDir });
    } else {
      sh("npm i", { cwd: uiDir });
    }
  } catch {
    console.warn("UI install failed — attempting a clean install with npm i …");
    sh("npm i", { cwd: uiDir });
  }

  // Verify build script exists
  const uiPkgJson = JSON.parse(fs.readFileSync(uiPkg, "utf8"));
  if (!uiPkgJson.scripts || !uiPkgJson.scripts.build) {
    throw new Error(
      `No "build" script found in ${uiPkg}. Add: "build": "next build"`
    );
  }

  sh("npm run build", { cwd: uiDir });

  // Step 2: CDK synth & deploy
  section("2/7 Deploy CDK infra (VPC/RDS/Proxy/Lambdas/API/S3+CF)");
  ensureFile(path.join(cdkDir, "package.json"), "cdk/package.json not found.");

  const cdkHasLock = fs.existsSync(path.join(cdkDir, "package-lock.json"));
  try {
    if (cdkHasLock) {
      sh("npm ci", { cwd: cdkDir });
    } else {
      sh("npm i", { cwd: cdkDir });
    }
  } catch {
    console.warn("CDK install failed — attempting a clean install with npm i …");
    sh("npm i", { cwd: cdkDir });
  }

  // Synthesize with a light retry to dodge occasional asset staging hiccups on Windows
  const synthAttempts = 3;
  let synthOk = false;
  for (let i = 1; i <= synthAttempts; i++) {
    try {
      console.log(`cdk synth (attempt ${i}/${synthAttempts}) …`);
      sh("npx cdk synth", { cwd: cdkDir });
      synthOk = true;
      break;
    } catch (err) {
      if (i === synthAttempts) throw err;
      console.warn("cdk synth failed; retrying in 5s …");
      await sleep(5000);
    }
  }
  if (!synthOk) throw new Error("cdk synth did not succeed.");

  // Deploy (accept all changes)
  sh("npx cdk deploy --require-approval never", { cwd: cdkDir });

  // Step 3: Read Stack Outputs
  section("3/7 Read Stack Outputs");
  const stackName = "OculusMiniStack";
  const outputsJson = shCap(
    `aws cloudformation describe-stacks --stack-name ${stackName} --query "Stacks[0].Outputs"`,
    { cwd: cdkDir }
  );

  type Output = { OutputKey: string; OutputValue: string };
  const outputs = JSON.parse(outputsJson) as Output[];
  const getOutput = (k: string) =>
    outputs.find((o) => o.OutputKey === k)?.OutputValue;

  const apiUrl =
    getOutput("ApiUrl") || getOutput("oculusapiEndpointA3CFC57D") || "";
  const siteUrl = getOutput("SiteUrl") || "";

  if (!apiUrl) {
    throw new Error(
      "ApiUrl not found in stack outputs. Check your CDK stack for correct outputs."
    );
  }
  console.log("ApiUrl:", apiUrl);
  if (siteUrl) console.log("SiteUrl:", siteUrl);

  // Step 4: Seed database (idempotent)
  section("4/7 Seed database (idempotent)");
  const seedUrl = new URL("/prod/admin/seed", apiUrl).toString();
  const maxSeedAttempts = 5;
  let seeded = false;

  for (let i = 1; i <= maxSeedAttempts; i++) {
    try {
      // Using PowerShell curl (Windows) or curl (POSIX) via Node child_process
      const isWin = process.platform === "win32";
      const postCmd = isWin
        ? `powershell -NoProfile -Command "try { Invoke-RestMethod -Method Post -Uri '${seedUrl}' -TimeoutSec 15 | Out-Null; exit 0 } catch { exit 1 }"`
        : `curl -sS -m 15 -X POST '${seedUrl}' -o /dev/null -w "%{http_code}"`;

      if (!isWin) {
        const code = shCap(postCmd);
        if (code === "200" || code === "204") {
          console.log(`Seed attempt ${i} succeeded with status ${code}.`);
          seeded = true;
          break;
        }
        console.warn(`Seed attempt ${i} failed with status ${code}. Retrying…`);
      } else {
        try {
          sh(postCmd);
          console.log(`Seed attempt ${i} succeeded.`);
          seeded = true;
          break;
        } catch {
          console.warn(`Seed attempt ${i} failed. Retrying…`);
        }
      }
    } catch {
      console.warn(`Seed attempt ${i} failed. Retrying…`);
    }
    await sleep(3000);
  }

  if (!seeded) {
    console.error("Seeding failed after retries.");
    // Continue instead of throwing, so you can still use the stack and debug.
  }

  // Step 5: Upload built UI to S3 (if your CDK stack outputs bucket name or deploy step handles it, skip)
  // (No-op here because your CDK stack is already doing BucketDeployment.)

  section("5/7 Static site already deployed by CDK");

  // Step 6: (Optional) CloudFront invalidation (you asked me to remind later — not executing here)
  section("6/7 CloudFront invalidation (skipped)");
  console.log(
    "Reminder: once you’re ready, read DistributionId from stack outputs and run:\n" +
      'aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"'
  );

  // Step 7: Done
  section("7/7 Complete");
  console.log("Deployment finished.");
}

main().catch((err) => {
  console.error("Command failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
