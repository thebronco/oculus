# Oculus - AWS Infrastructure & Application Project

## 🏗️ Project Overview

Oculus is a full-stack application built with AWS infrastructure and modern web technologies. The project uses AWS CDK for infrastructure management, Next.js for the frontend, and AWS Lambda for backend services.

## 🏛️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │ Infrastructure  │
│   (Next.js)     │◄──►│   (Lambda)      │◄──►│   (AWS CDK)     │
│                 │    │                 │    │                 │
│ • React UI      │    │ • API Gateway   │    │ • VPC & Subnets │
│ • Static Assets │    │ • Lambda Funcs  │    │ • RDS Database  │
│ • CloudFront    │    │ • RDS Proxy     │    │ • Security      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 Project Structure

```
oculus/
├── cdk/                    # AWS Infrastructure (CDK)
│   ├── bin/               # CDK entry point
│   ├── lib/               # CDK constructs & stacks
│   ├── scripts/           # Deployment & utility scripts
│   ├── checkawsresources.ts # AWS resource inventory
│   └── aws-inventory.json # Current resource state
├── app/                    # Next.js Frontend Application
│   ├── src/               # React components & pages
│   ├── public/            # Static assets
│   └── package.json       # Frontend dependencies
├── lambdas/               # AWS Lambda Functions
│   ├── api.ts            # Main API handler
│   └── package.json      # Lambda dependencies
├── scripts/               # Root-level utility scripts
├── docs/                  # Project documentation
└── package.json           # Root project configuration
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- AWS CLI configured
- AWS CDK installed globally: `npm install -g aws-cdk`

### 1. Install Dependencies
```bash
# Install root dependencies
npm install

# Install CDK dependencies
cd cdk && npm install

# Install frontend dependencies  
cd ../app && npm install

# Install Lambda dependencies
cd ../lambdas && npm install
```

### 2. Deploy Infrastructure
```bash
cd cdk
npm run deploy-infra
```

### 3. Deploy Application
```bash
cd cdk
npm run deploy-app
```

### 4. Deploy Lambda Updates
```bash
cd cdk
npm run deploy-lambda
```

## 🛠️ Available Scripts

### Infrastructure Management
```bash
npm run deploy-infra    # Deploy missing infrastructure
npm run delete-infra    # Remove all infrastructure
npm run inventory       # Check current AWS resources
```

### Application Deployment
```bash
npm run deploy-app      # Deploy frontend to S3/CloudFront
npm run deploy-lambda   # Update Lambda function code
```

### Development
```bash
npm run build           # Build CDK stack
npm run cdk             # CDK CLI commands
```

## 🌐 AWS Resources

The project creates and manages:

- **Networking**: VPC, Subnets, Route Tables, Network ACLs
- **Compute**: Lambda Functions, EC2 (if needed)
- **Database**: RDS PostgreSQL with RDS Proxy
- **Storage**: S3 Buckets for static hosting
- **CDN**: CloudFront distribution
- **API**: API Gateway with Lambda integration
- **Security**: Security Groups, IAM Roles, Secrets Manager

## 🔧 Configuration

### Environment Variables
- Copy `.env.example` to `.env.local`
- Configure AWS region and credentials
- Set database connection parameters

### AWS Configuration
- Ensure AWS CLI is configured with appropriate permissions
- Required permissions: CloudFormation, VPC, RDS, Lambda, S3, CloudFront, IAM

## 📚 Development Workflow

### 1. Infrastructure Changes
```bash
cd cdk
# Modify lib/stack.ts
npm run deploy-infra
```

### 2. Lambda Code Changes
```bash
# Modify lambdas/api.ts
cd cdk
npm run deploy-lambda
```

### 3. Frontend Changes
```bash
cd app
# Modify React components
cd ../cdk
npm run deploy-app
```

## 🚨 Important Notes

- **Always run `npm run inventory`** before making changes to understand current state
- **Lambda functions are always deployed** from the `lambdas/` folder
- **Infrastructure is only created** when resources are missing
- **Manual resources** (like bastion hosts) need separate management

## 🔍 Troubleshooting

### Common Issues
1. **CDK Stack Rollback Failed**: Use `npm run delete-infra` then redeploy
2. **Lambda Not Found**: Ensure infrastructure is deployed first
3. **Permission Errors**: Check AWS CLI configuration and IAM permissions

### Useful Commands
```bash
# Check AWS resource inventory
npm run inventory

# View CDK stack status
cd cdk && npx cdk list

# Check CloudFormation events
aws cloudformation describe-stack-events --stack-name OculusMiniStack
```

## 🤝 Contributing

1. Make changes in appropriate directories
2. Test infrastructure changes with `npm run deploy-infra`
3. Test Lambda changes with `npm run deploy-lambda`
4. Test frontend changes with `npm run deploy-app`
5. Update documentation as needed

## 📄 License

This project is proprietary and confidential.

---

**Need Help?** Check the `docs/` folder for detailed guides or run `npm run inventory` to see current project status.
