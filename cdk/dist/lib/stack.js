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
exports.MiniStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const rds = __importStar(require("aws-cdk-lib/aws-rds"));
const secrets = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const node = __importStar(require("aws-cdk-lib/aws-lambda-nodejs"));
const apigw = __importStar(require("aws-cdk-lib/aws-apigateway"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const s3deploy = __importStar(require("aws-cdk-lib/aws-s3-deployment"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class MiniStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const vpc = new ec2.Vpc(this, 'oculus_vpc', {
            vpcName: 'oculus_vpc',
            maxAzs: 2,
            natGateways: 1,
            subnetConfiguration: [
                { name: 'oculus_public', subnetType: ec2.SubnetType.PUBLIC },
                { name: 'oculus_private_egress', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
                { name: 'oculus_db', subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
            ],
        });
        const dbSecret = new secrets.Secret(this, 'oculus_db_secret', {
            secretName: 'oculus_db_secret',
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: 'oculus' }),
                generateStringKey: 'password',
                excludePunctuation: true,
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
        const dbSg = new ec2.SecurityGroup(this, 'oculus_db_sg', { vpc, allowAllOutbound: true, securityGroupName: 'oculus_db_sg' });
        const lambdaSg = new ec2.SecurityGroup(this, 'oculus_lambda_sg', { vpc, allowAllOutbound: true, securityGroupName: 'oculus_lambda_sg' });
        dbSg.addIngressRule(lambdaSg, ec2.Port.tcp(5432), 'oculus_lambda_to_db');
        const db = new rds.DatabaseInstance(this, 'oculus_pg', {
            instanceIdentifier: 'oculus_pg',
            vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
            engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_14 }),
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
            credentials: rds.Credentials.fromSecret(dbSecret),
            databaseName: 'oculusdb',
            allocatedStorage: 20,
            storageEncrypted: true,
            backupRetention: cdk.Duration.days(1),
            multiAz: false,
            deletionProtection: false,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            securityGroups: [dbSg],
        });
        const proxy = db.addProxy('oculus_pg_proxy', {
            dbProxyName: 'oculus_pg_proxy',
            vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
            secrets: [dbSecret],
            requireTLS: true,
            iamAuth: false,
            securityGroups: [lambdaSg],
        });
        const apiFn = new node.NodejsFunction(this, 'oculus_api_fn', {
            functionName: 'oculus_api',
            entry: '../lambdas/api.ts',
            runtime: lambda.Runtime.NODEJS_20_X,
            architecture: lambda.Architecture.ARM_64,
            vpc, securityGroups: [lambdaSg],
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
            environment: { DB_HOST: proxy.endpoint, DB_NAME: 'oculusdb', DB_SECRET_ARN: dbSecret.secretArn },
            memorySize: 256, timeout: cdk.Duration.seconds(10),
            bundling: { externalModules: ['pg-native'] },
            logRetention: logs.RetentionDays.ONE_WEEK
        });
        dbSecret.grantRead(apiFn);
        const seedFn = new node.NodejsFunction(this, 'oculus_seed_fn', {
            functionName: 'oculus_seed',
            entry: '../lambdas/seed.ts',
            runtime: lambda.Runtime.NODEJS_20_X,
            architecture: lambda.Architecture.ARM_64,
            vpc, securityGroups: [lambdaSg],
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
            environment: { DB_HOST: proxy.endpoint, DB_NAME: 'oculusdb', DB_SECRET_ARN: dbSecret.secretArn },
            memorySize: 256, timeout: cdk.Duration.seconds(30),
            bundling: { externalModules: ['pg-native'] },
            logRetention: logs.RetentionDays.ONE_WEEK
        });
        dbSecret.grantRead(seedFn);
        const api = new apigw.RestApi(this, 'oculus_api', {
            restApiName: 'oculus_api',
            deployOptions: { stageName: 'prod' },
            defaultCorsPreflightOptions: { allowOrigins: apigw.Cors.ALL_ORIGINS, allowMethods: apigw.Cors.ALL_METHODS }
        });
        api.root.addResource('survey').addResource('nist-csf').addMethod('GET', new apigw.LambdaIntegration(apiFn));
        api.root.addResource('admin').addResource('seed').addMethod('POST', new apigw.LambdaIntegration(seedFn));
        const bucket = new s3.Bucket(this, 'oculus_site_bucket', {
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            autoDeleteObjects: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
        const oai = new cloudfront.OriginAccessIdentity(this, 'oculus_oai');
        bucket.grantRead(oai);
        const dist = new cloudfront.Distribution(this, 'oculus_cf_dist', {
            comment: 'oculus_site_distribution',
            defaultBehavior: {
                origin: new origins.S3Origin(bucket, { originAccessIdentity: oai }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
            }
        });
        new s3deploy.BucketDeployment(this, 'oculus_site_deploy', {
            destinationBucket: bucket,
            distribution: dist,
            sources: [s3deploy.Source.asset('../app/out')]
        });
        new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
        new cdk.CfnOutput(this, 'SiteUrl', { value: `https://${dist.domainName}` });
    }
}
exports.MiniStack = MiniStack;
