// A cassette holds every HTTP answer one recording run received, in order, so the same run can be replayed
// through the engine later with no network (scripts/verify-samples.mjs). Used by record-samples.mjs.
import { gunzipSync, gzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const CASSETTE_DIR = fileURLToPath(new URL('../../test-data/cassettes/', import.meta.url));

/**
 * A PyPI answer is mostly the project's README (info.description) and the file list of every release. The engine
 * reads `info` (project_urls, yanked, yanked_reason, ...) and, for each file of each release, only the upload time
 * and the yanked flag and reason. The cassette keeps those fields and drops the rest, so a sample's cassette stays
 * a few hundred kilobytes. scripts/verify-samples.mjs replays the trimmed answers: if the engine needed a dropped
 * field, the replay would differ from the recorded report and the check would fail.
 */
export function trimAnswer(url, text) {
  if (new URL(url).hostname !== 'pypi.org') return text;
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return text;
  }
  if (!doc || typeof doc !== 'object') return text;
  if (doc.info && typeof doc.info === 'object') {
    delete doc.info.description;
    delete doc.info.summary;
    delete doc.info.classifiers;
  }
  delete doc.urls;
  delete doc.vulnerabilities;
  if (doc.releases && typeof doc.releases === 'object') {
    for (const [version, files] of Object.entries(doc.releases)) {
      if (!Array.isArray(files)) continue;
      doc.releases[version] = files.map((f) => ({
        upload_time_iso_8601: f.upload_time_iso_8601,
        upload_time: f.upload_time,
        yanked: f.yanked,
        yanked_reason: f.yanked_reason,
      }));
    }
  }
  return JSON.stringify(doc);
}

const keyOf = (method, url, body) => `${method} ${url} ${body ?? ''}`;

/** Wraps a fetch so every answer is kept. The wrapper returns the minimal response shape the engine and github.ts read. */
export function recordingFetch(realFetch) {
  const entries = [];
  const fetchLike = async (url, init) => {
    const method = init?.method ?? 'GET';
    const body = init?.body;
    let response;
    try {
      response = await realFetch(url, init);
    } catch (error) {
      entries.push({ method, url, body, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
    const text = await response.text();
    const contentLength = response.headers?.get?.('content-length') ?? null;
    entries.push({ method, url, body, status: response.status, contentLength, text: trimAnswer(url, text) });
    return makeResponse(response.status, contentLength, text);
  };
  return { fetch: fetchLike, entries };
}

function makeResponse(status, contentLength, text) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-length' ? contentLength : null) },
    json: async () => JSON.parse(text),
    text: async () => text,
  };
}

/** A fetch that answers from the entries, in the order they were recorded for each request. An unknown request is an error. */
export function replayingFetch(entries) {
  const queues = new Map();
  for (const entry of entries) {
    const key = keyOf(entry.method, entry.url, entry.body);
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key).push(entry);
  }
  const missing = [];
  const fetchLike = async (url, init) => {
    const key = keyOf(init?.method ?? 'GET', url, init?.body);
    const queue = queues.get(key);
    if (!queue || queue.length === 0) {
      missing.push(key);
      throw new Error(`not in the cassette: ${key}`);
    }
    // The last answer repeats when the engine asks again than it did at recording time.
    const entry = queue.length > 1 ? queue.shift() : queue[0];
    if (entry.error) throw new Error(entry.error);
    return makeResponse(entry.status, entry.contentLength, entry.text);
  };
  return { fetch: fetchLike, missing };
}

export async function saveCassette(id, meta, entries) {
  await mkdir(CASSETTE_DIR, { recursive: true });
  const data = JSON.stringify({ ...meta, entries });
  await writeFile(`${CASSETTE_DIR}${id}.json.gz`, gzipSync(Buffer.from(data), { level: 9 }));
}

export async function loadCassette(id) {
  return JSON.parse(gunzipSync(await readFile(`${CASSETTE_DIR}${id}.json.gz`)).toString('utf8'));
}
