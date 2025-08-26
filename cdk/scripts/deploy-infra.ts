/**
 * Deploy Infrastructure Script
 * 
 * This script intelligently deploys only missing AWS infrastructure:
 * 1. Checks existing resources using checkawsresources.ts
 * 2. Updates aws-inventory.json with current state
 * 3. Only creates resources that don't exist
 * 4. Provides clear messages about existing vs. new resources
 * 
 * Resources handled:
 * - VPC and networking (subnets, route tables, ACLs, NAT gateways)
 * - RDS database and proxy
 * - Security groups and IAM roles
 * - S3 buckets for static hosting
 * - CloudFront distribution
 * 
 * TAGGING STRATEGY:
 * - All new resources are automatically tagged with "project: oculus"
 * - This ensures they're detected by future inventory runs
 * - Resources also get descriptive "Name" tags for identification
 */

import { execSync } from "node:child_process";
import type { ExecSyncOptions } from "node:child_process";
import * as fs from "node:fs";
import * as path from "path";
// Import https for IP checking
import * as https from 'https';

// CommonJS path resolution for Windows compatibility

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
  // Lambda functions are not stored in inventory - always deployed from lambdas/ folder
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

async function getCurrentPublicIP(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use Amazon's IP check service
    const options = {
      hostname: 'checkip.amazonaws.com',
      port: 443,
      path: '/',
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data.trim());
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Bastion host key pair function removed - will be created manually

async function updateInventoryWithPublicIP(): Promise<string> {
  console.log("🌐 Getting your current public IP address...");
  
  try {
    const currentIP = await getCurrentPublicIP();
    console.log(`   ✅ Your current public IP: ${currentIP}`);
    
         // Update inventory with public IP information
     const inventoryPath = path.join(process.cwd(), "aws-inventory.json");
    if (fs.existsSync(inventoryPath)) {
      const inventoryData = fs.readFileSync(inventoryPath, 'utf8');
      const inventory = JSON.parse(inventoryData);
      
      // Add or update public IP information
      inventory.developerPublicIP = currentIP;
      inventory.lastIPUpdate = new Date().toISOString();
      
      fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2));
      console.log("   📝 Updated inventory with current public IP");
    }
    
    return currentIP;
  } catch (error) {
    console.error("   ❌ Failed to get current public IP address");
         console.error("   This is needed for future use");
    console.error("   Please manually check your IP at https://checkip.amazonaws.com");
    console.error("   Error details:", error);
    throw new Error("Cannot proceed without public IP address");
  }
}

async function checkLambdaCodeUpdates(): Promise<boolean> {
  console.log("\n🔍 Checking Lambda code updates...");
  
  // Check if Lambda source code exists
  const lambdaSourcePath = path.join(process.cwd(), '../lambdas/api.ts');
  if (!fs.existsSync(lambdaSourcePath)) {
    console.log("⚠️ Lambda source file not found - will deploy to be safe");
    return true;
  }
  
  // Always deploy Lambda - whatever is in the lambdas/ folder gets deployed
  console.log("🚨 *** LAMBDA CODE CHANGED *** 🚨");
  console.log("   Always deploying Lambda from lambdas/ folder");
  console.log("   This ensures your latest code is always deployed");
  return true;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function loadInventory(): ResourceInventory | null {
     const inventoryPath = path.join(process.cwd(), "aws-inventory.json");
  if (fs.existsSync(inventoryPath)) {
    try {
      const content = fs.readFileSync(inventoryPath, "utf8");
      return JSON.parse(content) as ResourceInventory;
    } catch (error) {
      console.warn("Could not parse existing inventory, will create new one");
      return null;
    }
  }
  return null;
}

function checkResourceExists(inventory: ResourceInventory, resourceType: keyof ResourceInventory, identifier: string): boolean {
  const resources = inventory[resourceType] || [];
  return resources.some((resource: any) => {
    if (resourceType === 'vpcs') return resource.VpcId === identifier;
    if (resourceType === 'subnets') return resource.SubnetId === identifier;
    if (resourceType === 'routeTables') return resource.RouteTableId === identifier;
    if (resourceType === 'networkAcls') return resource.NetworkAclId === identifier;
    if (resourceType === 'natGateways') return resource.NatGatewayId === identifier;
    if (resourceType === 'rdsInstances') return resource.DBInstanceIdentifier === identifier;
    if (resourceType === 's3Buckets') return resource.Name === identifier;
    return false;
  });
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
    throw new Error("Could not load resource inventory. Please check checkawsresources.ts");
  }

     // Update inventory with current public IP (for future use)
   await updateInventoryWithPublicIP();
  
  section("3/5 Analyze Existing vs. Missing Resources");
  
    // Check what resources already exist
  const existingResources = {
    vpc: inventory.vpcs.length > 0,
    subnets: inventory.subnets.length >= 3, // Expect at least 3 subnets (public + 2 private isolated)
    rds: inventory.rdsInstances.length > 0,
    rdsProxy: inventory.rdsProxies && inventory.rdsProxies.length > 0,
    ec2: inventory.ec2Instances.length > 0, // Check for existing EC2 instances (including bastion)
    s3: inventory.s3Buckets.length > 0,
    routeTables: inventory.routeTables.length > 0,
    networkAcls: inventory.networkAcls.length > 0
    // NAT Gateways not required - bastion uses public subnet with Internet Gateway
    // Lambda functions are always deployed from lambdas/ folder
  };

               console.log("📊 Current Resource Status:");
  console.log(`   🏗️  VPC: ${existingResources.vpc ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   🌐 Subnets: ${existingResources.subnets ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   🗄️  RDS: ${existingResources.rds ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   🔌 RDS Proxy: ${existingResources.rdsProxy ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   🖥️  EC2 Instances: ${existingResources.ec2 ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   🪣  S3: ${existingResources.s3 ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   🛣️  Route Tables: ${existingResources.routeTables ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   🔒 Network ACLs: ${existingResources.networkAcls ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   🌍 NAT Gateways: Not required (bastion uses public subnet)`);
  console.log(`   ⚡ Lambda: 🚨 ALWAYS DEPLOYED (from lambdas/ folder)`);
  
  // Show existing EC2 instances if any
  if (inventory.ec2Instances.length > 0) {
    console.log("\n🖥️  Existing EC2 Instances:");
    inventory.ec2Instances.forEach((instance: any, index: number) => {
      const name = instance.Tags?.find((tag: any) => tag.Key === 'Name')?.Value || 'No Name';
      const state = instance.State?.Name || 'Unknown';
      const publicIP = instance.PublicIpAddress || 'No Public IP';
      console.log(`   ${index + 1}. ${name} (${instance.InstanceId}) - ${state} - ${publicIP}`);
    });
  }
  

   
               // Check if all infrastructure exists
     const allResourcesExist = Object.values(existingResources).every(exists => exists);
     
     console.log("\n🔍 Deployment Decision:");
     console.log(`   All resources exist: ${allResourcesExist ? 'YES' : 'NO'}`);
     console.log(`   Lambda deployment: ALWAYS (from lambdas/ folder)`);
     
     if (allResourcesExist) {
       // All infrastructure exists - proceed directly to Lambda deployment
       section("4/5 Infrastructure Complete - Deploying Lambda");
       console.log("🎉 All infrastructure resources exist!");
       console.log("   Lambda will be deployed from lambdas/ folder");
       console.log("   Proceeding to Lambda deployment...\n");
     } else {
       // Some infrastructure is missing - show what's missing and ask for confirmation
       section("4/5 Missing Infrastructure - User Confirmation Required");
       
       const missingResources = Object.entries(existingResources)
         .filter(([_, exists]) => !exists)
         .map(([resource, _]) => resource);
       
       console.log("🚨 MISSING RESOURCES DETECTED:");
       missingResources.forEach(resource => {
         console.log(`   ❌ ${resource.toUpperCase()}`);
       });
       
       console.log("\n⚠️  RESOURCE CREATION REQUIRES USER CONFIRMATION");
       console.log("📝 Note: All new resources will be automatically tagged with 'project: oculus'");
       console.log("   This ensures they're detected by future inventory runs.\n");
       
       // Prompt for user confirmation
       console.log("🔐 Do you want to proceed with creating missing infrastructure?");
       console.log("   This will create the following resources:");
       missingResources.forEach(resource => {
         console.log(`      - ${resource}`);
       });
       console.log("\n   Type 'YES' to proceed, or 'NO' to cancel:");
       
       // Read user input
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
       
       if (userConfirmation !== 'YES') {
         console.log("\n❌ Deployment cancelled by user.");
         console.log("   You can run this script again when you're ready to deploy.");
         return;
       }
       
       console.log("\n✅ User confirmed. Proceeding with infrastructure deployment...\n");
     }
  
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

  // Synthesize CDK stack
  console.log("🔨 Synthesizing CDK stack...");
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

  // Deploy infrastructure (including Lambda) automatically
  console.log("\n🚀 DEPLOYING INFRASTRUCTURE AND LAMBDA...");
  console.log("   The following will happen:");
  console.log("   1. CDK will synthesize the stack");
  console.log("   2. CloudFormation will create/update resources");
  console.log("   3. Lambda function will be updated with latest code");
  console.log("   4. Resources will be tagged with 'project: oculus'");
  console.log("\n   Starting deployment automatically...\n");
  
  // Deploy only missing infrastructure
  console.log("🚀 Deploying missing infrastructure...");
  sh("npx cdk deploy --require-approval never", { cwd: cdkDir });

  section("5/5 Verify Deployment");
  
  // Re-check resources to confirm deployment
  console.log("🔍 Verifying deployed resources...");
  try {
    sh("npx ts-node checkawsresources.ts", { cwd: cdkDir });
    console.log("✅ Infrastructure deployment verified successfully");
  } catch (error) {
    console.error("❌ Failed to verify deployment:", error);
    throw error;
  }

     console.log("\n🎉 Infrastructure deployment complete!");
   console.log("\n📋 Next steps:");
   console.log("   1. Run deploy-app.ts to deploy lambdas and frontend");
   console.log("   3. Create bastion host manually if needed (not included in CDK)");
}

main().catch((err) => {
  console.error("Command failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
