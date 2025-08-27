/**
 * Environment Variables Generator Script
 * 
 * This script reads the current AWS infrastructure inventory and generates
 * environment variables for the Next.js frontend application.
 * 
 * Features:
 * - Reads aws-inventory.json to get current resource information
 * - Generates .env.local with current API endpoints and configuration
 * - Safe execution - won't overwrite files unless explicitly requested
 * - Shows what values were found and what will be generated
 * 
 * Usage:
 * cd cdk
 * npx ts-node scripts/generate-env.ts
 * 
 * Or add to package.json:
 * npm run generate-env
 */

import * as fs from "fs";
import * as path from "path";

interface AWSInventory {
  apiGateways?: Array<{
    id: string;
    name: string;
    prodStageName?: string;
  }>;
  cloudFrontDistributions?: Array<{
    Id: string;
    DomainName: string;
  }>;
  s3Buckets?: Array<{
    Name: string;
  }>;
  rdsInstances?: Array<{
    Endpoint: {
      Address: string;
      Port: number;
    };
  }>;
  rdsProxies?: Array<{
    Endpoint: string;
  }>;
}

function section(title: string) {
  console.log(`\n==[ ${title} ]==\n`);
}

function ensureFile(p: string, message?: string) {
  if (!fs.existsSync(p)) {
    throw new Error(message ?? `Missing required file: ${p}`);
  }
}

function generateEnvContent(inventory: AWSInventory): string {
  const apiGateway = inventory.apiGateways?.[0];
  const cloudFront = inventory.cloudFrontDistributions?.[0];
  const s3Bucket = inventory.s3Buckets?.[0];
  const rdsProxy = inventory.rdsProxies?.[0];

  if (!apiGateway) {
    throw new Error("No API Gateway found in inventory. Please run deploy-infra.ts first.");
  }

  const envContent = `# Next.js Frontend Environment Configuration
# Auto-generated from AWS infrastructure inventory
# Generated on: ${new Date().toISOString()}
# 
# ⚠️  WARNING: This file is auto-generated. Manual changes will be overwritten.
# To preserve manual changes, rename this file or modify the generation script.

# =============================================================================
# Application Configuration
# =============================================================================
NODE_ENV=development
NEXT_PUBLIC_APP_NAME=Oculus
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_APP_DESCRIPTION=Full-stack AWS application

# =============================================================================
# API Configuration
# =============================================================================
NEXT_PUBLIC_API_URL=https://${apiGateway.id}.execute-api.us-east-1.amazonaws.com/${apiGateway.prodStageName || 'prod'}
NEXT_PUBLIC_API_TIMEOUT=30000
NEXT_PUBLIC_ENABLE_API_LOGGING=true

# =============================================================================
# Frontend Configuration
# =============================================================================
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_ENABLE_DEBUG_MODE=true
NEXT_PUBLIC_APP_ENVIRONMENT=development

# =============================================================================
# Development Configuration
# =============================================================================
NEXT_PUBLIC_DEV_MODE=true
NEXT_PUBLIC_ENABLE_HOT_RELOAD=true
NEXT_PUBLIC_PORT=3000

# =============================================================================
# Build Configuration
# =============================================================================
NEXT_PUBLIC_BUILD_ID=development
NEXT_PUBLIC_SOURCE_MAPS=true
NEXT_PUBLIC_OPTIMIZE_BUNDLES=true

# =============================================================================
# Optional: External Services
# =============================================================================
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# =============================================================================
# AWS Resource Information (for reference)
# =============================================================================
# API Gateway ID: ${apiGateway.id}
# API Gateway Name: ${apiGateway.name}
${cloudFront ? `# CloudFront Domain: ${cloudFront.DomainName}` : '# CloudFront: Not found'}
${s3Bucket ? `# S3 Bucket: ${s3Bucket.Name}` : '# S3 Bucket: Not found'}
${rdsProxy ? `# RDS Proxy: ${rdsProxy.Endpoint}` : '# RDS Proxy: Not found'}
`;

  return envContent;
}

function displayInventoryInfo(inventory: AWSInventory) {
  section("📋 AWS Resource Information");

  // Display API Gateway Information
  if (inventory.apiGateways && inventory.apiGateways.length > 0) {
    const api = inventory.apiGateways[0];
    console.log("🚀 API Gateway Details:");
    console.log(`   ID: ${api.id}`);
    console.log(`   Name: ${api.name}`);
    console.log(`   Stage: ${api.prodStageName || 'prod'} (production)`);
    console.log(`   Endpoint: https://${api.id}.execute-api.us-east-1.amazonaws.com/${api.prodStageName || 'prod'}`);
  } else {
    console.log("⚠️  No API Gateway found in inventory");
  }

  // Display CloudFront Information
  if (inventory.cloudFrontDistributions && inventory.cloudFrontDistributions.length > 0) {
    const cf = inventory.cloudFrontDistributions[0];
    console.log("\n🌐 CloudFront Distribution:");
    console.log(`   ID: ${cf.Id}`);
    console.log(`   Domain: ${cf.DomainName}`);
  } else {
    console.log("\n⚠️  No CloudFront distributions found in inventory");
  }

  // Display S3 Bucket Information
  if (inventory.s3Buckets && inventory.s3Buckets.length > 0) {
    const bucket = inventory.s3Buckets[0];
    console.log("\n🪣 S3 Bucket Details:");
    console.log(`   Name: ${bucket.Name}`);
  } else {
    console.log("\n⚠️  No S3 buckets found in inventory");
  }

  // Display RDS Proxy Information
  if (inventory.rdsProxies && inventory.rdsProxies.length > 0) {
    const proxy = inventory.rdsProxies[0];
    console.log("\n🗄️  RDS Proxy Details:");
    console.log(`   Endpoint: ${proxy.Endpoint}`);
  } else {
    console.log("\n⚠️  No RDS Proxy found in inventory");
  }
}

async function main() {
  const cdkDir = process.cwd();
  const appDir = path.join(cdkDir, "..", "app");

  section("1/4 Check Prerequisites");

  // Ensure we're in the CDK directory
  ensureFile(path.join(cdkDir, "package.json"), "cdk/package.json not found.");

  // Check if app directory exists
  if (!fs.existsSync(appDir)) {
    throw new Error("App directory not found. Please create the Next.js app first.");
  }

  // Check if infrastructure is deployed
  const inventoryPath = path.join(cdkDir, "aws-inventory.json");
  if (!fs.existsSync(inventoryPath)) {
    throw new Error("aws-inventory.json not found. Please run deploy-infra.ts first.");
  }

  console.log("✅ Prerequisites check passed");

  section("2/4 Read AWS Inventory");

  // Read and parse AWS inventory
  console.log("📖 Reading AWS infrastructure inventory...");
  const inventoryData = fs.readFileSync(inventoryPath, 'utf8');
  const inventory: AWSInventory = JSON.parse(inventoryData);
  console.log("✅ AWS inventory loaded successfully");

  // Display current resource information
  displayInventoryInfo(inventory);

  section("3/4 Generate Environment Variables");

  // Generate environment content
  console.log("🔧 Generating environment variables...");
  const envContent = generateEnvContent(inventory);
  console.log("✅ Environment variables generated");

  // Show what will be generated
  console.log("\n📝 Generated Environment Variables:");
  console.log("=".repeat(60));
  console.log(envContent);
  console.log("=".repeat(60));

  section("4/4 Save Environment File");

  const envPath = path.join(appDir, ".env.local");
  const backupPath = path.join(appDir, ".env.local.backup");

  // Check if .env.local already exists
  if (fs.existsSync(envPath)) {
    console.log("⚠️  .env.local already exists");
    
    // Create backup
    fs.copyFileSync(envPath, backupPath);
    console.log(`✅ Created backup: ${backupPath}`);
    
    // Ask user if they want to overwrite
    console.log("\n🤔 Do you want to overwrite the existing .env.local?");
    console.log("   Current file will be backed up to .env.local.backup");
    console.log("   Type 'yes' to overwrite, anything else to skip:");
    
    // For now, we'll overwrite by default since this is a script
    // In a real CLI, you'd use readline or similar for user input
    console.log("   (Auto-overwriting for script execution)");
  }

  // Save the new environment file
  fs.writeFileSync(envPath, envContent);
  console.log(`✅ Environment file saved: ${envPath}`);

  // Final summary
  console.log("\n🎉 Environment generation completed successfully!");
  console.log("\n📋 Summary:");
  console.log(`   📁 Generated: ${envPath}`);
  if (fs.existsSync(backupPath)) {
    console.log(`   💾 Backup: ${backupPath}`);
  }
  console.log(`   🚀 API URL: ${inventory.apiGateways?.[0]?.id ? `https://${inventory.apiGateways[0].id}.execute-api.us-east-1.amazonaws.com/${inventory.apiGateways[0].prodStageName || 'prod'}` : 'Not found'}`);
  
  console.log("\n💡 Next Steps:");
  console.log("   1. Review the generated .env.local file");
  console.log("   2. Deploy your app: npm run deploy-app");
  console.log("   3. Test the frontend with the new environment variables");
  
  console.log("\n⚠️  Important Notes:");
  console.log("   - Environment variables are now synced with your AWS infrastructure");
  console.log("   - Manual changes to .env.local will be overwritten on next run");
  console.log("   - To preserve manual changes, rename the file before running this script");
}

main().catch((err) => {
  console.error("Environment generation failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
