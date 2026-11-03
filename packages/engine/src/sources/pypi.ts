import type { Http } from '../net/http.js';
import { asArray, asBoolean, asString, isRecord, type UnknownRecord } from '../util/guards.js';
import { parseRepoUrl, type RepoRef } from './repo.js';
import { badShape, fail, type Fetched } from './result.js';

export interface PypiRelease {
  version: string;
  /** Earliest upload time of the release's files. */
  date?: string;
  /** True when it has files and all of them are yanked. */
  yanked: boolean;
  yankedReason?: string;
}

export interface PypiProject {
  latest: string;
  inactive: boolean;
  /** The project's newest release is yanked (PyPI reports this on `info`). */
  latestYanked: boolean;
  yankedReason?: string;
  releases: PypiRelease[];
  repo?: RepoRef;
}

const INACTIVE = 'Development Status :: 7 - Inactive';
const PREFERRED_KEYS = /source|repo|code|github|gitlab|git\b|bitbucket/i;

function pickRepo(info: UnknownRecord): RepoRef | undefined {
  const candidates: Array<{ key: string; url: string }> = [];
  const urls = info['project_urls'];
  if (isRecord(urls)) {
    for (const [key, value] of Object.entries(urls)) {
      if (typeof value === 'string') candidates.push({ key, url: value });
    }
  }
  for (const field of ['home_page', 'download_url', 'project_url']) {
    const value = asString(info[field]);
    if (value) candidates.push({ key: field, url: value });
  }
  candidates.sort(
    (a, b) => Number(PREFERRED_KEYS.test(b.key)) - Number(PREFERRED_KEYS.test(a.key)),
  );
  for (const { url } of candidates) {
    const repo = parseRepoUrl(url);
    if (repo) return repo;
  }
  return undefined;
}

/** `GET pypi.org/pypi/{name}/json`, reduced to the fields the engine reads. */
export async function getPypiProject(http: Http, name: string): Promise<Fetched<PypiProject>> {
  const r = await http.request(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
  if (!r.ok) return fail(r);
  if (!isRecord(r.data) || !isRecord(r.data['info'])) return badShape('PyPI project');
  const info = r.data['info'];
  const latest = asString(info['version']);
  if (!latest) return badShape('PyPI project (no version)');
  const releases: PypiRelease[] = [];
  const raw = r.data['releases'];
  if (isRecord(raw)) {
    for (const [version, files] of Object.entries(raw)) {
      const list = asArray(files).filter(isRecord);
      if (list.length === 0) continue;
      let date: string | undefined;
      let allYanked = true;
      let reason: string | undefined;
      for (const file of list) {
        const when = asString(file['upload_time_iso_8601']) ?? asString(file['upload_time']);
        if (when && (!date || when < date)) date = when;
        if (asBoolean(file['yanked']) !== true) allYanked = false;
        else reason = reason ?? asString(file['yanked_reason']);
      }
      const release: PypiRelease = { version, yanked: allYanked };
      if (date) release.date = date;
      if (allYanked && reason) release.yankedReason = reason;
      releases.push(release);
    }
  }
  const classifiers = asArray(info['classifiers']).filter(
    (c): c is string => typeof c === 'string',
  );
  const project: PypiProject = {
    latest,
    inactive: classifiers.includes(INACTIVE),
    latestYanked: asBoolean(info['yanked']) === true,
    releases,
  };
  const reason = asString(info['yanked_reason']);
  if (project.latestYanked && reason) project.yankedReason = reason;
  const repo = pickRepo(info);
  if (repo) project.repo = repo;
  return { ok: true, value: project };
}
