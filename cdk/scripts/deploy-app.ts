/**
 * Deploy Application Script
 * 
 * This script deploys the frontend application and updates Lambda functions:
 * 1. Builds Next.js application
 * 2. Deploys frontend to S3/CloudFront
 * 3. Updates Lambda function code if needed
 * 4. Provides deployment status and URLs
 * 
 * Prerequisites:
 * - Infrastructure must be deployed (run deploy-infra.ts first)
 * - Next.js app must be built and ready
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

async function main() {
  const cdkDir = process.cwd();
  const appDir = path.join(cdkDir, "..", "app");

  section("1/5 Check Prerequisites");

  // Ensure we're in the CDK directory
  ensureFile(path.join(cdkDir, "package.json"), "cdk/package.json not found.");

  // Check if app directory exists
  if (!fs.existsSync(appDir)) {
    throw new Error("App directory not found. Please create the Next.js app first.");
  }

  // Check if app has package.json
  ensureFile(path.join(appDir, "package.json"), "Next.js app package.json not found.");

  // Check if infrastructure is deployed
  const inventoryPath = path.join(cdkDir, "aws-inventory.json");
  if (!fs.existsSync(inventoryPath)) {
    throw new Error("aws-inventory.json not found. Please run deploy-infra.ts first.");
  }

  console.log("✅ Prerequisites check passed");

  // Display resource information from inventory
  console.log("\n📋 AWS Resource Information:");
  const inventoryData = fs.readFileSync(inventoryPath, 'utf8');
  const inventory = JSON.parse(inventoryData);

  // Display API Gateway Information
  if (inventory.apiGateways && inventory.apiGateways.length > 0) {
    const api = inventory.apiGateways[0];
    console.log("\n🚀 API Gateway Details:");
    console.log(`   ID: ${api.id}`);
    console.log(`   Name: ${api.name}`);
    console.log(`   Stage: ${api.prodStageName || 'prod'} (production)`);
    console.log(`   Endpoint: https://${api.id}.execute-api.us-east-1.amazonaws.com/prod`);
    console.log("\n   Available Endpoints:");
    console.log(`   GET /survey/nist-csf - Fetch survey data`);
    console.log(`   POST /survey/submit - Submit survey answers`);
  } else {
    console.log("⚠️  No API Gateway found in inventory");
  }

  // Display S3 Bucket Information
  if (inventory.s3Buckets && inventory.s3Buckets.length > 0) {
    const bucket = inventory.s3Buckets[0];
    console.log("\n🪣 S3 Bucket Details:");
    console.log(`   Name: ${bucket.Name}`);
  } else {
    console.log("⚠️  No S3 buckets found in inventory");
  }

  // Display CloudFront Information
  if (inventory.cloudFrontDistributions && inventory.cloudFrontDistributions.length > 0) {
    const cf = inventory.cloudFrontDistributions[0];
    console.log("\n🌐 CloudFront Distribution:");
    console.log(`   ID: ${cf.Id}`);
    console.log(`   Domain: ${cf.DomainName}`);
  } else {
    console.log("⚠️  No CloudFront distributions found in inventory");
  }

  section("2/5 Build Next.js Application");

  console.log("🔨 Building Next.js application...");
  
  try {
    // Install dependencies
    console.log("   📦 Installing dependencies...");
    sh("npm install", { cwd: appDir });

    // Build the application
    console.log("   🏗️  Building application...");
    sh("npm run build", { cwd: appDir });
    
    console.log("✅ Next.js application built successfully");
  } catch (error) {
    console.error("❌ Failed to build Next.js application:", error);
    throw error;
  }

  section("3/5 Deploy Frontend to S3/CloudFront");

  console.log("🚀 Deploying frontend to S3/CloudFront...");

  try {
    // Get S3 bucket name from inventory
    const inventoryData = fs.readFileSync(inventoryPath, 'utf8');
    const inventory = JSON.parse(inventoryData);
    
    if (!inventory.s3Buckets || inventory.s3Buckets.length === 0) {
      throw new Error("No S3 buckets found in inventory. Please run deploy-infra.ts first.");
    }

    const bucketName = inventory.s3Buckets[0].Name;
    console.log(`   🪣  Deploying to S3 bucket: ${bucketName}`);

    // Sync built files to S3
    const outDir = path.join(appDir, "out");
    if (!fs.existsSync(outDir)) {
      throw new Error("Build output directory not found. Please ensure Next.js build completed successfully.");
    }

    console.log("   📤 Uploading files to S3...");
    sh(`aws s3 sync "${outDir}" s3://${bucketName} --delete`, { cwd: cdkDir });

    console.log("✅ Frontend deployed to S3 successfully");

    // Invalidate CloudFront cache
    if (inventory.cloudFrontDistributions && inventory.cloudFrontDistributions.length > 0) {
      const distributionId = inventory.cloudFrontDistributions[0].Id;
      console.log(`   🌐 Invalidating CloudFront cache: ${distributionId}`);
      
      sh(`aws cloudfront create-invalidation --distribution-id ${distributionId} --paths "/*"`, { cwd: cdkDir });
      console.log("✅ CloudFront cache invalidated");
    }

  } catch (error) {
    console.error("❌ Failed to deploy frontend:", error);
    throw error;
  }

  section("4/5 Update Lambda Functions (if needed)");

  console.log("🔧 Checking Lambda function updates...");

  try {
    // Check if Lambda code needs updating
    const lambdaSourcePath = path.join(cdkDir, "..", "lambdas");
    
    if (fs.existsSync(lambdaSourcePath)) {
      console.log("   📁 Lambda source code found, checking for updates...");
      
      // For now, just note that manual updates are needed
      console.log("   ℹ️  Lambda code updates require manual deployment");
      console.log("   💡 To update Lambda: modify lambdas/api.ts and redeploy infrastructure");
    } else {
      console.log("   ℹ️  No Lambda source code found, using existing functions");
    }

    console.log("✅ Lambda function check completed");
  } catch (error) {
    console.error("❌ Failed to check Lambda functions:", error);
    // Don't throw here, as this is not critical
  }

  section("5/5 Deployment Complete");

  try {
    // Get deployment URLs from inventory
    const inventoryData = fs.readFileSync(inventoryPath, 'utf8');
    const inventory = JSON.parse(inventoryData);

    console.log("🎉 Application deployment completed successfully!");
    
    // Display prominent frontend URL for testing
    if (inventory.cloudFrontDistributions && inventory.cloudFrontDistributions.length > 0) {
      const distribution = inventory.cloudFrontDistributions[0];
      console.log("\n" + "=".repeat(60));
      console.log("🚀 YOUR APP IS READY! TEST IT NOW:");
      console.log("=".repeat(60));
      console.log(`🌐 Frontend URL: https://${distribution.DomainName}`);
      console.log("=".repeat(60));
      console.log("💡 Open this URL in your browser to see your survey app!");
      console.log("=".repeat(60));
    }

    console.log("\n📋 Complete Deployment Summary:");
    
    if (inventory.s3Buckets && inventory.s3Buckets.length > 0) {
      const bucketName = inventory.s3Buckets[0].Name;
      console.log(`   🪣  S3 Bucket: ${bucketName}`);
    }

    if (inventory.cloudFrontDistributions && inventory.cloudFrontDistributions.length > 0) {
      const distribution = inventory.cloudFrontDistributions[0];
      console.log(`   🌐 CloudFront Distribution: ${distribution.Id}`);
      console.log(`   🔗 Frontend URL: https://${distribution.DomainName}`);
    }

    if (inventory.apiGateways && inventory.apiGateways.length > 0) {
      const api = inventory.apiGateways[0];
      console.log(`   🚀 API Gateway: ${api.name}`);
      console.log(`   🔗 API URL: https://${api.id}.execute-api.us-east-1.amazonaws.com/prod`);
    }

    console.log("\n🎯 Next Steps:");
    console.log("   1. 🌐 Open the Frontend URL above in your browser");
    console.log("   2. 📱 Test the survey interface and submit answers");
    console.log("   3. 🔍 Check CloudWatch logs if you encounter issues");
    console.log("   4. 🧪 Test API endpoints directly via API Gateway URL");

  } catch (error) {
    console.error("❌ Failed to get deployment summary:", error);
    console.log("🎉 Application deployment completed, but couldn't retrieve URLs");
  }
}

main().catch((err) => {
  console.error("Command failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
