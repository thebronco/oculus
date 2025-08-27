/**
 * CDK Entry Point - Oculus Dev Stack
 * 
 * This file serves as the main entry point for the CDK application.
 * It instantiates the OculusDevStack and deploys it to the AWS account
 * specified in the CDK_DEFAULT_ACCOUNT environment variable and the region
 * specified in CDK_DEFAULT_REGION environment variable.
 * 
 * The stack creates a complete infrastructure including:
 * - VPC with public, private, and database subnets
 * - RDS PostgreSQL database with proxy
 * - Lambda functions for API and database seeding
 * - API Gateway for REST API endpoints
 * - S3 bucket for static website hosting
 * - CloudFront distribution for content delivery
 */

import * as cdk from 'aws-cdk-lib';
import { OculusDevStack } from '../lib/stack';

const app = new cdk.App();
new OculusDevStack(app, 'OculusDevStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});
