import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import { Tags, Duration, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import * as path from "path";

export class MiniStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Tag everything
    Tags.of(this).add("project", "oculus");

    // --- VPC ---
    const vpc = new ec2.Vpc(this, "oculus_vpc", {
      natGateways: 1,
      subnetConfiguration: [
        { name: "oculus_public", subnetType: ec2.SubnetType.PUBLIC },
        { name: "oculus_private_egress", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { name: "oculus_db", subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    const lambdaSg = new ec2.SecurityGroup(this, "oculus_lambda_sg", {
      vpc,
      allowAllOutbound: true,
      description: "Security group for Lambda functions",
    });

    const dbSg = new ec2.SecurityGroup(this, "oculus_db_sg", {
      vpc,
      allowAllOutbound: true,
      description: "Security group for RDS / Proxy",
    });

    // Allow Lambda -> DB (via proxy) on 5432
    dbSg.addIngressRule(lambdaSg, ec2.Port.tcp(5432), "Lambda to DB/Proxy");

    // --- Secrets / Credentials ---
    const dbName = "oculusdb";
    const dbSecret = new secrets.Secret(this, "oculus_db_secret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "postgres" }),
        generateStringKey: "password",
        excludePunctuation: true,
      },
    });

    // --- RDS Instance ---
    const subnetGroup = new rds.SubnetGroup(this, "oculuspgSubnetGroup", {
      description: "DB subnets",
      vpc,
      vpcSubnets: { subnetGroupName: "oculus_db" },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const dbInstance = new rds.DatabaseInstance(this, "oculus_pg", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      vpc,
      vpcSubnets: { subnetGroupName: "oculus_db" },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      credentials: rds.Credentials.fromSecret(dbSecret),
      databaseName: dbName,
      allocatedStorage: 20,
      securityGroups: [dbSg],
      subnetGroup,
      deletionProtection: false,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // --- RDS Proxy (NO underscores in name) ---
    const proxy = new rds.DatabaseProxy(this, "oculuspgproxy", {
      proxyTarget: rds.ProxyTarget.fromInstance(dbInstance),
      secrets: [dbSecret],
      vpc,
      securityGroups: [dbSg],
      vpcSubnets: { subnetGroupName: "oculus_private_egress" },
      requireTLS: false,
      maxConnectionsPercent: 90,
      idleClientTimeout: Duration.minutes(30),
      dbProxyName: "oculuspgproxy",
    });

    // --- Common Lambda props ---
    const lambdaEnv = {
      DB_NAME: dbName,
      DB_HOST: proxy.endpoint, // use proxy endpoint
      DB_SECRET_ARN: dbSecret.secretArn,
    };

    const lambdaNodeOpts: Partial<lambda.FunctionOptions> = {
      memorySize: 256,
      timeout: Duration.seconds(20),
      architecture: lambda.Architecture.ARM_64,
      environment: lambdaEnv,
      vpc,
      securityGroups: [lambdaSg],
      vpcSubnets: { subnetGroupName: "oculus_private_egress" },
    };

    // --- API Lambda ---
    const apiFn = new NodejsFunction(this, "oculus_api_fn", {
      entry: path.join(__dirname, "..", "..", "lambdas","api.ts"),
      handler: "handler",
      bundling: { externalModules: ["pg", "aws-sdk"] },
      ...lambdaNodeOpts,
    });

    // --- Seed Lambda ---
    const seedFn = new NodejsFunction(this, "oculus_seed_fn", {
      entry: path.join(__dirname, "..", "..", "lambdas", "seed.ts"),
      handler: "handler",
      bundling: { externalModules: ["pg", "aws-sdk"] },
      ...lambdaNodeOpts,
    });

    // Allow Lambdas to read DB secret and connect via RDS Proxy
    dbSecret.grantRead(apiFn);
    dbSecret.grantRead(seedFn);

    // rds-db:connect permission on the proxy
    const rdsDbConnect = new iam.PolicyStatement({
      actions: ["rds-db:connect"],
      resources: ["*"],
    });
    apiFn.addToRolePolicy(rdsDbConnect);
    seedFn.addToRolePolicy(rdsDbConnect);

    // Ensure networking/DB is ready before Lambdas attempt connections on first invoke
    apiFn.node.addDependency(proxy);
    seedFn.node.addDependency(proxy);

    // --- API Gateway ---
    const api = new apigw.RestApi(this, "oculus_api", {
      deployOptions: { stageName: "prod" },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: ["GET", "POST", "OPTIONS"],
        allowHeaders: apigw.Cors.DEFAULT_HEADERS,
      },
    });

    const survey = api.root.addResource("survey");
    const nist = survey.addResource("nist-csf");
    nist.addMethod("GET", new apigw.LambdaIntegration(apiFn, { proxy: true }));

    const admin = api.root.addResource("admin");
    const seed = admin.addResource("seed");
    seed.addMethod("POST", new apigw.LambdaIntegration(seedFn, { proxy: true }));

    // --- Static site (S3 + CF) ---
    const siteBucket = new s3.Bucket(this, "oculus_site_bucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const oai = new cloudfront.OriginAccessIdentity(this, "oculus_oai");
    siteBucket.grantRead(oai);

    const dist = new cloudfront.Distribution(this, "oculus_cf_dist", {
      defaultBehavior: {
        origin: new origins.S3Origin(siteBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: "index.html",
    });

    // Place-holder deploy (actual build pushed by script)
    new s3deploy.BucketDeployment(this, "oculus_site_deploy", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "..", "..", "app", "out"))],
      destinationBucket: siteBucket,
      distribution: dist,
      distributionPaths: ["/*"],
      retainOnDelete: false,
    });

    // --- Outputs ---
    new CfnOutput(this, "ApiUrl", { value: api.url, exportName: "ApiUrl" });
    new CfnOutput(this, "SiteUrl", { value: `https://${dist.domainName}`, exportName: "SiteUrl" });
  }
}
