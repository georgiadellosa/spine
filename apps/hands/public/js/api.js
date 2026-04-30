export async function parseCsv(csv) {
  const res = await fetch('/api/parse-csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv })
  });
  if (!res.ok) throw new Error('CSV parse failed');
  return res.json();
}
