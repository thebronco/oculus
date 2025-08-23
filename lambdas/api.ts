// GET /survey/nist-csf → return one NIST‑CSF question + answers.
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';

export const handler = async () => {
  // Read DB credentials from Secrets Manager (v3 client)
  const sm = new SecretsManagerClient({});
  const sec = await sm.send(new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN! }));
  const { username, password } = JSON.parse(sec.SecretString!);

  // Connect to Postgres through RDS Proxy
  const db = new Client({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: username,
    password,
    ssl: { rejectUnauthorized: false }
  });
  await db.connect();

  // Query one question + its answers
  const q = await db.query(`
    select t.question_id, t.question,
           json_agg(json_build_object('answer_id', a.answer_id, 'option', a.option) order by a.answer_id) as answers
    from questions_template t
    join answers_options_template a on a.question_id = t.question_id
    where t.question_id = 'id_am_01'
    group by t.question_id, t.question
  `);

  await db.end();

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    body: JSON.stringify(q.rows[0] ?? {})
  };
};
