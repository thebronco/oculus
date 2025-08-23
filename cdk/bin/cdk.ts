import * as cdk from 'aws-cdk-lib';
import { MiniStack } from '../lib/stack';

const app = new cdk.App();
new MiniStack(app, 'OculusMiniStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});
