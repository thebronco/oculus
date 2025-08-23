// POST /admin/seed → create tables and insert one NIST‑CSF question/answers (idempotent)
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';

export const handler = async () => {
  const sm = new SecretsManagerClient({});
  const sec = await sm.send(new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN! }));
  const { username, password } = JSON.parse(sec.SecretString!);

  const db = new Client({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: username,
    password,
    ssl: { rejectUnauthorized: false }
  });
  await db.connect();

  await db.query(`
    create table if not exists template_surveys(
      survey_template_id   text primary key,
      survey_template_name text not null
    );

    create table if not exists questions_template(
      survey_template_id   text not null,
      question_id          text primary key,
      category             text not null,
      sub_category         text not null,
      question             text not null,
      question_tool_tip    text
    );

    create table if not exists answers_options_template(
      answer_id    text primary key,
      question_id  text not null,
      answer_type  text not null,
      option       text not null
    );
  `);

  await db.query(
    `insert into template_surveys(survey_template_id, survey_template_name)
     values ($1,$2) on conflict do nothing`,
    ['nist-csf-2024', 'nist csf survey template']
  );

  await db.query(
    `insert into questions_template(
       survey_template_id, question_id, category, sub_category, question, question_tool_tip
     ) values ($1,$2,$3,$4,$5,$6)
     on conflict do nothing`,
    [
      'nist-csf-2024',
      'id_am_01',
      'Identify: Asset Management',
      'SBOM',
      'Do you implement a Software Bill of Materials (SBOM) to track third-party components?',
      'Tracking dependencies using tools like Sonatype or JFrog Xray'
    ]
  );

  await db.query(
    `insert into answers_options_template(answer_id, question_id, answer_type, option)
     values 
       ('id_am_01_a1','id_am_01','radio','yes'),
       ('id_am_01_a2','id_am_01','radio','no')
     on conflict do nothing`
  );

  await db.end();

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    body: JSON.stringify({ seeded: true })
  };
};
