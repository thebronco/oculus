// Lambda function for Oculus Security Survey API - TESTING DATABASE CONNECTION ONLY
// This version tests if Lambda can reach RDS Proxy without complex operations

import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  console.log('🚀 Lambda function started at:', new Date().toISOString());
  console.log('📡 Request path:', event.path);
  console.log('🔧 HTTP method:', event.httpMethod);
  
  // CORS headers
  const corsHeaders = {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type'
  };

  try {
    // Handle different endpoints based on path and method
    if (event.path === '/survey/nist-csf' && event.httpMethod === 'GET') {
      return await handleGetSurveyQuestions(corsHeaders);
    } else if (event.path === '/survey/submit' && event.httpMethod === 'POST') {
      return await handleSubmitSurvey(event, corsHeaders);
    } else if (event.path === '/test-db' && event.httpMethod === 'GET') {
      return await handleTestDatabase(corsHeaders);
    } else {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Endpoint not found',
          path: event.path,
          method: event.httpMethod
        })
      };
    }
  } catch (error) {
    console.error('❌ Error occurred:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'ERROR: Lambda function failed',
        timestamp: new Date().toISOString(),
        error: {
          type: error.constructor.name,
          message: error instanceof Error ? error.message : String(error)
        }
      })
    };
  }
};

// Handle GET /survey/nist-csf
async function handleGetSurveyQuestions(headers: any): Promise<APIGatewayProxyResult> {
  console.log('📋 Fetching survey questions...');
  
  // Sample survey questions (you can replace this with database queries later)
  const surveyQuestions = [
    {
      id: 1,
      question: "Does your organization have a formal information security policy?",
      category: "Governance",
      options: ["Yes", "No", "Partially"]
    },
    {
      id: 2,
      question: "Are regular security awareness training sessions conducted for employees?",
      category: "Training",
      options: ["Yes", "No", "Annually", "Quarterly"]
    },
    {
      id: 3,
      question: "Is there a formal incident response plan in place?",
      category: "Incident Response",
      options: ["Yes", "No", "In Development"]
    }
  ];

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      message: 'Survey questions retrieved successfully',
      timestamp: new Date().toISOString(),
      questions: surveyQuestions
    })
  };
}

// Handle POST /survey/submit
async function handleSubmitSurvey(event: APIGatewayEvent, headers: any): Promise<APIGatewayProxyResult> {
  console.log('📝 Submitting survey answers...');
  
  try {
    const body = JSON.parse(event.body || '{}');
    console.log('📊 Received answers:', body);

    // Here you would typically save to database
    // For now, just acknowledge receipt
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Survey answers submitted successfully',
        timestamp: new Date().toISOString(),
        received: body,
        status: 'SAVED'
      })
    };
  } catch (parseError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        message: 'Invalid JSON in request body',
        error: parseError instanceof Error ? parseError.message : 'Unknown error'
      })
    };
  }
}

// Handle GET /test-db (existing functionality)
async function handleTestDatabase(headers: any): Promise<APIGatewayProxyResult> {
  console.log('🗄️ Testing database connectivity...');
  
  try {
    // Get database credentials from Secrets Manager
    const sm = new SecretsManagerClient({});
    const sec = await sm.send(new GetSecretValueCommand({ 
      SecretId: process.env.DB_SECRET_ARN! 
    }));
    
    const { username, password } = JSON.parse(sec.SecretString!);
    
    // Test database connection
    const dbConfig = {
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT || '5432'),
      database: process.env.PGDATABASE,
      user: username,
      password: password,
      ssl: { rejectUnauthorized: false }
    };
    
    const db = new Client(dbConfig);
    await db.connect();
    
    const result = await db.query('SELECT 1 as test, NOW() as timestamp, version() as pg_version');
    await db.end();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'SUCCESS: Database connectivity working!',
        timestamp: new Date().toISOString(),
        database: {
          status: 'SUCCESSFUL',
          test_query: result.rows[0]
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Database test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
} 