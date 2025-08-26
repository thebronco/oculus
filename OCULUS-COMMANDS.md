# 🚀 Oculus Project - Complete Command Reference

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [Infrastructure Management](#infrastructure-management)
- [Application Deployment](#application-deployment)
- [Development & Testing](#development--testing)
- [Complete Workflows](#complete-workflows)
- [Directory Structure](#directory-structure)
- [Quick Reference](#quick-reference)
- [Important Notes](#important-notes)

---

## 🌱 Prerequisites (One-time setup)

```bash
# Install all dependencies
npm run install:all

# Setup environment files (if not done already)
npm run setup
```

---

## 🏗️ Infrastructure Management Commands

### 1. Deploy Infrastructure (VPC, RDS, Lambda, etc.)
```bash
# Deploy missing infrastructure + Lambda
npm run deploy:infra

# OR go to CDK folder and run directly
cd cdk
npm run deploy-infra
```

### 2. Destroy Infrastructure (Cleanup)
```bash
# Remove all AWS resources
npm run delete:infra

# OR go to CDK folder and run directly
cd cdk
npm run delete-infra
```

### 3. Check Infrastructure Status
```bash
# View current AWS resources
npm run inventory

# OR go to CDK folder and run directly
cd cdk
npm run inventory
```

---

## 🎯 Application Deployment Commands

### 4. Build Application
```bash
# Build Next.js app for production
npm run build:app

# OR go to app folder and run directly
cd app
npm run build
```

### 5. Deploy Frontend to AWS
```bash
# Deploy app to S3 + CloudFront
npm run deploy:app

# OR go to CDK folder and run directly
cd cdk
npm run deploy-app
```

### 6. Deploy Lambda Functions
```bash
# Deploy Lambda code updates
npm run deploy:lambda

# OR go to CDK folder and run directly
cd cdk
npm run deploy-lambda
```

---

## 🖥️ Development & Testing Commands

### 7. Run Development Server
```bash
# Start Next.js dev server (localhost:3000)
npm run dev:app

# OR go to app folder and run directly
cd app
npm run dev
```

### 8. Start Production Server
```bash
# Start production Next.js server
npm run start:app

# OR go to app folder and run directly
cd app
npm run start
```

---

## 🔄 Complete Workflow Examples

### 🌱 First Time Setup
```bash
# 1. Install dependencies
npm run install:all

# 2. Setup environment files
npm run setup

# 3. Deploy infrastructure
npm run deploy:infra

# 4. Build app
npm run build:app

# 5. Deploy app
npm run deploy:app
```

### 🚀 Daily Development
```bash
# 1. Start dev server
npm run dev:app

# 2. Make changes to code
# 3. Test locally

# 4. Deploy Lambda changes
npm run deploy:lambda

# 5. Deploy app changes
npm run build:app
npm run deploy:app
```

### 🧹 Cleanup/Reset
```bash
# 1. Destroy all infrastructure
npm run delete:infra

# 2. Recreate from scratch
npm run deploy:infra
npm run build:app
npm run deploy:app
```

---

## 📁 Directory Structure for Commands

```
oculus/
├── .env.local                    # Root config
├── package.json                  # Root scripts
├── cdk/
│   ├── .env                     # CDK config
│   ├── package.json             # CDK scripts
│   └── scripts/                 # Deployment scripts
├── app/
│   ├── .env.local               # App config
│   └── package.json             # App scripts
└── lambdas/
    ├── .env                     # Lambda config
    └── package.json             # Lambda scripts
```

---

## 🎯 Quick Reference - Most Used Commands

```bash
# Development
npm run dev:app                   # Start dev server

# Deployment
npm run deploy:infra             # Deploy infrastructure
npm run deploy:lambda            # Deploy Lambda
npm run deploy:app               # Deploy frontend

# Management
npm run inventory                # Check AWS resources
npm run delete:infra             # Clean up everything

# Building
npm run build:app                # Build for production
```

---

## ⚠️ Important Notes

1. **Always run from project root** (`oculus/` folder)
2. **Infrastructure first:** Deploy infra before app
3. **Build before deploy:** Run `build:app` before `deploy:app`
4. **Environment files:** Must be configured before deployment
5. **AWS credentials:** Must be set up and working

---

## 🔧 Troubleshooting Common Issues

### CDK Asset Path Error
```bash
# If you see: "Cannot find asset at app/out"
# Solution: Build the app first
npm run build:app
```

### Environment Variables Not Loading
```bash
# Check if .env files exist
ls -la .env*
# Make sure they're in the right locations
```

### AWS Credentials Error
```bash
# Verify AWS credentials
aws sts get-caller-identity
# Check your .env files have correct AWS_REGION and AWS_PROFILE
```

---

## 📚 Additional Resources

- **Project README:** `README.md`
- **CDK Documentation:** [AWS CDK](https://docs.aws.amazon.com/cdk/)
- **Next.js Documentation:** [Next.js](https://nextjs.org/docs)
- **AWS CLI Documentation:** [AWS CLI](https://docs.aws.amazon.com/cli/)

---

## 🎉 Getting Help

If you encounter issues:
1. Check the troubleshooting section above
2. Run `npm run inventory` to verify AWS resources
3. Check your environment files are properly configured
4. Ensure you're running commands from the project root

---

*Generated for Oculus Project - AWS Infrastructure & Application*
*Last Updated: August 2025*
