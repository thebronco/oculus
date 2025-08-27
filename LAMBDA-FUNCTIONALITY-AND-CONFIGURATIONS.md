# 🚀 Lambda Functionality and Configurations

## 📋 Table of Contents
- [Overview](#overview)
- [API Endpoints](#api-endpoints)
- [Core Functionality](#core-functionality)
- [Required Configurations](#required-configurations)
- [Database Schema](#database-schema)
- [AWS Resources](#aws-resources)
- [IAM Permissions](#iam-permissions)
- [How It Works](#how-it-works)
- [Current Limitations](#current-limitations)
- [Production Readiness](#production-readiness)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This Lambda function serves as the **Oculus Security Survey API**, providing endpoints for NIST-CSF security assessments. It connects to PostgreSQL through RDS Proxy and uses AWS Secrets Manager for secure credential management.

**File:** `lambdas/api.ts`  
**Runtime:** Node.js 18.x  
**Architecture:** Serverless API with database integration  

---

## 🌐 API Endpoints

### 1. GET /survey/nist-csf
- **Purpose:** Retrieve one NIST-CSF security survey question
- **Response:** Question text + multiple choice answers
- **Use Case:** Display survey questions to users

### 2. POST /survey/submit
- **Purpose:** Submit survey answers from users
- **Request Body:** JSON with question_id, selected_answers, timestamp
- **Response:** Confirmation of successful submission
- **Current Status:** Logs submission (placeholder for database storage)

---

## ⚙️ Core Functionality

- **Database Connection:** PostgreSQL via RDS Proxy
- **Secrets Management:** AWS Secrets Manager integration
- **Query Processing:** SQL execution against survey database
- **CORS Support:** Cross-origin request handling
- **Error Handling:** Comprehensive HTTP status codes
- **Request Routing:** Dynamic endpoint handling based on HTTP method and path

---

## 🔧 Required Configurations

### Environment Variables (lambdas/.env)

```bash
# Database Connection
PGHOST=oculuspgproxy.proxy-cmto6kcyw96u.us-east-1.rds.amazonaws.com
PGPORT=5432
PGDATABASE=oculus_db
DB_SECRET_ARN=arn:aws:secretsmanager:us-east-1:512285571086:secret:oculus-db-secret

# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# Lambda Configuration
LAMBDA_RUNTIME=nodejs18.x
LAMBDA_MEMORY_SIZE=512
LAMBDA_TIMEOUT=30
LAMBDA_LOG_LEVEL=info

# API Configuration
API_GATEWAY_URL=https://gxeixlzzdj.execute-api.us-east-1.amazonaws.com/prod
API_VERSION=v1
ENABLE_CORS=true
ALLOWED_ORIGINS=http://localhost:3000,https://oculusministack-oculussitebucketdebfbe1e-q4uwii1y2qua.s3.amazonaws.com

# Database Connection Settings
DB_CONNECTION_TIMEOUT=5000
DB_QUERY_TIMEOUT=10000
DB_POOL_SIZE=5
DB_IDLE_TIMEOUT=30000

# Logging & Monitoring
ENABLE_STRUCTURED_LOGGING=true
LOG_REQUEST_BODY=false
LOG_RESPONSE_BODY=false
ENABLE_XRAY_TRACING=false

# Security Configuration
ENABLE_API_KEY_AUTH=false
ENABLE_JWT_AUTH=false
ENABLE_RATE_LIMITING=false
MAX_REQUESTS_PER_MINUTE=1000
```

---

## 🗄️ Database Schema

### Required Tables
CREATE TABLE survey_template (
  survey_template_id VARCHAR PRIMARY KEY,
  survey_template_name VARCHAR NOT NULL
  
);
```sql
-- Questions table for survey templates
CREATE TABLE questions_template (
  question_id VARCHAR PRIMARY KEY,
  survey_template_id VARCHAR NOT NULL,
  category VARCHAR NOT NULL,
  sub_category VARCHAR NOT NULL,
  question TEXT NOT NULL,
  question_tool_tip TEXT
);

-- Answer options for each question
CREATE TABLE answers_options_template (
  answer_id VARCHAR PRIMARY KEY,
  question_id VARCHAR NOT NULL REFERENCES questions_template(question_id),
  answer_type VARCHAR NOT NULL,
  answer TEXT NOT NULL
);

-- Survey responses (for future implementation)
CREATE TABLE survey_responses (
  response_id SERIAL PRIMARY KEY,
  question_id VARCHAR NOT NULL REFERENCES questions_template(question_id),
  selected_answers JSONB NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR, -- Optional: for user tracking
  session_id VARCHAR -- Optional: for session management
);
```

### Sample Data

```sql
-- Insert sample NIST-CSF question
INSERT INTO questions_template VALUES (
  'q1', 
  'nist-csf-2024', 
  'Identify', 
  'Asset Management', 
  'What is your organization''s approach to asset inventory?',
  'Consider both physical and digital assets'
);

-- Insert sample answers
INSERT INTO answers_options_template VALUES
  ('a1', 'q1', 'multiple_choice', 'Comprehensive inventory with regular updates'),
  ('a2', 'q1', 'multiple_choice', 'Basic inventory maintained'),
  ('a3', 'q1', 'multiple_choice', 'No formal inventory process'),
  ('a4', 'q1', 'multiple_choice', 'Inventory exists but is outdated');
```

---

## ☁️ AWS Resources

### Required Infrastructure

1. **RDS Proxy**
   - **Purpose:** Database connection pooling and security
   - **Endpoint:** `oculuspgproxy.proxy-cmto6kcyw96u.us-east-1.rds.amazonaws.com`
   - **VPC:** Must be in your private subnets

2. **Secrets Manager**
   - **Secret Name:** `oculus-db-secret`
   - **Content:** JSON with `username` and `password`
   - **Access:** Lambda function needs read permissions

3. **Lambda Function**
   - **Runtime:** Node.js 18.x
   - **Memory:** 512MB (configurable)
   - **Timeout:** 30 seconds
   - **VPC:** Must be in private subnets with database access

4. **API Gateway**
   - **Type:** REST API
   - **Endpoints:** `/survey/nist-csf` (GET), `/survey/submit` (POST)
   - **CORS:** Enabled for cross-origin requests

5. **VPC Configuration**
   - **Subnets:** Private subnets for Lambda and RDS
   - **Security Groups:** Allow Lambda → RDS Proxy communication
   - **Route Tables:** Proper routing for database access

---

## 🔐 IAM Permissions

### Lambda Execution Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:512285571086:secret:oculus-db-secret"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:CreateNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DeleteNetworkInterface"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:us-east-1:512285571086:*"
    }
  ]
}
```

### Secrets Manager Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::512285571086:role/your-lambda-execution-role"
      },
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:us-east-1:512285571086:secret:oculus-db-secret"
    }
  ]
}
```

---

## 🔄 How It Works

### 1. Request Handling

```typescript
// Determines which endpoint was called based on HTTP method and path
if (event.httpMethod === 'GET' && event.path.includes('/survey/nist-csf')) {
  result = await getSurveyQuestion(db);
} else if (event.httpMethod === 'POST' && event.path.includes('/survey/submit')) {
  result = await submitSurveyAnswer(db, event.body);
}
```

### 2. Database Connection Process

```typescript
// Step 1: Get credentials from Secrets Manager
const sm = new SecretsManagerClient({});
const sec = await sm.send(new GetSecretValueCommand({ 
  SecretId: process.env.DB_SECRET_ARN! 
}));
const { username, password } = JSON.parse(sec.SecretString!);

// Step 2: Connect to PostgreSQL through RDS Proxy
const db = new Client({
  host: process.env.PGHOST,        // RDS Proxy endpoint
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: username,                  // From Secrets Manager
  password,                        // From Secrets Manager
  ssl: { rejectUnauthorized: false }
});
await db.connect();
```

### 3. Data Processing Flow

#### GET Request (Survey Question)
```typescript
// Query one question with its answer options
const questionQuery = await db.query(`
  SELECT 
    q.question_id,
    q.category,
    q.sub_category,
    q.question,
    q.question_tool_tip
  FROM questions_template q
  WHERE q.survey_template_id = 'nist-csf-2024'
  LIMIT 1
`);

// Get answers for this question
const answersQuery = await db.query(`
  SELECT 
    a.answer_id,
    a.answer_type,
    a.answer,
    ROW_NUMBER() OVER (ORDER BY a.answer_id) as answer_order
  FROM answers_options_template a
  WHERE a.question_id = $1
  ORDER BY a.answer_id
`, [question.question_id]);
```

#### POST Request (Survey Submission)
```typescript
// Parse and validate request body
const { question_id, selected_answers, timestamp } = JSON.parse(body);

// Validate required fields
if (!question_id || !selected_answers || !Array.isArray(selected_answers)) {
  throw new Error('Invalid request: question_id and selected_answers array are required');
}

// Log submission (placeholder for database storage)
console.log('Survey answer submitted:', {
  question_id,
  selected_answers,
  timestamp,
  submitted_at: new Date().toISOString()
});
```

---

## 🚨 Current Limitations

1. **Single Question Response:** Only returns 1 question (LIMIT 1 in SQL)
2. **No Data Persistence:** Survey submissions are logged only, not stored
3. **No Authentication:** No user verification or authorization
4. **Fixed Template:** Hardcoded survey template ID ('nist-csf-2024')
5. **No Input Validation:** Limited request body validation
6. **No Rate Limiting:** No protection against abuse
7. **Basic Error Handling:** Generic error messages

---

## 🚀 Production Readiness Improvements

### 1. Authentication & Authorization
```typescript
// Add JWT token validation
const token = event.headers.Authorization?.replace('Bearer ', '');
if (!token) {
  return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
}
// Validate JWT token...
```

### 2. Data Persistence
```typescript
// Store survey responses in database
await db.query(`
  INSERT INTO survey_responses (question_id, selected_answers, timestamp, user_id)
  VALUES ($1, $2, $3, $4)
`, [question_id, JSON.stringify(selected_answers), timestamp, userId]);
```

### 3. Input Validation & Sanitization
```typescript
// Validate and sanitize inputs
import { z } from 'zod';

const submitSchema = z.object({
  question_id: z.string().min(1),
  selected_answers: z.array(z.string()).min(1),
  timestamp: z.string().datetime()
});

const validatedData = submitSchema.parse(JSON.parse(body));
```

### 4. Rate Limiting
```typescript
// Implement rate limiting
const rateLimitKey = `rate_limit:${event.requestContext.identity.sourceIp}`;
const currentCount = await redis.incr(rateLimitKey);
if (currentCount > MAX_REQUESTS_PER_MINUTE) {
  return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit exceeded' }) };
}
```

### 5. Enhanced Logging & Monitoring
```typescript
// Structured logging
console.log(JSON.stringify({
  level: 'info',
  message: 'Survey question requested',
  question_id: question.question_id,
  timestamp: new Date().toISOString(),
  request_id: event.requestContext.requestId
}));
```

---

## 🧪 Testing

### Local Testing

```bash
# Test GET endpoint
curl -X GET "https://your-api-gateway-url/prod/survey/nist-csf"

# Test POST endpoint
curl -X POST "https://your-api-gateway-url/prod/survey/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "question_id": "q1",
    "selected_answers": ["a1"],
    "timestamp": "2025-08-26T10:00:00Z"
  }'
```

### AWS Testing

```bash
# Test Lambda function directly
aws lambda invoke \
  --function-name your-lambda-function-name \
  --payload '{"httpMethod":"GET","path":"/survey/nist-csf"}' \
  response.json

# Test API Gateway
aws apigateway test-invoke-method \
  --rest-api-id your-api-id \
  --resource-id your-resource-id \
  --http-method GET \
  --path-with-query-string "/survey/nist-csf"
```

### Unit Testing

```typescript
// Example test structure
describe('Lambda API Tests', () => {
  test('GET /survey/nist-csf returns question and answers', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/survey/nist-csf'
    };
    
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    
    const body = JSON.parse(result.body);
    expect(body.question).toBeDefined();
    expect(body.answers).toBeInstanceOf(Array);
  });
});
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check RDS Proxy status
aws rds describe-db-proxies --db-proxy-name oculuspgproxy

# Verify Lambda VPC configuration
aws lambda get-function-configuration --function-name your-function-name
```

#### 2. Secrets Manager Access Denied
```bash
# Check IAM permissions
aws iam get-role-policy --role-name your-lambda-role --policy-name your-policy

# Verify secret exists
aws secretsmanager describe-secret --secret-id oculus-db-secret
```

#### 3. Environment Variables Not Loading
```bash
# Check Lambda environment variables
aws lambda get-function-configuration --function-name your-function-name

# Verify .env file exists and has correct values
cat lambdas/.env
```

#### 4. CORS Issues
```bash
# Check API Gateway CORS settings
aws apigateway get-resource --rest-api-id your-api-id --resource-id your-resource-id

# Verify CORS headers in response
curl -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS "https://your-api-gateway-url/prod/survey/nist-csf"
```

### Debug Commands

```bash
# Check Lambda logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/your-function-name"

# View recent log events
aws logs filter-log-events \
  --log-group-name "/aws/lambda/your-function-name" \
  --start-time $(date -d '1 hour ago' +%s)000

# Test database connectivity from Lambda VPC
aws lambda invoke \
  --function-name your-function-name \
  --payload '{"httpMethod":"GET","path":"/survey/nist-csf"}' \
  response.json
```

---

## 📚 Additional Resources

- **AWS Lambda Documentation:** [Lambda Developer Guide](https://docs.aws.amazon.com/lambda/)
- **PostgreSQL Client:** [node-postgres](https://node-postgres.com/)
- **AWS Secrets Manager:** [Secrets Manager User Guide](https://docs.aws.amazon.com/secretsmanager/)
- **API Gateway:** [API Gateway Developer Guide](https://docs.aws.amazon.com/apigateway/)
- **RDS Proxy:** [RDS Proxy User Guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html)

---

## 🎉 Summary

This Lambda function provides a **secure, scalable API for security surveys** with:

✅ **Database Integration:** PostgreSQL via RDS Proxy  
✅ **Security:** AWS Secrets Manager for credentials  
✅ **Scalability:** Serverless architecture  
✅ **Monitoring:** CloudWatch logging  
✅ **CORS Support:** Cross-origin request handling  
✅ **Error Handling:** Comprehensive error responses  

**Ready for development and testing, with clear path to production deployment!** 🚀

---

*Generated for Oculus Project - Lambda API Documentation*  
*Last Updated: August 2025*
