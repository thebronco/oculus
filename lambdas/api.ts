// Lambda function for Oculus Security Survey API
// GET /survey/nist-csf → return one NIST‑CSF question + answers
// POST /survey/submit → submit survey answer

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';

interface APIGatewayEvent {
  httpMethod: string;
  path: string;
  body?: string;
  headers?: Record<string, string>;
}

interface APIGatewayResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
  try {
    // Read DB credentials from Secrets Manager (v3 client)
    const sm = new SecretsManagerClient({});
    const sec = await sm.send(new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN! }));
    const { username, password } = JSON.parse(sec.SecretString!);

    // Connect to Postgres through RDS Proxy
    const db = new Client({
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT || '5432'),
      database: process.env.PGDATABASE,
      user: username,
      password,
      ssl: { rejectUnauthorized: false }
    });
    await db.connect();

    let result: any;

    if (event.httpMethod === 'GET' && event.path.includes('/survey/nist-csf')) {
      // GET /survey/nist-csf - Return one question with answers
      result = await getSurveyQuestion(db);
    } else if (event.httpMethod === 'POST' && event.path.includes('/survey/submit')) {
      // POST /survey/submit - Submit survey answer
      result = await submitSurveyAnswer(db, event.body);
    } else {
      return {
        statusCode: 404,
        headers: { 
          'content-type': 'application/json', 
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'Content-Type'
        },
        body: JSON.stringify({ error: 'Endpoint not found' })
      };
    }

    await db.end();

    return {
      statusCode: 200,
      headers: { 
        'content-type': 'application/json', 
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'Content-Type'
      },
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Lambda execution error:', error);
    return {
      statusCode: 500,
      headers: { 
        'content-type': 'application/json', 
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'Content-Type'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

async function getSurveyQuestion(db: Client) {
  // Query one question with its answers
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

  if (questionQuery.rows.length === 0) {
    return { error: 'No questions found' };
  }

  const question = questionQuery.rows[0];

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

  return {
    question,
    answers: answersQuery.rows
  };
}

async function submitSurveyAnswer(db: Client, body?: string) {
  if (!body) {
    throw new Error('Request body is required');
  }

  const { question_id, selected_answers, timestamp } = JSON.parse(body);

  if (!question_id || !selected_answers || !Array.isArray(selected_answers)) {
    throw new Error('Invalid request: question_id and selected_answers array are required');
  }

  // For now, just log the submission (you can extend this to store in database)
  console.log('Survey answer submitted:', {
    question_id,
    selected_answers,
    timestamp,
    submitted_at: new Date().toISOString()
  });

  // You could insert into a survey_responses table here
  // For now, return success
  return {
    message: 'Answer submitted successfully',
    question_id,
    selected_answers,
    submitted_at: new Date().toISOString()
  };
}


// ALM HI hello world 