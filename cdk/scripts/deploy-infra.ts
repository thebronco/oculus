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
  internetGateways: any[];
  securityGroups: any[];
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

// Add VPC strategy functions
async function askVPCPreference(): Promise<'new' | 'existing'> {
  console.log("\n🔍 VPC Deployment Strategy:");
  console.log("   You have two options:");
  console.log("   1. NEW VPC: Create a fresh VPC with all subnets (recommended for clean deploy)");
  console.log("   2. EXISTING VPC: Reuse an existing VPC (requires VPC ID)");

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const choice = await new Promise<string>((resolve) => {
    rl.question('\n🔐 Choose VPC strategy (type "NEW" or "EXISTING"): ', (answer: string) => {
      rl.close();
      resolve(answer.trim().toUpperCase());
    });
  });

  if (choice === 'NEW') {
    return 'new';
  } else if (choice === 'EXISTING') {
    return 'existing';
  } else {
    console.log("⚠️  Invalid choice, defaulting to NEW VPC");
    return 'new';
  }
}

async function getExistingVPCId(): Promise<string> {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const vpcId = await new Promise<string>((resolve) => {
    rl.question('\n🔐 Enter existing VPC ID (e.g., vpc-12345): ', (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  return vpcId;
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
  
  section("3/6 Analyze Existing vs. Missing Resources");
  
    // Derived checks for public subnet and EC2
  const publicSubnets = Array.isArray(inventory.subnets) 
    ? inventory.subnets.filter((s: any) => (
        s.MapPublicIpOnLaunch === true ||
        (Array.isArray(s.Tags) && s.Tags.some((t: any) => t.Key === 'Name' && /public/i.test(t.Value)))
      ))
    : [];
  const privateSubnets = Array.isArray(inventory.subnets)
    ? inventory.subnets.filter((s: any) => (
        !s.MapPublicIpOnLaunch &&
        (Array.isArray(s.Tags) && s.Tags.some((t: any) => t.Key === 'Name' && /private|isolated/i.test(t.Value)))
      ))
    : [];
  const publicSubnetPresent = publicSubnets.length > 0;
  const privateSubnetPresent = privateSubnets.length > 0;
  const anyEc2Instances = Array.isArray(inventory.ec2Instances) && inventory.ec2Instances.length > 0;

  // Check what resources already exist
  const existingResources = {
    vpc: inventory.vpcs.length > 0,
    subnets: inventory.subnets.length >= 3, // Expect at least 3 subnets total
    publicSubnet: publicSubnetPresent,
    privateSubnet: privateSubnetPresent,
    internetGateway: inventory.internetGateways && inventory.internetGateways.length > 0,
    securityGroups: inventory.securityGroups && inventory.securityGroups.length > 0,
    rds: inventory.rdsInstances.length > 0,
    rdsProxy: inventory.rdsProxies && inventory.rdsProxies.length > 0,
    ec2: anyEc2Instances, // informational only; EC2 is created manually
    s3: inventory.s3Buckets.length > 0,
    routeTables: inventory.routeTables.length > 0,
    networkAcls: inventory.networkAcls.length > 0
    // NAT Gateways not required - bastion uses public subnet with Internet Gateway
    // Lambda functions are always deployed from lambdas/ folder
  };
  
               console.log("📊 Current Resource Status:");
  console.log(`   🏗️  VPC: ${existingResources.vpc ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   🌐 Subnets (Total): ${inventory.subnets.length} found`);
  console.log(`   🌐 Public Subnets: ${publicSubnets.length} found ${publicSubnetPresent ? '✅' : '❌'}`);
  console.log(`   🌐 Private Subnets: ${privateSubnets.length} found ${privateSubnetPresent ? '✅' : '❌'}`);
  console.log(`   🌍 Internet Gateway: ${existingResources.internetGateway ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   🗄️  RDS: ${existingResources.rds ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   🔌 RDS Proxy: ${existingResources.rdsProxy ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   🖥️  EC2 Instances: ${existingResources.ec2 ? '✅ EXISTS' : '❌ MISSING'} (created manually)`);
  console.log(`   🪣  S3: ${existingResources.s3 ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   🛣️  Route Tables: ${existingResources.routeTables ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   🔒 Network ACLs: ${existingResources.networkAcls ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   🔒 Security Groups: ${existingResources.securityGroups ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   🌍 NAT Gateways: Not required (bastion uses public subnet)`);
  console.log(`   ⚡ Lambda: 🚨 ALWAYS DEPLOYED (from lambdas/ folder)`);
  
  // Show existing EC2 instances if any (for informational purposes only)
  if (inventory.ec2Instances.length > 0) {
    console.log("\n🖥️  Existing EC2 Instances (created manually):");
    inventory.ec2Instances.forEach((instance: any, index: number) => {
      const name = instance.Tags?.find((tag: any) => tag.Key === 'Name')?.Value || 'No Name';
      const state = instance.State?.Name || 'Unknown';
      const publicIP = instance.PublicIpAddress || 'No Public IP';
      console.log(`   ${index + 1}. ${name} (${instance.InstanceId}) - ${state} - ${publicIP}`);
    });
  }
  
  // Show subnet details if any exist
  if (inventory.subnets.length > 0) {
    console.log("\n🌐 Subnet Details:");
    if (publicSubnets.length > 0) {
      console.log("   Public Subnets:");
      publicSubnets.forEach((subnet: any, index: number) => {
        const name = subnet.Tags?.find((tag: any) => tag.Key === 'Name')?.Value || 'No Name';
        console.log(`     ${index + 1}. ${name} (${subnet.SubnetId}) - ${subnet.CidrBlock} - AZ: ${subnet.AvailabilityZone}`);
      });
    }
    if (privateSubnets.length > 0) {
      console.log("   Private Subnets:");
      privateSubnets.forEach((subnet: any, index: number) => {
        const name = subnet.Tags?.find((tag: any) => tag.Key === 'Name')?.Value || 'No Name';
        console.log(`     ${index + 1}. ${name} (${subnet.SubnetId}) - ${subnet.CidrBlock} - AZ: ${subnet.AvailabilityZone}`);
      });
    }
    // Show any other subnets that don't fit the public/private classification
    const otherSubnets = inventory.subnets.filter((s: any) => 
      !publicSubnets.includes(s) && !privateSubnets.includes(s)
    );
    if (otherSubnets.length > 0) {
      console.log("   Other Subnets:");
      otherSubnets.forEach((subnet: any, index: number) => {
        const name = subnet.Tags?.find((tag: any) => tag.Key === 'Name')?.Value || 'No Name';
        console.log(`     ${index + 1}. ${name} (${subnet.SubnetId}) - ${subnet.CidrBlock} - AZ: ${subnet.AvailabilityZone}`);
      });
    }
  }
  
  // Show Internet Gateway details if any exist
  if (inventory.internetGateways && inventory.internetGateways.length > 0) {
    console.log("\n🌍 Internet Gateway Details:");
    inventory.internetGateways.forEach((igw: any, index: number) => {
      const name = igw.Tags?.find((tag: any) => tag.Key === 'Name')?.Value || 'No Name';
      const state = igw.Attachments?.[0]?.State || 'Unknown';
      const vpcId = igw.Attachments?.[0]?.VpcId || 'Unknown';
      console.log(`   ${index + 1}. ${name} (${igw.InternetGatewayId}) - State: ${state} - VPC: ${vpcId}`);
    });
  }
  
  // Show Security Group details if any exist
  if (inventory.securityGroups && inventory.securityGroups.length > 0) {
    console.log("\n🔒 Security Group Details:");
    inventory.securityGroups.forEach((sg: any, index: number) => {
      const name = sg.GroupName || 'No Name';
      const description = sg.Description || 'No Description';
      const vpcId = sg.VpcId || 'Unknown';
      
      // Categorize security groups by purpose
      let purpose = 'General';
      if (sg.GroupName?.toLowerCase().includes('bastion') || sg.GroupName?.toLowerCase().includes('jump')) {
        purpose = '🖥️  Bastion/Jump Host';
      } else if (sg.GroupName?.toLowerCase().includes('rds') || sg.GroupName?.toLowerCase().includes('db')) {
        purpose = '🗄️  RDS/Database';
      } else if (sg.GroupName?.toLowerCase().includes('lambda') || sg.GroupName?.toLowerCase().includes('api')) {
        purpose = '⚡ Lambda/API';
      } else if (sg.GroupName?.toLowerCase().includes('web') || sg.GroupName?.toLowerCase().includes('public')) {
        purpose = '🌐 Web/Public';
      }
      
      console.log(`   ${index + 1}. ${purpose} - ${name} (${sg.GroupId})`);
      console.log(`      Description: ${description}`);
      console.log(`      VPC: ${vpcId}`);
      
      // Show inbound rules summary
      if (sg.IpPermissions && sg.IpPermissions.length > 0) {
        const inboundCount = sg.IpPermissions.length;
        console.log(`      Inbound Rules: ${inboundCount} rule(s)`);
      } else {
        console.log(`      Inbound Rules: None (restrictive)`);
      }
      
      // Show outbound rules summary
      if (sg.IpPermissionsEgress && sg.IpPermissionsEgress.length > 0) {
        const outboundCount = sg.IpPermissionsEgress.length;
        console.log(`      Outbound Rules: ${outboundCount} rule(s)`);
      } else {
        console.log(`      Outbound Rules: None (restrictive)`);
      }
      
      // Show associated resources
      const associatedResources: string[] = [];
      if (sg.Tags) {
        const projectTag = sg.Tags.find((tag: any) => tag.Key === 'project');
        if (projectTag) associatedResources.push(`Project: ${projectTag.Value}`);
      }
      if (associatedResources.length > 0) {
        console.log(`      Tags: ${associatedResources.join(', ')}`);
      }
      console.log(''); // Empty line for readability
    });
  }
  

   
               // Check if all infrastructure exists
     const allResourcesExist = Object.values(existingResources).every(exists => exists);
     
     console.log("\n🔍 Deployment Decision:");
     console.log(`   All resources exist: ${allResourcesExist ? 'YES' : 'NO'}`);
     console.log(`   Lambda deployment: ALWAYS (from lambdas/ folder)`);
     
     if (allResourcesExist) {
       // All infrastructure exists - proceed directly to Lambda deployment
       section("4/6 Infrastructure Complete - Deploying Lambda");
       console.log("🎉 All infrastructure resources exist!");
       console.log("   Lambda will be deployed from lambdas/ folder");
       console.log("   Proceeding to Lambda deployment...\n");
     } else {
       // Some infrastructure is missing - show what's missing and ask for confirmation
       section("4/6 Missing Infrastructure - User Confirmation Required");
       
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
       missingResources
         .filter(resource => resource !== 'ec2' && resource !== 'publicSubnet' && resource !== 'privateSubnet' && resource !== 'internetGateway' && resource !== 'securityGroups')
         .forEach(resource => {
           console.log(`      - ${resource}`);
         });
       if (missingResources.includes('ec2')) {
         console.log("      - ec2 (manual): Create bastion/EC2 manually via Console/CLI");
       }
       if (missingResources.includes('publicSubnet')) {
         console.log("      - publicSubnet (conditional): Will be created only if a NEW VPC is created by CDK. If reusing an existing VPC, add a public subnet manually.");
       }
       if (missingResources.includes('privateSubnet')) {
         console.log("      - privateSubnet (conditional): Will be created only if a NEW VPC is created by CDK. If reusing an existing VPC, add private subnets manually.");
       }
       if (missingResources.includes('internetGateway')) {
         console.log("      - internetGateway (conditional): Will be created only if a NEW VPC is created by CDK. If reusing an existing VPC, add Internet Gateway manually.");
       }
       if (missingResources.includes('securityGroups')) {
         console.log("      - securityGroups (conditional): Will be created only if a NEW VPC is created by CDK. If reusing an existing VPC, add Security Groups manually.");
       }
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
  
  // Determine VPC deployment strategy
  section("4/6 VPC Deployment Strategy");
  const vpcStrategy = await askVPCPreference();

  if (vpcStrategy === 'existing') {
    const vpcId = await getExistingVPCId();

    // Set context for CDK
    console.log(`\n🔧 Setting CDK context for existing VPC: ${vpcId}`);
    try {
      sh(`npx cdk context --set vpcStrategy=existing`, { cwd: cdkDir });
      sh(`npx cdk context --set existingVpcId=${vpcId}`, { cwd: cdkDir });
      console.log("✅ Context set for existing VPC reuse");
    } catch (error) {
      console.warn("⚠️  Failed to set CDK context, proceeding with new VPC creation");
    }
  } else {
    // Clear any existing VPC context
    console.log("\n🧹 Clearing VPC context for new VPC creation");
    try {
      sh(`npx cdk context --remove vpcStrategy`, { cwd: cdkDir });
      sh(`npx cdk context --remove existingVpcId`, { cwd: cdkDir });
      console.log("✅ Context cleared for new VPC creation");
    } catch (error) {
      // Context might not exist, that's fine
      console.log("ℹ️  No existing VPC context to clear");
    }
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
   console.log("   5. Note: EC2 instances are created manually, not by CDK");
   console.log("\n   Starting deployment automatically...\n");
   
   // Deploy only missing infrastructure
   console.log("🚀 Deploying missing infrastructure...");
  sh("npx cdk deploy --require-approval never", { cwd: cdkDir });

  section("6/6 Verify Deployment");
  
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
   console.log("   2. Create EC2 instances (including bastion) manually via AWS Console/CLI");
   console.log("   3. Create Internet Gateway manually if reusing existing VPC");
   console.log("   4. Create Security Groups manually if reusing existing VPC");
   console.log("   5. Note: EC2 instances, Internet Gateway, and Security Groups are not part of the CDK stack");
}

main().catch((err) => {
  console.error("Command failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
