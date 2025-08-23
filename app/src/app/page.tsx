'use client';
import { useEffect, useState } from 'react';

type Answer = { answer_id: string; option: string };
type OneQ = { question_id: string; question: string; answers: Answer[] };

export default function Home() {
  const [data, setData] = useState<OneQ | null>(null);
  const [picked, setPicked] = useState<string>('');
  const [err, setErr] = useState<string>('');

  // The API URL must end with a trailing slash (e.g., https://abc.execute-api.us-east-1.amazonaws.com/prod/)
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    if (!API) { setErr('API URL not set'); return; }
    fetch(`${API}survey/nist-csf`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setErr('Failed to load question'));
  }, [API]);

  return (
    <main style={{maxWidth:800, margin:'40px auto', fontFamily:'system-ui'}}>
      <h1>Oculus Cyber — NIST CSF Quick Check</h1>
      {!data && !err && <p>Loading…</p>}
      {err && <p style={{color:'crimson'}}>{err}</p>}
      {data && (
        <>
          <h2 style={{margin:'12px 0'}}>{data.question}</h2>
          <div style={{display:'flex', gap:16}}>
            {data.answers.map(a => (
              <label key={a.answer_id} style={{display:'inline-flex', gap:8, alignItems:'center'}}>
                <input
                  type="radio"
                  name={data.question_id}
                  checked={picked === a.answer_id}
                  onChange={() => setPicked(a.answer_id)}
                />
                {a.option}
              </label>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
