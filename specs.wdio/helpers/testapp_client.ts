const BASE = 'http://localhost:3001';

export async function deleteFacts(): Promise<void> {
  const res = await fetch(`${BASE}/deleteFacts`);

  if (!res.ok) {
    throw new Error(`deleteFacts failed: ${res.status} ${await res.text()}`);
  }
}

export async function getFactCount(): Promise<number> {
  const res = await fetch(`${BASE}/getFactCount`);
  const { count } = await res.json() as { count: number };
  return count;
}

export async function queryFactCount(
  subject: string,
  predicate: string,
  object: string,
): Promise<number> {
  const params = new URLSearchParams({ subject, predicate, object });
  const res = await fetch(`${BASE}/queryFacts?${params}`);
  const { count } = await res.json() as { count: number };
  return count;
}

export async function insertQuotaEvent(
  nodeId: string,
  totalStorageAvailable: number,
): Promise<void> {
  const res = await fetch(`${BASE}/insertQuotaEvent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodeId, totalStorageAvailable, validFrom: new Date().toISOString() }),
  });

  if (!res.ok) {
    throw new Error(`insertQuotaEvent failed: ${res.status} ${await res.text()}`);
  }
}
