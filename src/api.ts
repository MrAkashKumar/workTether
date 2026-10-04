export type Entity = { id: string; [key: string]: any };
export type User = { id: string; name: string; email: string };
export type PageInfo = {total: number; offset: number; limit: number; nextOffset: number | null};
export type Bootstrap = {
  user: User;
  projects: Entity[];
  project: Entity | null;
  members: Entity[];
  works: Entity[];
  sources: Entity[];
  edges: Entity[];
  handoffs: Entity[];
  devices: Entity[];
  credentials: Entity[];
  events: Entity[];
  attachments: Entity[];
  revisions: Entity[];
  workPage: PageInfo;
  sourcePage: PageInfo;
  revisionPage: PageInfo;
  handoffPage: PageInfo;
  evidenceCounts: {verified: number; needs_review: number; unverified: number; total: number};
};

export class ApiError extends Error {
  constructor(message: string, public code: string, public details?: any, public status?: number) { super(message); }
}

export async function request<T = any>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    method: body === undefined ? 'GET' : 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new ApiError(result.error?.message || result.message || 'The request could not be completed.', result.error?.code || 'REQUEST_FAILED', result.error?.details, response.status);
  return result;
}

export function action<T = any>(name: string, input: Record<string, any> = {}): Promise<T> {
  return request<T>('/api/action', { action: name, input });
}

export function bootstrap(projectId?: string, options: Record<string, string | number> = {}): Promise<Bootstrap> {
  const params = new URLSearchParams(Object.entries(options).map(([key, value]) => [key, String(value)]));
  if (projectId) params.set('projectId', projectId);
  return request(`/api/bootstrap?${params}`);
}

export function shortId(id?: string) { return id ? `${id.split('_')[0].toUpperCase()}_${id.split('_').slice(1).join('_').slice(0,8).toUpperCase()}` : '—'; }
export function ago(value?: string | number | null) {
  if (!value) return 'Not observed yet';
  const difference = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(difference)) return 'Not observed yet';
  if (difference < 60000) return 'Just now';
  if (difference < 3600000) return `${Math.floor(difference / 60000)} min ago`;
  if (difference < 86400000) return `${Math.floor(difference / 3600000)} hr ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
