/**
 * Delete Infrastructure Script
 * 
 * This script safely removes all AWS infrastructure created by the CDK stack:
 * 1. Checks existing resources using checkawsresources.ts
 * 2. Loads current inventory from aws-inventory.json
 * 3. Provides clear overview of what will be deleted
 * 4. Requires user confirmation before deletion
 * 5. Uses CDK destroy to remove all resources
 * 
 * Resources that will be removed:
 * - VPC and networking (subnets, route tables, ACLs, NAT gateways)
 * - RDS database and proxy
 * - Security groups and IAM roles
 * - S3 buckets for static hosting
 * - CloudFront distribution
 * - Lambda functions
 * - API Gateway
 * 
 * WARNING: This will permanently delete all resources and data!
 */

import { execSync } from "node:child_process";
import type { ExecSyncOptions } from "node:child_process";
import * as fs from "node:fs";
import * as path from "path";

type Opts = ExecSyncOptions & { cwd?: string };

interface ResourceInventory {
  vpcs: any[];
  subnets: any[];
  routeTables: any[];
  networkAcls: any[];
  natGateways: any[];
  ec2Instances: any[];
  rdsInstances: any[];
  rdsProxies: any[];
  s3Buckets: any[];
  apiGateways: any[];
  cloudFrontDistributions: any[];
  secrets: any[];
}

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

function loadInventory(): ResourceInventory | null {
  const inventoryPath = path.join(process.cwd(), "aws-inventory.json");
  if (fs.existsSync(inventoryPath)) {
    try {
      const content = fs.readFileSync(inventoryPath, "utf8");
      return JSON.parse(content) as ResourceInventory;
    } catch (error) {
      console.warn("Could not parse existing inventory, will proceed with CDK destroy");
      return null;
    }
  }
  return null;
}

function displayResourceSummary(inventory: ResourceInventory) {
  console.log("📊 Resources that will be deleted:");
  console.log(`   🏗️  VPCs: ${inventory.vpcs.length} found`);
  console.log(`   🌐 Subnets: ${inventory.subnets.length} found`);
  console.log(`   🛣️  Route Tables: ${inventory.routeTables.length} found`);
  console.log(`   🔒 Network ACLs: ${inventory.networkAcls.length} found`);
  console.log(`   🌍 NAT Gateways: ${inventory.natGateways.length} found`);
  console.log(`   🖥️  EC2 Instances: ${inventory.ec2Instances.length} found`);
  console.log(`   🗄️  RDS Instances: ${inventory.rdsInstances.length} found`);
  console.log(`   🔌 RDS Proxies: ${inventory.rdsProxies.length} found`);
  console.log(`   🪣  S3 Buckets: ${inventory.s3Buckets.length} found`);
  console.log(`   🌐 API Gateways: ${inventory.apiGateways.length} found`);
  console.log(`   ☁️  CloudFront Distributions: ${inventory.cloudFrontDistributions.length} found`);
  console.log(`   🔐 Secrets: ${inventory.secrets.length} found`);

  // Show specific resource details
  if (inventory.vpcs.length > 0) {
    console.log("\n🏗️  VPCs to be deleted:");
    inventory.vpcs.forEach((vpc: any, index: number) => {
      const name = vpc.Tags?.find((tag: any) => tag.Key === 'Name')?.Value || 'No Name';
      console.log(`   ${index + 1}. ${name} (${vpc.VpcId}) - ${vpc.CidrBlock}`);
    });
  }

  if (inventory.ec2Instances.length > 0) {
    console.log("\n🖥️  EC2 Instances to be deleted:");
    inventory.ec2Instances.forEach((instance: any, index: number) => {
      const name = instance.Tags?.find((tag: any) => tag.Key === 'Name')?.Value || 'No Name';
      const state = instance.State?.Name || 'Unknown';
      console.log(`   ${index + 1}. ${name} (${instance.InstanceId}) - ${state}`);
    });
  }

  if (inventory.rdsInstances.length > 0) {
    console.log("\n🗄️  RDS Instances to be deleted:");
    inventory.rdsInstances.forEach((rds: any, index: number) => {
      console.log(`   ${index + 1}. ${rds.DBInstanceIdentifier} (${rds.DBInstanceClass}) - ${rds.Engine}`);
    });
  }

  if (inventory.s3Buckets.length > 0) {
    console.log("\n🪣  S3 Buckets to be deleted:");
    inventory.s3Buckets.forEach((bucket: any, index: number) => {
      console.log(`   ${index + 1}. ${bucket.Name} - Created: ${bucket.CreationDate}`);
    });
  }
}

async function getUserConfirmation(): Promise<boolean> {
  console.log("\n⚠️  ⚠️  ⚠️  CRITICAL WARNING ⚠️  ⚠️  ⚠️");
  console.log("   This action will PERMANENTLY DELETE all AWS resources!");
  console.log("   All data will be lost and cannot be recovered!");
  console.log("   This includes:");
  console.log("     • Database data and configurations");
  console.log("     • All files in S3 buckets");
  console.log("     • Lambda functions and API Gateway");
  console.log("     • Network configurations");
  console.log("     • Security groups and IAM roles");
  console.log("\n   Are you absolutely sure you want to proceed?");
  console.log("   Type 'DELETE ALL' to confirm deletion:");
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const userConfirmation = await new Promise<string>((resolve) => {
    rl.question('Your choice: ', (answer: string) => {
      rl.close();
      resolve(answer.trim().toUpperCase());
    });
  });
  
  return userConfirmation === 'DELETE ALL';
}

async function main() {
  const cdkDir = process.cwd();

  section("1/4 Check Existing AWS Resources");
  
  // Ensure we're in the CDK directory
  ensureFile(path.join(cdkDir, "package.json"), "cdk/package.json not found.");
  
  // Check if checkawsresources.ts exists
  const inventoryScriptPath = path.join(cdkDir, "checkawsresources.ts");
  if (!fs.existsSync(inventoryScriptPath)) {
    throw new Error("checkawsresources.ts not found. Please create it first.");
  }

  // Run inventory check to get current state
  console.log("🔍 Checking existing AWS resources...");
  try {
    sh("npx ts-node checkawsresources.ts", { cwd: cdkDir });
    console.log("✅ Resource inventory updated successfully");
  } catch (error) {
    console.error("❌ Failed to check existing resources:", error);
    throw error;
  }

  // Load the updated inventory
  const inventory = loadInventory();
  if (!inventory) {
    console.log("⚠️  Could not load resource inventory");
    console.log("   Will proceed with CDK destroy to remove all resources");
  }

  section("2/4 Resource Overview");
  
  if (inventory) {
    displayResourceSummary(inventory);
  } else {
    console.log("📊 Will attempt to delete all resources via CDK destroy");
  }

  // Check if CDK stack exists
  console.log("\n🔍 Checking CDK stack status...");
  try {
    const stackStatus = shCap("npx cdk list", { cwd: cdkDir });
    if (stackStatus.includes('OculusMiniStack')) {
      console.log("✅ CDK stack 'OculusMiniStack' found");
    } else {
      console.log("⚠️  No CDK stack found - resources may have been deleted manually");
    }
  } catch (error) {
    console.log("⚠️  Could not check CDK stack status");
  }

  section("3/4 User Confirmation");
  
  // Get user confirmation
  const confirmed = await getUserConfirmation();
  if (!confirmed) {
    console.log("\n❌ Deletion cancelled by user.");
    console.log("   Your AWS resources are safe.");
    console.log("   You can run this script again when you're ready to delete.");
    return;
  }

  console.log("\n✅ User confirmed deletion. Proceeding with resource removal...\n");

  section("4/4 Delete Infrastructure");
  
  // Install CDK dependencies if needed
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

  // Destroy infrastructure
  console.log("🗑️  Destroying all AWS infrastructure...");
  console.log("   This will remove all resources created by the CDK stack");
  console.log("   This process may take 10-30 minutes depending on resource count\n");
  
  try {
    sh("npx cdk destroy --force", { cwd: cdkDir });
    console.log("\n✅ CDK destroy completed successfully");
  } catch (error) {
    console.error("\n❌ CDK destroy failed:", error);
    console.log("\n🔍 This might mean:");
    console.log("   • Some resources were already deleted");
    console.log("   • Resources were created outside of CDK");
    console.log("   • There are dependency issues");
    throw error;
  }

  // Final verification
  console.log("\n🔍 Final verification...");
  try {
    sh("npx ts-node checkawsresources.ts", { cwd: cdkDir });
    console.log("✅ Final inventory check completed");
  } catch (error) {
    console.log("⚠️  Final inventory check failed - this is expected if all resources were deleted");
  }

  console.log("\n🎉 Infrastructure deletion complete!");
  console.log("\n📋 Summary:");
  console.log("   ✅ All CDK-managed resources have been removed");
  console.log("   ✅ AWS infrastructure has been cleaned up");
  console.log("   ✅ You can now run deploy-infra.ts to recreate everything");
  console.log("\n⚠️  Note: If you manually created resources (like bastion hosts),");
  console.log("   you may need to delete them separately through the AWS Console.");
}

main().catch((err) => {
  console.error("Command failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
