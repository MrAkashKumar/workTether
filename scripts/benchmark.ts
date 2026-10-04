import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, platform, arch, cpus, totalmem } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createApp } from '../server/index';

const directory = mkdtempSync(join(tmpdir(), 'worktether-benchmark-'));
const path = join(directory, 'benchmark.sqlite');
const runtime = createApp(path, { seed: false });
const actors = Array.from({ length: 20 }, (_, i) => runtime.store.register({ name: `Benchmark ${i}`, email: `benchmark${i}@example.test`, password: 'benchmark-fixture-only' }));
// Bulk fixture insertion measures operations rather than fixture setup. No live data is touched.
const database = new DatabaseSync(path);
const insert = database.prepare('INSERT INTO records(entity,id,body) VALUES(?,?,?)');
const put = (entity: string, value: any) => insert.run(entity, value.id, JSON.stringify(value));
const time = new Date().toISOString();
const projects = Array.from({ length: 5 }, () => `prj_${randomUUID()}`);
database.exec('BEGIN');
for (const projectId of projects) {
  put('project', { id: projectId, name: 'Synthetic benchmark', ownerId: actors[0].user.id, objective: 'Measure permission-filtered text operations', requirements: 'Keep private records out of other accounts.', revision: 1, createdAt: time });
  for (const actor of actors) put('membership', { id: `${projectId}:${actor.user.id}`, projectId, userId: actor.user.id });
}
for (let i = 0; i < 60; i++) put('device', { id: `dev_benchmark_${i}`, userId: actors[i % 20].user.id, name: `Synthetic device ${i}`, platform: i % 2 ? 'Windows' : 'macOS', client: 'Benchmark fixture', revoked: false, lastSeenAt: null, createdAt: time });
const works: any[] = [];
for (let i = 0; i < 1000; i++) {
  const work = { id: `wrk_${randomUUID()}`, projectId: projects[Math.floor(i / 200)], ownerId: actors[i % 20].user.id, title: `Benchmark objective ${i}`, objective: 'Retrieve current evidence under a bounded budget.', nextAction: 'Review the next result.', revision: 1, reviewedProjectRevision: 1, needsReview: false, visibility: i % 3 ? 'private' : 'project', status: 'active', updatedAt: time };
  works.push(work); put('work', work);
  for (let j = 0; j < 10; j++) put('source', { id: `src_${randomUUID()}`, workId: work.id, authorId: work.ownerId, kind: j % 2 ? 'evidence' : 'decision', title: `Source ${j}`, content: 'Synthetic evidence text. '.repeat(8), revision: 1, status: j % 2 ? 'verified' : 'accepted', supersedesId: null, createdAt: time, updatedAt: time });
}
for (let i = 0; i < 100; i++) put('handoff', { id: `hnd_${randomUUID()}`, senderId: actors[0].user.id, recipientId: actors[1].user.id, projectId: projects[0], workId: works[0].id, workRevision: 1, title: 'Synthetic selected snapshot', content: 'Synthetic handoff', sourceSnapshots: [], attachmentIds: [], state: 'queued', stale: false, revoked: false, createdAt: time });
database.exec('COMMIT'); database.close();
const server = runtime.app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const samples: Record<string, number[]> = { list_work: [], get_context: [], list_inbox: [] };
try {
  for (const operation of Object.keys(samples)) {
    const measure = async (index: number) => {
      const actor = operation === 'list_inbox' ? actors[1] : actors[index % 20];
      const work = works.find(w => w.projectId === projects[0] && w.ownerId === actor.user.id)!;
      const input = operation === 'list_work' ? { projectId: projects[0], limit: 40 } : operation === 'get_context' ? { workId: work.id, budgetBytes: 16000 } : { limit: 40 };
      const start = performance.now();
      const response = await fetch(`${base}/api/action`, { method: 'POST', headers: { Authorization: `Bearer ${actor.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: operation === 'list_work' ? 'list_works' : operation, input }) });
      const result = await response.json() as any;
      if (!response.ok) throw new Error(`Benchmark ${operation} failed: ${result.error?.code}`);
      if (operation === 'get_context' && Buffer.byteLength(JSON.stringify(result)) > 16000) throw new Error('Context exceeded budget.');
      samples[operation].push(performance.now() - start);
    };
    await measure(0); samples[operation] = []; // One unreported warmup per operation.
    for (let batch = 0; batch < 3; batch++) await Promise.all(Array.from({ length: 10 }, (_, i) => measure(batch * 10 + i)));
  }
  const metrics = Object.fromEntries(Object.entries(samples).map(([name, values]) => { const sorted = values.sort((a, b) => a - b); return [name, { samples: sorted.length, p50Ms: Math.round(sorted[Math.ceil(sorted.length * .5) - 1]), p95Ms: Math.round(sorted[Math.ceil(sorted.length * .95) - 1]), maxMs: Math.round(sorted.at(-1)!) }]; }));
  const report = { measuredAt: new Date().toISOString(), machine: { platform: platform(), architecture: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, ramGiB: Math.round(totalmem() / 1024 ** 3), node: process.version }, workload: { users: 20, devices: 60, projects: 5, works: 1000, sources: 10000, handoffs: 100, concurrentClients: 10 }, transport: 'Authenticated local HTTP API sharing the MCP domain store; production build server; synthetic text fixture', metrics, caveats: ['Single-process SQLite and one local machine.', 'Synthetic data and 30 measured requests per operation; not a hosted capacity claim.', 'Devices are records; operating systems were not physically tested.', 'No model inference, WAN latency, attachment load or full dashboard bootstrap included.'] };
  writeFileSync('docs/benchmark-results.json', JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await runtime.close(); rmSync(directory, { recursive: true, force: true });
}
