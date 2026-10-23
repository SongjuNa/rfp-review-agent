export type Health = {
  status: 'ok' | 'degraded'
  database: 'ok' | 'down'
  schema_version: string | null
  llm_configured: boolean
}

export async function fetchHealth(): Promise<Health> {
  const res = await fetch('/api/health')
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}
