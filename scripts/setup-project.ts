/**
 * Project Setup Script
 * 
 * This script helps set up the Oculus project with the new workspace structure:
 * 1. Installs dependencies for all workspaces
 * 2. Creates environment files from examples
 * 3. Validates the setup
 * 4. Provides next steps
 */

import { execSync } from "node:child_process";
import type { ExecSyncOptions } from "node:child_process";
import * as fs from "node:fs";
import * as path from "path";

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

function copyEnvFile(source: string, target: string) {
  if (fs.existsSync(source) && !fs.existsSync(target)) {
    fs.copyFileSync(source, target);
    console.log(`✅ Created ${target} from ${source}`);
  } else if (fs.existsSync(target)) {
    console.log(`⚠️  ${target} already exists, skipping`);
  } else {
    console.log(`❌ Source file ${source} not found`);
  }
}

async function main() {
  section("1/4 Project Setup Validation");
  
  // Check if we're in the root directory
  const rootPackageJson = path.join(process.cwd(), "package.json");
  ensureFile(rootPackageJson, "Please run this script from the project root directory");
  
  console.log("✅ Project root directory confirmed");
  
  // Check workspace structure
  const workspaces = ["cdk", "app", "lambdas"];
  const missingWorkspaces = workspaces.filter(ws => !fs.existsSync(ws));
  
  if (missingWorkspaces.length > 0) {
    throw new Error(`Missing workspaces: ${missingWorkspaces.join(", ")}`);
  }
  
  console.log("✅ All workspaces found");
  
  section("2/4 Installing Dependencies");
  
  // Install root dependencies
  console.log("📦 Installing root dependencies...");
  try {
    sh("npm install");
    console.log("✅ Root dependencies installed");
  } catch (error) {
    console.error("❌ Failed to install root dependencies:", error);
    throw error;
  }
  
  // Install workspace dependencies
  console.log("📦 Installing workspace dependencies...");
  try {
    sh("npm run install:workspaces");
    console.log("✅ Workspace dependencies installed");
  } catch (error) {
    console.error("❌ Failed to install workspace dependencies:", error);
    throw error;
  }
  
  section("3/4 Environment Configuration");
  
  // Copy environment files
  console.log("🔧 Setting up environment files...");
  
  copyEnvFile("env.example", ".env.local");
  copyEnvFile("cdk/env.example", "cdk/.env");
  copyEnvFile("app/env.example", "app/.env.local");
  copyEnvFile("lambdas/env.example", "lambdas/.env");
  
  section("4/4 Setup Complete");
  
  console.log("🎉 Project setup completed successfully!");
  
  console.log("\n📋 Next Steps:");
  console.log("   1. Configure your environment files:");
  console.log("      - .env.local (root level)");
  console.log("      - cdk/.env (infrastructure)");
  console.log("      - app/.env.local (frontend)");
  console.log("      - lambdas/.env (backend)");
  
  console.log("\n   2. Set up AWS credentials:");
  console.log("      - Configure AWS CLI: aws configure");
  console.log("      - Ensure you have appropriate permissions");
  
  console.log("\n   3. Deploy infrastructure:");
  console.log("      - npm run deploy:infra");
  
  console.log("\n   4. Deploy application:");
  console.log("      - npm run deploy:app");
  
  console.log("\n   5. Deploy Lambda updates:");
  console.log("      - npm run deploy:lambda");
  
  console.log("\n🔍 Available Commands:");
  console.log("   npm run inventory      - Check AWS resources");
  console.log("   npm run dev:app        - Start frontend development server");
  console.log("   npm run build          - Build all workspaces");
  console.log("   npm run delete:infra   - Remove all infrastructure");
  
  console.log("\n📚 Documentation:");
  console.log("   - README.md (project overview)");
  console.log("   - docs/ (detailed guides)");
  console.log("   - env.example files (configuration templates)");
  
  console.log("\n⚠️  Important Notes:");
  console.log("   - Always run 'npm run inventory' before making changes");
  console.log("   - Lambda functions are always deployed from lambdas/ folder");
  console.log("   - Infrastructure is only created when resources are missing");
  console.log("   - Check docs/ folder for detailed guides");
}

main().catch((err) => {
  console.error("Setup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
