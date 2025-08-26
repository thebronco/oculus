// cdk/checkawsresources.ts
// AWS Resource Inventory Script - Collects resources tagged with 'oculus' or containing 'oculus' in name

import * as AWS from 'aws-sdk';
import * as path from "path";

interface APIGatewayWithDeployment extends AWS.APIGateway.RestApi {
  hasProdDeployment: boolean;
  prodStageName?: string;
  prodStageDescription?: string;
}

interface ResourceInventory {
  vpcs: AWS.EC2.Vpc[];
  subnets: AWS.EC2.Subnet[];
  routeTables: AWS.EC2.RouteTable[];
  networkAcls: AWS.EC2.NetworkAcl[];
  natGateways: AWS.EC2.NatGateway[];
  ec2Instances: AWS.EC2.Instance[];
  rdsInstances: AWS.RDS.DBInstance[];
  rdsProxies: AWS.RDS.DBProxy[];
  lambdaFunctions: AWS.Lambda.FunctionConfiguration[];
  apiGateways: APIGatewayWithDeployment[];
  secrets: AWS.SecretsManager.SecretListEntry[];
  s3Buckets: AWS.S3.Bucket[];
  cloudFrontDistributions: AWS.CloudFront.DistributionSummary[];
}

class AWSResourceInventory {
  private ec2: AWS.EC2;
  private rds: AWS.RDS;
  private lambda: AWS.Lambda;
  private apigateway: AWS.APIGateway;
  private secretsmanager: AWS.SecretsManager;
  private s3: AWS.S3;
  private cloudfront: AWS.CloudFront;
  private region: string;

  constructor(region: string = 'us-east-1') {
    this.region = region;
    this.ec2 = new AWS.EC2({ region });
    this.rds = new AWS.RDS({ region });
    this.lambda = new AWS.Lambda({ region });
    this.apigateway = new AWS.APIGateway({ region });
    this.secretsmanager = new AWS.SecretsManager({ region });
    this.s3 = new AWS.S3({ region });
    this.cloudfront = new AWS.CloudFront({ region });
  }

  private async getVPCs(): Promise<AWS.EC2.Vpc[]> {
    try {
      const response = await this.ec2.describeVpcs({}).promise();
      console.log(`✓ Retrieved Vpcs`);
      const vpcs = response.Vpcs || [];
      
      return this.filterOculusResources(
        vpcs,
        (vpc) => vpc.Tags?.find(tag => tag.Key === 'Name')?.Value || '',
        (vpc) => vpc.Tags || []
      );
    } catch (error) {
      console.error(`✗ Error retrieving Vpcs:`, error);
      return [];
    }
  }

  private async getSubnets(): Promise<AWS.EC2.Subnet[]> {
    try {
      const response = await this.ec2.describeSubnets({}).promise();
      console.log(`✓ Retrieved Subnets`);
      const subnets = response.Subnets || [];
      
      // For subnets, we need to check both the subnet itself and its associated VPC
      const filteredSubnets: AWS.EC2.Subnet[] = [];
      
      for (const subnet of subnets) {
        // Check if subnet name contains 'oculus'
        const subnetName = subnet.Tags?.find(tag => tag.Key === 'Name')?.Value || '';
        if (subnetName.toLowerCase().includes('oculus')) {
          filteredSubnets.push(subnet);
          continue;
        }
        
        // Check if subnet tags contain 'oculus'
        if (this.hasOculusTag(subnet.Tags || [])) {
          filteredSubnets.push(subnet);
          continue;
        }
        
        // Check if associated VPC name contains 'oculus'
        if (subnet.VpcId) {
          try {
            const vpcResponse = await this.ec2.describeVpcs({ VpcIds: [subnet.VpcId] }).promise();
            const vpc = vpcResponse.Vpcs?.[0];
            if (vpc) {
              const vpcName = vpc.Tags?.find(tag => tag.Key === 'Name')?.Value || '';
              if (vpcName.toLowerCase().includes('oculus')) {
                filteredSubnets.push(subnet);
                continue;
              }
              
              // Also check VPC tags
              if (this.hasOculusTag(vpc.Tags || [])) {
                filteredSubnets.push(subnet);
                continue;
              }
            }
          } catch (vpcError) {
            // If we can't get VPC details, continue to next subnet
          }
        }
      }
      
      return filteredSubnets;
    } catch (error) {
      console.error(`✗ Error retrieving Subnets:`, error);
      return [];
    }
  }

  private async getRouteTables(): Promise<AWS.EC2.RouteTable[]> {
    try {
      const response = await this.ec2.describeRouteTables({}).promise();
      console.log(`✓ Retrieved RouteTables`);
      const routeTables = response.RouteTables || [];
      
      // For route tables, we need to check both the route table itself and its associated VPC
      const filteredRouteTables: AWS.EC2.RouteTable[] = [];
      
      for (const rt of routeTables) {
        // Check if route table name contains 'oculus'
        const routeTableName = rt.Tags?.find(tag => tag.Key === 'Name')?.Value || '';
        if (routeTableName.toLowerCase().includes('oculus')) {
          filteredRouteTables.push(rt);
          continue;
        }
        
        // Check if route table tags contain 'oculus'
        if (this.hasOculusTag(rt.Tags || [])) {
          filteredRouteTables.push(rt);
          continue;
        }
        
        // Check if associated VPC name contains 'oculus'
        if (rt.VpcId) {
          try {
            const vpcResponse = await this.ec2.describeVpcs({ VpcIds: [rt.VpcId] }).promise();
            const vpc = vpcResponse.Vpcs?.[0];
            if (vpc) {
              const vpcName = vpc.Tags?.find(tag => tag.Key === 'Name')?.Value || '';
              if (vpcName.toLowerCase().includes('oculus')) {
                filteredRouteTables.push(rt);
                continue;
              }
              
              // Also check VPC tags
              if (this.hasOculusTag(vpc.Tags || [])) {
                filteredRouteTables.push(rt);
                continue;
              }
            }
          } catch (vpcError) {
            // If we can't get VPC details, continue to next route table
          }
        }
      }
      
      return filteredRouteTables;
    } catch (error) {
      console.error(`✗ Error retrieving RouteTables:`, error);
      return [];
    }
  }

  private async getNetworkAcls(): Promise<AWS.EC2.NetworkAcl[]> {
    try {
      const response = await this.ec2.describeNetworkAcls({}).promise();
      console.log(`✓ Retrieved NetworkAcls`);
      const acls = response.NetworkAcls || [];
      
      // For network ACLs, we need to check both the ACL itself and its associated VPC
      const filteredAcls: AWS.EC2.NetworkAcl[] = [];
      
      for (const acl of acls) {
        // Check if ACL name contains 'oculus'
        const aclName = acl.Tags?.find(tag => tag.Key === 'Name')?.Value || '';
        if (aclName.toLowerCase().includes('oculus')) {
          filteredAcls.push(acl);
          continue;
        }
        
        // Check if ACL tags contain 'oculus'
        if (this.hasOculusTag(acl.Tags || [])) {
          filteredAcls.push(acl);
          continue;
        }
        
        // Check if associated VPC name contains 'oculus'
        if (acl.VpcId) {
          try {
            const vpcResponse = await this.ec2.describeVpcs({ VpcIds: [acl.VpcId] }).promise();
            const vpc = vpcResponse.Vpcs?.[0];
            if (vpc) {
              const vpcName = vpc.Tags?.find(tag => tag.Key === 'Name')?.Value || '';
              if (vpcName.toLowerCase().includes('oculus')) {
                filteredAcls.push(acl);
                continue;
              }
              
              // Also check VPC tags
              if (this.hasOculusTag(vpc.Tags || [])) {
                filteredAcls.push(acl);
                continue;
              }
            }
          } catch (vpcError) {
            // If we can't get VPC details, continue to next ACL
          }
        }
      }
      
      return filteredAcls;
    } catch (error) {
      console.error(`✗ Error retrieving NetworkAcls:`, error);
      return [];
    }
  }

  private async getNatGateways(): Promise<AWS.EC2.NatGateway[]> {
    try {
      const response = await this.ec2.describeNatGateways({}).promise();
      console.log(`✓ Retrieved NatGateways`);
      const nats = response.NatGateways || [];
      
      // For NAT gateways, we need to check both the NAT gateway itself and its associated VPC
      const filteredNats: AWS.EC2.NatGateway[] = [];
      
      for (const nat of nats) {
        // Check if NAT gateway name contains 'oculus'
        const natName = nat.Tags?.find(tag => tag.Key === 'Name')?.Value || '';
        if (natName.toLowerCase().includes('oculus')) {
          filteredNats.push(nat);
          continue;
        }
        
        // Check if NAT gateway tags contain 'oculus'
        if (this.hasOculusTag(nat.Tags || [])) {
          filteredNats.push(nat);
          continue;
        }
        
        // Check if associated VPC name contains 'oculus' (via subnet)
        if (nat.SubnetId) {
          try {
            // First get the subnet to find the VPC
            const subnetResponse = await this.ec2.describeSubnets({ SubnetIds: [nat.SubnetId] }).promise();
            const subnet = subnetResponse.Subnets?.[0];
            if (subnet && subnet.VpcId) {
              const vpcResponse = await this.ec2.describeVpcs({ VpcIds: [subnet.VpcId] }).promise();
              const vpc = vpcResponse.Vpcs?.[0];
              if (vpc) {
                const vpcName = vpc.Tags?.find(tag => tag.Key === 'Name')?.Value || '';
                if (vpcName.toLowerCase().includes('oculus')) {
                  filteredNats.push(nat);
                  continue;
                }
                
                // Also check VPC tags
                if (this.hasOculusTag(vpc.Tags || [])) {
                  filteredNats.push(nat);
                  continue;
                }
              }
            }
          } catch (vpcError) {
            // If we can't get VPC details, continue to next NAT gateway
          }
        }
      }
      
      return filteredNats;
    } catch (error) {
      console.error(`✗ Error retrieving NatGateways:`, error);
      return [];
    }
  }

  private async getEC2Instances(): Promise<AWS.EC2.Instance[]> {
    try {
      const response = await this.ec2.describeInstances({}).promise();
      console.log(`✓ Retrieved Reservations`);
      const reservations = response.Reservations || [];
      
      // Flatten reservations to get instances
      const allInstances = reservations.flatMap(reservation => reservation.Instances || []);
      
      // For EC2 instances, we need to check both the instance itself and its associated VPC
      const filteredInstances: AWS.EC2.Instance[] = [];
      
      for (const instance of allInstances) {
        // Check if instance name contains 'oculus'
        const instanceName = instance.Tags?.find(tag => tag.Key === 'Name')?.Value || '';
        if (instanceName.toLowerCase().includes('oculus')) {
          filteredInstances.push(instance);
          continue;
        }
        
        // Check if instance tags contain 'oculus'
        if (this.hasOculusTag(instance.Tags || [])) {
          filteredInstances.push(instance);
          continue;
        }
        
        // Check if associated VPC name contains 'oculus' (via subnet)
        if (instance.SubnetId) {
          try {
            // First get the subnet to find the VPC
            const subnetResponse = await this.ec2.describeSubnets({ SubnetIds: [instance.SubnetId] }).promise();
            const subnet = subnetResponse.Subnets?.[0];
            if (subnet && subnet.VpcId) {
              const vpcResponse = await this.ec2.describeVpcs({ VpcIds: [subnet.VpcId] }).promise();
              const vpc = vpcResponse.Vpcs?.[0];
              if (vpc) {
                const vpcName = vpc.Tags?.find(tag => tag.Key === 'Name')?.Value || '';
                if (vpcName.toLowerCase().includes('oculus')) {
                  filteredInstances.push(instance);
                  continue;
                }
                
                // Also check VPC tags
                if (this.hasOculusTag(vpc.Tags || [])) {
                  filteredInstances.push(instance);
                  continue;
                }
              }
            }
          } catch (vpcError) {
            // If we can't get VPC details, continue to next instance
          }
        }
      }
      
      return filteredInstances;
    } catch (error) {
      console.error(`✗ Error retrieving Reservations:`, error);
      return [];
    }
  }

  private async getRDSInstances(): Promise<AWS.RDS.DBInstance[]> {
    try {
      const response = await this.rds.describeDBInstances({}).promise();
      console.log(`✓ Retrieved DBInstances`);
      const instances = response.DBInstances || [];
      
      return this.filterOculusResources(
        instances,
        (instance) => instance.DBInstanceIdentifier || '',
        (instance) => instance.TagList || []
      );
    } catch (error) {
      console.error(`✗ Error retrieving DBInstances:`, error);
      return [];
    }
  }

  private async getRDSProxies(): Promise<AWS.RDS.DBProxy[]> {
    try {
      const response = await this.rds.describeDBProxies({}).promise();
      console.log(`✓ Retrieved DBProxies`);
      const proxies = response.DBProxies || [];
      
      // Filter proxies by name containing 'oculus'
      return proxies.filter(proxy => {
        const proxyName = proxy.DBProxyName || '';
        return proxyName.toLowerCase().includes('oculus');
      });
    } catch (error) {
      console.error(`✗ Error retrieving DBProxies:`, error);
      return [];
    }
  }

  private async getLambdaFunctions(): Promise<AWS.Lambda.FunctionConfiguration[]> {
    try {
      const response = await this.lambda.listFunctions({}).promise();
      console.log(`✓ Retrieved Lambda Functions`);
      const functions = response.Functions || [];
      
      // Filter functions by name containing 'oculus'
      return functions.filter(func => {
        const functionName = func.FunctionName || '';
        return functionName.toLowerCase().includes('oculus');
      });
    } catch (error) {
      console.error(`✗ Error retrieving Lambda Functions:`, error);
      return [];
    }
  }

  private async getAPIGateways(): Promise<APIGatewayWithDeployment[]> {
    try {
      const response = await this.apigateway.getRestApis({}).promise();
      console.log(`✓ Retrieved API Gateways`);
      const apis = response.items || [];
      
      // Filter APIs by name containing 'oculus'
      const filteredApis = apis.filter(api => {
        const apiName = api.name || '';
        return apiName.toLowerCase().includes('oculus');
      });

      // For each API, check deployment status
      const apisWithDeploymentStatus = await Promise.all(
        filteredApis.map(async (api) => {
          try {
            // Get stages for this API to check production deployment
            const stagesResponse = await this.apigateway.getStages({ restApiId: api.id! }).promise();
            const stages = stagesResponse.item || [];
            
            // Check if there's a production stage
            const prodStage = stages.find(s => s.stageName === 'prod');
            
            // Add deployment status to API object
            return {
              ...api,
              hasProdDeployment: !!prodStage,
              prodStageName: prodStage?.stageName,
              prodStageDescription: prodStage?.description
            };
          } catch (deploymentError) {
            console.log(`   ⚠️ Could not check deployment status for API ${api.name}: ${deploymentError}`);
            return {
              ...api,
              hasProdDeployment: false,
              prodStageName: undefined,
              prodStageDescription: undefined
            };
          }
        })
      );

      return apisWithDeploymentStatus;
    } catch (error) {
      console.error(`✗ Error retrieving API Gateways:`, error);
      return [];
    }
  }

  private async getSecrets(): Promise<AWS.SecretsManager.SecretListEntry[]> {
    try {
      const response = await this.secretsmanager.listSecrets({}).promise();
      console.log(`✓ Retrieved Secrets`);
      const secrets = response.SecretList || [];
      
      // Filter secrets by name containing 'oculus' or 'db' or 'database'
      return secrets.filter(secret => {
        const secretName = secret.Name || '';
        const lowerName = secretName.toLowerCase();
        return lowerName.includes('oculus') || 
               lowerName.includes('db') || 
               lowerName.includes('database') ||
               lowerName.includes('secret');
      });
    } catch (error) {
      console.error(`✗ Error retrieving Secrets:`, error);
      return [];
    }
  }

  private async getS3Buckets(): Promise<AWS.S3.Bucket[]> {
    try {
      const response = await this.s3.listBuckets().promise();
      console.log(`✓ Retrieved S3 Buckets`);
      const buckets = response.Buckets || [];
      
      // For S3 buckets, we need to check tags individually since listBuckets doesn't return tags
      const bucketsWithTags: AWS.S3.Bucket[] = [];
      
      for (const bucket of buckets) {
        try {
          // Check if bucket name contains 'oculus'
          if (bucket.Name && bucket.Name.toLowerCase().includes('oculus')) {
            bucketsWithTags.push(bucket);
            continue;
          }
          
          // Try to get bucket tags
          const tagResponse = await this.s3.getBucketTagging({ Bucket: bucket.Name! }).promise();
          const tags = tagResponse.TagSet || [];
          
          if (this.hasOculusTag(tags)) {
            bucketsWithTags.push(bucket);
          }
        } catch (tagError) {
          // If we can't get tags (e.g., access denied), skip this bucket
          // This is common for buckets you don't own or have limited access to
        }
      }
      
      return bucketsWithTags;
    } catch (error) {
      console.error(`✗ Error retrieving S3 Buckets:`, error);
      return [];
    }
  }

  private async getCloudFrontDistributions(): Promise<AWS.CloudFront.DistributionSummary[]> {
    try {
      const response = await this.cloudfront.listDistributions().promise();
      console.log(`✓ Retrieved CloudFront Distributions`);
      const distributions = response.DistributionList?.Items || [];
      
      // For CloudFront, we need to check both the distribution name and its tags
      const distributionsWithTags: AWS.CloudFront.DistributionSummary[] = [];
      
      for (const distribution of distributions) {
        // Check if distribution comment/name contains 'oculus'
        if (distribution.Comment && this.hasOculusName(distribution.Comment)) {
          distributionsWithTags.push(distribution);
          continue;
        }
        
        // Check if distribution ID contains 'oculus'
        if (distribution.Id && this.hasOculusName(distribution.Id)) {
          distributionsWithTags.push(distribution);
          continue;
        }
        
        // Try to get distribution tags
        try {
          const tagResponse = await this.cloudfront.listTagsForResource({ Resource: distribution.ARN! }).promise();
          const tags = tagResponse.Tags?.Items || [];
          
          if (this.hasOculusTag(tags)) {
            distributionsWithTags.push(distribution);
          }
        } catch (tagError) {
          // If we can't get tags (e.g., access denied), skip this distribution
        }
      }
      
      return distributionsWithTags;
    } catch (error) {
      console.error(`✗ Error retrieving CloudFront Distributions:`, error);
      return [];
    }
  }

  private hasOculusTag(tags: AWS.EC2.Tag[] | AWS.RDS.Tag[] | AWS.S3.Tag[] | AWS.CloudFront.Tag[]): boolean {
    if (!tags) return false;
    return tags.some(tag => 
      tag.Key?.toLowerCase().includes('oculus') || 
      tag.Value?.toLowerCase().includes('oculus')
    );
  }

  private hasOculusName(name: string): boolean {
    return name?.toLowerCase().includes('oculus');
  }

  private filterOculusResources<T>(
    resources: T[], 
    nameExtractor: (resource: T) => string,
    tagsExtractor: (resource: T) => AWS.EC2.Tag[] | AWS.RDS.Tag[]
  ): T[] {
    return resources.filter(resource => {
      const name = nameExtractor(resource);
      const tags = tagsExtractor(resource);
      
      return this.hasOculusName(name) || this.hasOculusTag(tags);
    });
  }

  async collectInventory(): Promise<ResourceInventory> {
    console.log(`\n🔍 Collecting AWS Resource Inventory for region: ${this.region}`);
    console.log(`📋 Filtering for resources tagged with 'oculus' or containing 'oculus' in name\n`);

    const [vpcs, subnets, routeTables, networkAcls, natGateways, ec2Instances, rdsInstances, rdsProxies, lambdaFunctions, apiGateways, secrets, s3Buckets, cloudFrontDistributions] = await Promise.all([
      this.getVPCs(),
      this.getSubnets(),
      this.getRouteTables(),
      this.getNetworkAcls(),
      this.getNatGateways(),
      this.getEC2Instances(),
      this.getRDSInstances(),
      this.getRDSProxies(),
      this.getLambdaFunctions(),
      this.getAPIGateways(),
      this.getSecrets(),
      this.getS3Buckets(),
      this.getCloudFrontDistributions()
    ]);

    return {
      vpcs,
      subnets,
      routeTables,
      networkAcls,
      natGateways,
      ec2Instances,
      rdsInstances,
      rdsProxies,
      lambdaFunctions,
      apiGateways,
      secrets,
      s3Buckets,
      cloudFrontDistributions
    };
  }

  printInventory(inventory: ResourceInventory): void {
    console.log('\n📊 AWS Resource Inventory Summary');
    console.log('=====================================\n');

    console.log(`🏗️  VPCs: ${inventory.vpcs.length}`);
    inventory.vpcs.forEach(vpc => {
      const name = vpc.Tags?.find(tag => tag.Key === 'Name')?.Value || 'No Name';
      console.log(`   • ${vpc.VpcId} (${name}) - State: ${vpc.State}`);
    });

    console.log(`\n🌐 Subnets: ${inventory.subnets.length}`);
    inventory.subnets.forEach(subnet => {
      const name = subnet.Tags?.find(tag => tag.Key === 'Name')?.Value || 'No Name';
      console.log(`   • ${subnet.SubnetId} (${name}) - AZ: ${subnet.AvailabilityZone} - CIDR: ${subnet.CidrBlock}`);
    });

    console.log(`\n🛣️  Route Tables: ${inventory.routeTables.length}`);
    inventory.routeTables.forEach(rt => {
      const name = rt.Tags?.find(tag => tag.Key === 'Name')?.Value || 'No Name';
      console.log(`   • ${rt.RouteTableId} (${name}) - Routes: ${rt.Routes?.length || 0}`);
    });

    console.log(`\n🔒 Network ACLs: ${inventory.networkAcls.length}`);
    inventory.networkAcls.forEach(acl => {
      const name = acl.Tags?.find(tag => tag.Key === 'Name')?.Value || 'No Name';
      console.log(`   • ${acl.NetworkAclId} (${name}) - VPC: ${acl.VpcId}`);
    });

    console.log(`\n🌍 NAT Gateways: ${inventory.natGateways.length}`);
    inventory.natGateways.forEach(nat => {
      const name = nat.Tags?.find(tag => tag.Key === 'Name')?.Value || 'No Name';
      console.log(`   • ${nat.NatGatewayId} (${name}) - State: ${nat.State} - Subnet: ${nat.SubnetId}`);
    });

    console.log(`\n🖥️  EC2 Instances: ${inventory.ec2Instances.length}`);
    inventory.ec2Instances.forEach(instance => {
      const name = instance.Tags?.find(tag => tag.Key === 'Name')?.Value || 'No Name';
      console.log(`   • ${instance.InstanceId} (${name}) - Type: ${instance.InstanceType} - State: ${instance.State?.Name}`);
    });

    console.log(`\n🗄️  RDS Instances: ${inventory.rdsInstances.length}`);
    inventory.rdsInstances.forEach(instance => {
      console.log(`   • ${instance.DBInstanceIdentifier} - Engine: ${instance.Engine} - Status: ${instance.DBInstanceStatus}`);
    });

    console.log(`\n🔌 RDS Proxies: ${inventory.rdsProxies.length}`);
    inventory.rdsProxies.forEach(proxy => {
      console.log(`   • ${proxy.DBProxyName} - Status: ${proxy.Status} - Engine: ${proxy.EngineFamily}`);
    });

    console.log(`\n⚡ Lambda Functions: ${inventory.lambdaFunctions.length}`);
    inventory.lambdaFunctions.forEach(func => {
      console.log(`   • ${func.FunctionName} - Runtime: ${func.Runtime} - Status: ${func.State || 'Active'}`);
    });

    console.log(`\n🌐 API Gateways: ${inventory.apiGateways.length}`);
    inventory.apiGateways.forEach(api => {
      const deploymentStatus = api.hasProdDeployment ? '✅ PROD Deployed' : '❌ PROD Not Deployed';
      console.log(`   • ${api.name} (${api.id}) - ${deploymentStatus}`);
      if (api.hasProdDeployment) {
        console.log(`     Production Stage: ${api.prodStageName} - ${api.prodStageDescription || 'No description'}`);
      } else {
        console.log(`     ⚠️  API exists but not deployed to production stage`);
      }
    });

    console.log(`\n🔐 Secrets: ${inventory.secrets.length}`);
    inventory.secrets.forEach(secret => {
      console.log(`   • ${secret.Name} - Description: ${secret.Description || 'No description'}`);
      if (secret.LastChangedDate) {
        console.log(`     Last Changed: ${secret.LastChangedDate}`);
      }
    });

    console.log(`\n🪣  S3 Buckets: ${inventory.s3Buckets.length}`);
    inventory.s3Buckets.forEach(bucket => {
      console.log(`   • ${bucket.Name} - Created: ${bucket.CreationDate}`);
    });

    console.log(`\n🌐 CloudFront Distributions: ${inventory.cloudFrontDistributions.length}`);
    if (inventory.cloudFrontDistributions.length > 0) {
      inventory.cloudFrontDistributions.forEach(dist => {
        const comment = dist.Comment || 'No Comment';
        const status = dist.Status || 'Unknown';
        console.log(`   • ${dist.Id} (${comment}) - Status: ${status}`);
      });
    } else {
      console.log(`   ⚠️  No CloudFront distributions found`);
    }

    console.log('\n=====================================');
    console.log(`Total Resources Found: ${Object.values(inventory).reduce((sum, arr) => sum + arr.length, 0)}`);
  }
}

async function main() {
  try {
    // Get region from environment or default to us-east-1
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
    
    const inventory = new AWSResourceInventory(region);
    const resources = await inventory.collectInventory();
    inventory.printInventory(resources);

    // Optionally save to file
    const fs = await import('fs');
    const outputPath = path.join(__dirname, 'aws-inventory.json');
    fs.writeFileSync(outputPath, JSON.stringify(resources, null, 2));
    console.log(`\n💾 Detailed inventory saved to: ${outputPath}`);

  } catch (error) {
    console.error('❌ Error collecting inventory:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { AWSResourceInventory };
