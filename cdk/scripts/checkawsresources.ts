// cdk/checkawsresources.ts
// AWS Resource Inventory Script - Collects resources tagged with 'oculus' or containing 'oculus' in name

import * as AWS from 'aws-sdk';
import * as path from "path";

interface ResourceInventory {
  vpcs: AWS.EC2.Vpc[];
  subnets: AWS.EC2.Subnet[];
  routeTables: AWS.EC2.RouteTable[];
  networkAcls: AWS.EC2.NetworkAcl[];
  natGateways: AWS.EC2.NatGateway[];
  ec2Instances: AWS.EC2.Instance[];
  rdsInstances: AWS.RDS.DBInstance[];
  s3Buckets: AWS.S3.Bucket[];
}

class AWSResourceInventory {
  private ec2: AWS.EC2;
  private rds: AWS.RDS;
  private s3: AWS.S3;
  private region: string;

  constructor(region: string = 'us-east-1') {
    this.region = region;
    this.ec2 = new AWS.EC2({ region });
    this.rds = new AWS.RDS({ region });
    this.s3 = new AWS.S3({ region });
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

  private hasOculusTag(tags: AWS.EC2.Tag[] | AWS.RDS.Tag[] | AWS.S3.Tag[]): boolean {
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

    const [vpcs, subnets, routeTables, networkAcls, natGateways, ec2Instances, rdsInstances, s3Buckets] = await Promise.all([
      this.getVPCs(),
      this.getSubnets(),
      this.getRouteTables(),
      this.getNetworkAcls(),
      this.getNatGateways(),
      this.getEC2Instances(),
      this.getRDSInstances(),
      this.getS3Buckets()
    ]);

    return {
      vpcs,
      subnets,
      routeTables,
      networkAcls,
      natGateways,
      ec2Instances,
      rdsInstances,
      s3Buckets
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

    console.log(`\n🪣  S3 Buckets: ${inventory.s3Buckets.length}`);
    inventory.s3Buckets.forEach(bucket => {
      console.log(`   • ${bucket.Name} - Created: ${bucket.CreationDate}`);
    });

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
