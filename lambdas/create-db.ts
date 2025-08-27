import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  console.log('🚀 Create Database Lambda function started at:', new Date().toISOString());
  
  try {
    // Step 1: Get database credentials from Secrets Manager
    console.log('🔐 Step 1: Getting database credentials...');
    const sm = new SecretsManagerClient({});
    const sec = await sm.send(new GetSecretValueCommand({ 
      SecretId: process.env.DB_SECRET_ARN! 
    }));
    
    const { username, password } = JSON.parse(sec.SecretString!);
    console.log('✅ Credentials retrieved successfully');
    
    // Step 2: Connect to PostgreSQL using 'postgres' database (default)
    console.log('🗄️ Step 2: Connecting to PostgreSQL...');
    const dbConfig = {
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT || '5432'),
      database: 'postgres', // Connect to default postgres database
      user: username,
      password: password,
      ssl: { rejectUnauthorized: false }
    };
    
    const db = new Client(dbConfig);
    await db.connect();
    console.log('✅ Connected to PostgreSQL successfully');
    
    // Step 3: Create the oculusdb database
    console.log('🔨 Step 3: Creating oculusdb database...');
    await db.query('CREATE DATABASE oculusdb');
    console.log('✅ Database oculusdb created successfully!');
    
    await db.end();
    console.log('🔌 Database connection closed');
    
    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*'
      },
      body: JSON.stringify({
        message: 'SUCCESS: Database oculusdb created successfully!',
        timestamp: new Date().toISOString(),
        database: 'oculusdb',
        status: 'CREATED'
      })
    };
    
  } catch (error) {
    console.error('❌ Error occurred:', error);
    
    return {
      statusCode: 500,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*'
      },
      body: JSON.stringify({
        message: 'ERROR: Failed to create database',
        timestamp: new Date().toISOString(),
        error: {
          type: error.constructor.name,
          message: error instanceof Error ? error.message : String(error)
        }
      })
    };
  }
};
