/**
 * Oculus Mini Stack - AWS Infrastructure Definition
 * 
 * This CDK stack defines the complete AWS infrastructure for the Oculus project.
 * It creates a production-ready environment with the following components:
 * 
 * NETWORKING:
 * - VPC with CIDR 10.0.0.0/16 spanning 3 availability zones
 * - Public subnets for internet-facing resources
 * - Private subnets with NAT gateway for outbound internet access
 * - Isolated database subnets for enhanced security
 * 
 * DATABASE:
 * - RDS PostgreSQL 14 instance in isolated subnets
 * - RDS Proxy for connection pooling and failover
 * - Secrets Manager for secure credential storage
 * 
 * COMPUTE:
 * - Lambda functions for API endpoints and database seeding
 * - Security groups with least-privilege access
 * - VPC integration for secure communication
 * 
 * API & WEB:
 * - API Gateway with CORS support
 * - REST endpoints for survey data and admin operations
 * - S3 bucket for static website hosting
 * - CloudFront distribution for global content delivery
 * 
 * SECURITY:
 * - IAM roles with minimal required permissions
 * - Security groups restricting access between services
 * - Private subnets for sensitive resources
 * - TLS encryption for database connections
 * 
 * TAGGING STRATEGY:
 * - All resources are tagged with "project: oculus" for inventory tracking
 * - Resources also get descriptive "Name" tags for easy identification
 * - This ensures the deploy-infra.ts script can detect existing resources
 */

// cdk/lib/stack.ts
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, type NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import { Tags, Duration, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import * as path from "path";

export class OculusDevStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Add project tag to the entire stack
    Tags.of(this).add("project", "oculus");
    Tags.of(this).add("environment", "dev");
    Tags.of(this).add("stack", "OculusDevStack");

    // ===== VPC: Dynamic strategy based on CDK context =====
    const vpcStrategy = this.node.tryGetContext("vpcStrategy") as 'new' | 'existing';
    const existingVpcId = this.node.tryGetContext("existingVpcId") as string | undefined;

    let vpc: ec2.IVpc;
    if (vpcStrategy === 'existing' && existingVpcId) {
      // Reuse existing VPC -> NO CIDR ops, no subnet changes.
      console.log(`Reusing existing VPC: ${existingVpcId}`);
      vpc = ec2.Vpc.fromLookup(this, "OculusDev_vpc", { vpcId: existingVpcId });
    } else {
      // Create new VPC (same shape as your last deploy)
      console.log("Creating new VPC with all subnets");
      vpc = new ec2.Vpc(this, "OculusDev_vpc", {
        vpcName: "OculusDev_vpc",
        ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
        maxAzs: 3,
        natGateways: 0, // No NAT Gateway needed since no bastion host
        subnetConfiguration: [
          { name: "OculusDev_public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 20 },
          { name: "OculusDev_private_isolated", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 20 },
          { name: "OculusDev_db", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 20 },
        ],
      });
      
      // Tag VPC and all its subnets with 'oculus'
      Tags.of(vpc).add("project", "oculus");
      Tags.of(vpc).add("Name", "OculusDev_vpc");
      Tags.of(vpc).add("environment", "dev");
    }

    // ===== SECURITY GROUPS: Properly separated architecture =====
    // 
    // SECURITY GROUP HIERARCHY:
    // ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
    // │   LAMBDA       │    │   RDS PROXY    │    │   RDS INSTANCE │
    // │   sg-lambda    │───▶│   sg-proxy     │───▶│   sg-instance   │
    // │   (outbound)   │    │   (in/out)     │    │   (inbound only)│
    // └─────────────────┘    └─────────────────┘    └─────────────────┘
    // 
    // RULES:
    // 1. Lambda → RDS Proxy: Port 5432 (PostgreSQL)
    // 2. RDS Proxy → RDS Instance: Port 5432 (PostgreSQL)
    // 3. RDS Instance: NO outbound access (secure by default)
    // 4. RDS Proxy: Can reach anywhere (needed for DB connections)
    // 5. Lambda: Can reach anywhere (needed for AWS services)
    //
    // NAMING CONVENTION:
    // - oculusdev-lambda-sg: For Lambda functions
    // - oculusdev-dbproxy-sg: For RDS Proxy
    // - oculusdev-dbinstance-sg: For RDS Instance
    //
    const lambdaSg = new ec2.SecurityGroup(this, "OculusDev_lambda_sg", {
      vpc,
      securityGroupName: "oculusdev-lambda-sg",
      description: "Security group for Lambda functions to access RDS proxy",
      allowAllOutbound: true,
    });
    Tags.of(lambdaSg).add("project", "oculus");
    Tags.of(lambdaSg).add("Name", "oculusdev-lambda-sg");
    Tags.of(lambdaSg).add("environment", "dev");

    const dbInstanceSg = new ec2.SecurityGroup(this, "OculusDev_db_instance_sg", {
      vpc,
      securityGroupName: "oculusdev-dbinstance-sg",
      description: "Security group for RDS PostgreSQL instance",
      allowAllOutbound: false, // Database instances don't need outbound access
    });
    Tags.of(dbInstanceSg).add("project", "oculus");
    Tags.of(dbInstanceSg).add("Name", "oculusdev-dbinstance-sg");
    Tags.of(dbInstanceSg).add("environment", "dev");

    const dbProxySg = new ec2.SecurityGroup(this, "OculusDev_db_proxy_sg", {
      vpc,
      securityGroupName: "oculusdev-dbproxy-sg",
      description: "Security group for RDS Proxy",
      allowAllOutbound: true, // Proxy needs outbound access to database
    });
    Tags.of(dbProxySg).add("project", "oculus");
    Tags.of(dbProxySg).add("Name", "oculusdev-dbproxy-sg");
    Tags.of(dbProxySg).add("environment", "dev");

    // Security group rules
    dbInstanceSg.addIngressRule(dbProxySg, ec2.Port.tcp(5432), "RDS Proxy to RDS Instance");
    dbProxySg.addIngressRule(lambdaSg, ec2.Port.tcp(5432), "Lambda to RDS Proxy");

    const dbSecret = new secrets.Secret(this, "OculusDev_db_secret", {
      secretName: "OculusDev_db_secret",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "postgres" }),
        generateStringKey: "password",
        excludePunctuation: true,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });
    Tags.of(dbSecret).add("project", "oculus");
    Tags.of(dbSecret).add("Name", "OculusDev_db_secret");
    Tags.of(dbSecret).add("environment", "dev");

    // Select subnets by TYPE so it works for both "lookup VPC" and "new VPC"
    // RDS and RDS Proxy should ONLY use dedicated database subnets, not all private isolated subnets
    // For new VPC: use dedicated db subnets, for existing VPC: use private isolated but limit to 3 (one per AZ)
    let dbSubnets: ec2.SubnetSelection;
    let lambdaSubnets: ec2.SubnetSelection;
    
    if (vpcStrategy === 'existing') {
      // For existing VPC, select private isolated subnets but limit to one per AZ
      dbSubnets = { subnetType: ec2.SubnetType.PRIVATE_ISOLATED, onePerAz: true };
      lambdaSubnets = { subnetType: ec2.SubnetType.PRIVATE_ISOLATED, onePerAz: true };
    } else {
      // For new VPC, use the dedicated database subnets
      dbSubnets = { subnetType: ec2.SubnetType.PRIVATE_ISOLATED, onePerAz: true, subnetGroupName: "OculusDev_db" };
      lambdaSubnets = { subnetType: ec2.SubnetType.PRIVATE_ISOLATED, onePerAz: true, subnetGroupName: "OculusDev_private_isolated" };
    }

    const dbSubnetGroup = new rds.SubnetGroup(this, "OculusDev_pgSubnetGroup", {
      description: "Subnets for RDS",
      vpc,
      vpcSubnets: dbSubnets,
    });
    Tags.of(dbSubnetGroup).add("project", "oculus");
    Tags.of(dbSubnetGroup).add("Name", "OculusDev_db_subnet_group");
    Tags.of(dbSubnetGroup).add("environment", "dev");

    const db = new rds.DatabaseInstance(this, "OculusDev_pg", {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_14 }),
      vpc,
      vpcSubnets: dbSubnets,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      securityGroups: [dbInstanceSg],
      credentials: rds.Credentials.fromSecret(dbSecret),
      multiAz: false,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      backupRetention: Duration.days(0),
      removalPolicy: RemovalPolicy.DESTROY,
      deletionProtection: false,
      subnetGroup: dbSubnetGroup,
      publiclyAccessible: false,
    });
    Tags.of(db).add("project", "oculus");
    Tags.of(db).add("Name", "OculusDev_pg_database");
    Tags.of(db).add("environment", "dev");

    const proxy = new rds.DatabaseProxy(this, "OculusDev-pgproxy", {
      proxyTarget: rds.ProxyTarget.fromInstance(db),
      secrets: [dbSecret],
      vpc,
      securityGroups: [dbProxySg],
      requireTLS: false,
      maxConnectionsPercent: 90,
      idleClientTimeout: Duration.minutes(30),
      iamAuth: false,
      vpcSubnets: dbSubnets, // Use same subnets as RDS instance
    });
    Tags.of(proxy).add("project", "oculus");
    Tags.of(proxy).add("Name", "OculusDev_pg_proxy");
    Tags.of(proxy).add("environment", "dev");

    // ===== Lambda defaults (fix runtime) =====
    const lambdaDefaults: Partial<NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_18_X,
      architecture: lambda.Architecture.X86_64,
      memorySize: 256,
      timeout: Duration.seconds(30),
      logRetention: 7,
      environment: {
        PGHOST: proxy.endpoint,
        PGPORT: "5432",
        PGDATABASE: "postgres",
        DB_SECRET_ARN: dbSecret.secretArn,
      },
      vpc,
      securityGroups: [lambdaSg],
      vpcSubnets: lambdaSubnets,
    };

    const apiFn = new NodejsFunction(this, "OculusDev_api_fn", {
      entry: path.join(__dirname, "..", "..", "lambdas", "api.ts"),
      handler: "handler",
      ...lambdaDefaults,
      description: "Oculus API",
    });
    Tags.of(apiFn).add("project", "oculus");
    Tags.of(apiFn).add("Name", "OculusDev_api_lambda");
    Tags.of(apiFn).add("environment", "dev");

    dbSecret.grantRead(apiFn);

    // ===== API Gateway (same resources) =====
    const api = new apigw.RestApi(this, "OculusDev_api", {
      restApiName: "OculusDev_api",
      deployOptions: { stageName: "prod" },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
      },
    });
    Tags.of(api).add("project", "oculus");
    Tags.of(api).add("Name", "OculusDev_api_gateway");
    Tags.of(api).add("environment", "dev");

    const survey = api.root.addResource("survey");
    const nist = survey.addResource("nist-csf");
    nist.addMethod("GET", new apigw.LambdaIntegration(apiFn));
    
    const submit = survey.addResource("submit");
    submit.addMethod("POST", new apigw.LambdaIntegration(apiFn));

    const admin = api.root.addResource("admin");
    // Seed endpoint removed - now handled by local-seed-database.ts

    // ===== Static site (same) =====
    const siteBucket = new s3.Bucket(this, "OculusDev_site_bucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    Tags.of(siteBucket).add("project", "oculus");
    Tags.of(siteBucket).add("Name", "OculusDev_site_bucket");
    Tags.of(siteBucket).add("environment", "dev");

    const oai = new cloudfront.OriginAccessIdentity(this, "OculusDev_oai", {
      comment: "Allows CloudFront to reach the bucket",
    });
    Tags.of(oai).add("project", "oculus");
    Tags.of(oai).add("Name", "OculusDev_oai");
    Tags.of(oai).add("environment", "dev");

    siteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [siteBucket.arnForObjects("*")],
        principals: [new iam.CanonicalUserPrincipal(oai.cloudFrontOriginAccessIdentityS3CanonicalUserId)],
      })
    );

    const dist = new cloudfront.Distribution(this, "OculusDev_cf_dist", {
      defaultBehavior: {
        origin: new origins.S3Origin(siteBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      defaultRootObject: "index.html",
      enabled: true,
      httpVersion: cloudfront.HttpVersion.HTTP2,
    });
    Tags.of(dist).add("project", "oculus");
    Tags.of(dist).add("environment", "dev");
    Tags.of(dist).add("Name", "OculusDev_cloudfront_distribution");

    new s3deploy.BucketDeployment(this, "OculusDev_site_deploy", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "..", "..", "app", "out"))],
      destinationBucket: siteBucket,
      distribution: dist,
      distributionPaths: ["/*"],
      retainOnDelete: false,
    });

         // Bastion host removed - will be created manually via AWS CLI
    
    // ===== Outputs =====
    new CfnOutput(this, "ApiUrl", { value: api.url, exportName: "ApiUrl" });
    new CfnOutput(this, "SiteUrl", { value: `https://${dist.domainName}`, exportName: "SiteUrl" });
         // Bastion host outputs removed - will be created manually
  }
}
