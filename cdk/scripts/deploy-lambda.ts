/**
 * Deploy Lambda Functions Script
 * 
 * This script deploys Lambda functions directly to AWS without using CDK:
 * 1. Packages the Lambda code from lambdas/ folder
 * 2. Updates existing Lambda functions with new code
 * 3. No infrastructure changes - just code updates
 * 
 * Use this when you want to update Lambda code without touching VPC, RDS, etc.
 */

import { execSync } from "node:child_process";
import type { ExecSyncOptions } from "node:child_process";
import * as fs from "node:fs";
import * as path from "path";
import * as AWS from "aws-sdk";

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

async function main() {
  section("1/3 Check Lambda Source Code");
  
  // Check if Lambda source code exists
  const lambdaSourcePath = path.join(process.cwd(), '../lambdas/api.ts');
  if (!fs.existsSync(lambdaSourcePath)) {
    throw new Error("Lambda source file not found: lambdas/api.ts");
  }
  
  console.log("✅ Lambda source code found");
  console.log(`   Source: ${lambdaSourcePath}`);
  
  // Get Lambda function name from AWS
  section("2/3 Find Lambda Function");
  
  // Configure AWS region
  AWS.config.update({ region: 'us-east-1' });
  const lambda = new AWS.Lambda();
  
  try {
    const functions = await lambda.listFunctions().promise();
    
    console.log("🔍 Available Lambda functions:");
    functions.Functions?.forEach((fn, index) => {
      console.log(`   ${index + 1}. ${fn.FunctionName} (${fn.Runtime})`);
    });
    
    // Look for the specific API Lambda function
    const oculusFunction = functions.Functions?.find(fn => 
      fn.FunctionName?.includes('oculus_api_fn') ||
      fn.FunctionName?.includes('oculus-api') ||
      fn.FunctionName?.includes('oculus_api') ||
      fn.FunctionName?.includes('OculusDevapifn') ||  // CDK generated name
      fn.FunctionName?.includes('OculusDev_api')      // Alternative naming
    );
    
    if (!oculusFunction) {
      console.log("\n❌ No API Lambda function found with expected naming pattern");
      console.log("   Expected: function with 'oculus_api' in name");
      console.log("   This might be because the CDK stack hasn't been deployed yet");
      console.log("   Available functions are shown above");
      throw new Error("No API Lambda function found - CDK stack may need deployment first");
    }
    
    console.log("\n✅ Lambda function found:");
    console.log(`   Name: ${oculusFunction.FunctionName}`);
    console.log(`   Runtime: ${oculusFunction.Runtime}`);
    console.log(`   Last Modified: ${oculusFunction.LastModified}`);
    
    section("3/3 Deploy Lambda Code");
    
    // Create temporary directory for packaging
    const tempDir = path.join(process.cwd(), 'temp-lambda-package');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Copy Lambda source
    const packageJson = {
      name: "oculus-lambda",
      version: "1.0.0",
      main: "index.js",
      dependencies: {
        "@aws-sdk/client-secrets-manager": "^3.0.0",
        "pg": "^8.16.3"
      },
      devDependencies: {
        "@types/node": "^18.0.0",
        "@types/pg": "^8.10.0",
        "@types/aws-lambda": "^8.10.0"
      }
    };
    
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    fs.copyFileSync(lambdaSourcePath, path.join(tempDir, 'index.ts'));
    
    // Install dependencies and build
    console.log("📦 Installing dependencies and building...");
    sh("npm install", { cwd: tempDir });
    
    // Compile TypeScript
    console.log("🔨 Compiling TypeScript...");
    sh("npx tsc index.ts --target es2020 --module commonjs --outDir .", { cwd: tempDir });
    
    // Create ZIP file
    console.log("📦 Creating deployment package...");
    const zipPath = path.join(process.cwd(), 'lambda-deployment.zip');
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    
    // Use PowerShell to create ZIP (Windows)
    sh(`powershell -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${zipPath}' -Force"`);
    
    // Read ZIP file and update Lambda
    console.log("🚀 Updating Lambda function...");
    const zipBuffer = fs.readFileSync(zipPath);
    
    await lambda.updateFunctionCode({
      FunctionName: oculusFunction.FunctionName!,
      ZipFile: zipBuffer
    }).promise();
    
    console.log("✅ Lambda function updated successfully!");
    
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    
    console.log("\n🎉 Lambda deployment complete!");
    console.log("   Function updated with latest code from lambdas/api.ts");
    console.log("   No infrastructure changes made");
    
  } catch (error) {
    console.error("❌ Lambda deployment failed:", error);
    throw error;
  }
}

main().catch((err) => {
  console.error("Command failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
