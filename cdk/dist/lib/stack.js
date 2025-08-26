"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OculusMiniStack = void 0;
// cdk/lib/stack.ts
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const rds = __importStar(require("aws-cdk-lib/aws-rds"));
const secrets = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
const apigw = __importStar(require("aws-cdk-lib/aws-apigateway"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const s3deploy = __importStar(require("aws-cdk-lib/aws-s3-deployment"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const aws_cdk_lib_1 = require("aws-cdk-lib");
const path = __importStar(require("path"));
class OculusMiniStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        aws_cdk_lib_1.Tags.of(this).add("project", "oculus");
        // ===== VPC: reuse if provided via context =====
        const ctxVpcId = this.node.tryGetContext("oculusVpcId");
        let vpc;
        if (ctxVpcId) {
            // Reuse existing VPC -> NO CIDR ops, no subnet changes.
            vpc = ec2.Vpc.fromLookup(this, "oculus_vpc", { vpcId: ctxVpcId });
        }
        else {
            // First-time path: create VPC (same shape as your last deploy)
            vpc = new ec2.Vpc(this, "oculus_vpc", {
                vpcName: "oculus_vpc",
                ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
                maxAzs: 3,
                natGateways: 1,
                subnetConfiguration: [
                    { name: "oculus_public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 20 },
                    { name: "oculus_private_egress", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 20 },
                    { name: "oculus_db", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 20 },
                ],
            });
        }
        const lambdaSg = new ec2.SecurityGroup(this, "oculus_lambda_sg", {
            vpc,
            description: "Lambda SG",
            allowAllOutbound: true,
        });
        const dbSg = new ec2.SecurityGroup(this, "oculus_db_sg", {
            vpc,
            description: "DB SG",
            allowAllOutbound: true,
        });
        dbSg.addIngressRule(lambdaSg, ec2.Port.tcp(5432), "Lambda to DB");
        const dbSecret = new secrets.Secret(this, "oculus_db_secret", {
            secretName: "oculus_db_secret",
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: "postgres" }),
                generateStringKey: "password",
                excludePunctuation: true,
            },
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        // Select subnets by TYPE so it works for both “lookup VPC” and “new VPC”
        const dbSubnets = vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED });
        const lambdaSubnets = vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS });
        const dbSubnetGroup = new rds.SubnetGroup(this, "oculuspgSubnetGroup", {
            description: "Subnets for RDS",
            vpc,
            vpcSubnets: dbSubnets,
        });
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
            backupRetention: aws_cdk_lib_1.Duration.days(0),
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            deletionProtection: false,
            subnetGroup: dbSubnetGroup,
            publiclyAccessible: false,
        });
        const proxy = new rds.DatabaseProxy(this, "oculuspgproxy", {
            proxyTarget: rds.ProxyTarget.fromInstance(db),
            secrets: [dbSecret],
            vpc,
            securityGroups: [dbSg],
            requireTLS: false,
            maxConnectionsPercent: 90,
            idleClientTimeout: aws_cdk_lib_1.Duration.minutes(30),
            iamAuth: false,
            vpcSubnets: lambdaSubnets,
        });
        // ===== Lambda defaults (fix runtime + bundle pg) =====
        const lambdaDefaults = {
            runtime: lambda.Runtime.NODEJS_18_X,
            architecture: lambda.Architecture.X86_64,
            memorySize: 256,
            timeout: aws_cdk_lib_1.Duration.seconds(30),
            logRetention: 7,
            bundling: {
                nodeModules: ["pg"], // <-- include the driver
            },
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
        const apiFn = new aws_lambda_nodejs_1.NodejsFunction(this, "oculus_api_fn", {
            entry: path.join(__dirname, "..", "..", "lambdas", "api.ts"),
            handler: "handler",
            ...lambdaDefaults,
            description: "Oculus API",
        });
        const seedFn = new aws_lambda_nodejs_1.NodejsFunction(this, "oculus_seed_fn", {
            entry: path.join(__dirname, "..", "..", "lambdas", "seed.ts"),
            handler: "handler",
            ...lambdaDefaults,
            description: "Oculus DB seed",
            timeout: aws_cdk_lib_1.Duration.minutes(2),
        });
        dbSecret.grantRead(apiFn);
        dbSecret.grantRead(seedFn);
        // ===== API Gateway (same resources) =====
        const api = new apigw.RestApi(this, "oculus_api", {
            restApiName: "oculus_api",
            deployOptions: { stageName: "prod" },
            defaultCorsPreflightOptions: {
                allowOrigins: apigw.Cors.ALL_ORIGINS,
                allowMethods: apigw.Cors.ALL_METHODS,
            },
        });
        const survey = api.root.addResource("survey");
        const nist = survey.addResource("nist-csf");
        nist.addMethod("GET", new apigw.LambdaIntegration(apiFn));
        const admin = api.root.addResource("admin");
        const seed = admin.addResource("seed");
        seed.addMethod("POST", new apigw.LambdaIntegration(seedFn));
        // ===== Static site (same) =====
        const siteBucket = new s3.Bucket(this, "oculus_site_bucket", {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        const oai = new cloudfront.OriginAccessIdentity(this, "oculus_oai", {
            comment: "Allows CloudFront to reach the bucket",
        });
        siteBucket.addToResourcePolicy(new iam.PolicyStatement({
            actions: ["s3:GetObject"],
            resources: [siteBucket.arnForObjects("*")],
            principals: [new iam.CanonicalUserPrincipal(oai.cloudFrontOriginAccessIdentityS3CanonicalUserId)],
        }));
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
        new s3deploy.BucketDeployment(this, "oculus_site_deploy", {
            sources: [s3deploy.Source.asset(path.join(__dirname, "..", "..", "app", "out"))],
            destinationBucket: siteBucket,
            distribution: dist,
            distributionPaths: ["/*"],
            retainOnDelete: false,
        });
        new aws_cdk_lib_1.CfnOutput(this, "ApiUrl", { value: api.url, exportName: "ApiUrl" });
        new aws_cdk_lib_1.CfnOutput(this, "SiteUrl", { value: `https://${dist.domainName}`, exportName: "SiteUrl" });
    }
}
exports.OculusMiniStack = OculusMiniStack;
