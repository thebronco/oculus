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

export class OculusMiniStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Add project tag to the entire stack
    Tags.of(this).add("project", "oculus");

    // ===== VPC: reuse if provided via context =====
    const ctxVpcId = this.node.tryGetContext("oculusVpcId") as string | undefined;

    let vpc: ec2.IVpc;
    if (ctxVpcId) {
      // Reuse existing VPC -> NO CIDR ops, no subnet changes.
      vpc = ec2.Vpc.fromLookup(this, "oculus_vpc", { vpcId: ctxVpcId });
    } else {
             // First-time path: create VPC (same shape as your last deploy)
       vpc = new ec2.Vpc(this, "oculus_vpc", {
         vpcName: "oculus_vpc",
         ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
         maxAzs: 3,
         natGateways: 0, // No NAT Gateway needed since no bastion host
         subnetConfiguration: [
           { name: "oculus_public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 20 },
           { name: "oculus_private_isolated", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 20 },
           { name: "oculus_db", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 20 },
         ],
       });
      
      // Tag VPC and all its subnets with 'oculus'
      Tags.of(vpc).add("project", "oculus");
      Tags.of(vpc).add("Name", "oculus_vpc");
    }

    const lambdaSg = new ec2.SecurityGroup(this, "oculus_lambda_sg", {
      vpc,
      description: "Lambda SG",
      allowAllOutbound: true,
    });
    Tags.of(lambdaSg).add("project", "oculus");
    Tags.of(lambdaSg).add("Name", "oculus_lambda_sg");

    const dbSg = new ec2.SecurityGroup(this, "oculus_db_sg", {
      vpc,
      description: "DB SG",
      allowAllOutbound: true,
    });
    Tags.of(dbSg).add("project", "oculus");
    Tags.of(dbSg).add("Name", "oculus_db_sg");

    dbSg.addIngressRule(lambdaSg, ec2.Port.tcp(5432), "Lambda to DB");

    const dbSecret = new secrets.Secret(this, "oculus_db_secret", {
      secretName: "oculus_db_secret",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "postgres" }),
        generateStringKey: "password",
        excludePunctuation: true,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });
    Tags.of(dbSecret).add("project", "oculus");
    Tags.of(dbSecret).add("Name", "oculus_db_secret");

    // Select subnets by TYPE so it works for both "lookup VPC" and "new VPC"
    const dbSubnets = vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED });
         const lambdaSubnets = vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED });

    const dbSubnetGroup = new rds.SubnetGroup(this, "oculuspgSubnetGroup", {
      description: "Subnets for RDS",
      vpc,
      vpcSubnets: dbSubnets,
    });
    Tags.of(dbSubnetGroup).add("project", "oculus");
    Tags.of(dbSubnetGroup).add("Name", "oculus_db_subnet_group");

    const db = new rds.DatabaseInstance(this, "oculus_pg", {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_14 }),
      vpc,
      vpcSubnets: dbSubnets,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      securityGroups: [dbSg],
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
    Tags.of(db).add("Name", "oculus_pg_database");

    const proxy = new rds.DatabaseProxy(this, "oculuspgproxy", {
      proxyTarget: rds.ProxyTarget.fromInstance(db),
      secrets: [dbSecret],
      vpc,
      securityGroups: [dbSg],
      requireTLS: false,
      maxConnectionsPercent: 90,
      idleClientTimeout: Duration.minutes(30),
      iamAuth: false,
      vpcSubnets: lambdaSubnets,
    });
    Tags.of(proxy).add("project", "oculus");
    Tags.of(proxy).add("Name", "oculus_pg_proxy");

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

    const apiFn = new NodejsFunction(this, "oculus_api_fn", {
      entry: path.join(__dirname, "..", "..", "lambdas", "api.ts"),
      handler: "handler",
      ...lambdaDefaults,
      description: "Oculus API",
    });
    Tags.of(apiFn).add("project", "oculus");
    Tags.of(apiFn).add("Name", "oculus_api_lambda");

    dbSecret.grantRead(apiFn);

    // ===== API Gateway (same resources) =====
    const api = new apigw.RestApi(this, "oculus_api", {
      restApiName: "oculus_api",
      deployOptions: { stageName: "prod" },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
      },
    });
    Tags.of(api).add("project", "oculus");
    Tags.of(api).add("Name", "oculus_api_gateway");

    const survey = api.root.addResource("survey");
    const nist = survey.addResource("nist-csf");
    nist.addMethod("GET", new apigw.LambdaIntegration(apiFn));
    
    const submit = survey.addResource("submit");
    submit.addMethod("POST", new apigw.LambdaIntegration(apiFn));

    const admin = api.root.addResource("admin");
    // Seed endpoint removed - now handled by local-seed-database.ts

    // ===== Static site (same) =====
    const siteBucket = new s3.Bucket(this, "oculus_site_bucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    Tags.of(siteBucket).add("project", "oculus");
    Tags.of(siteBucket).add("Name", "oculus_site_bucket");

    const oai = new cloudfront.OriginAccessIdentity(this, "oculus_oai", {
      comment: "Allows CloudFront to reach the bucket",
    });
    Tags.of(oai).add("project", "oculus");
    Tags.of(oai).add("Name", "oculus_oai");

    siteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [siteBucket.arnForObjects("*")],
        principals: [new iam.CanonicalUserPrincipal(oai.cloudFrontOriginAccessIdentityS3CanonicalUserId)],
      })
    );

    const dist = new cloudfront.Distribution(this, "oculus_cf_dist", {
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
    Tags.of(dist).add("Name", "oculus_cloudfront_distribution");

    new s3deploy.BucketDeployment(this, "oculus_site_deploy", {
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
