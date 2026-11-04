import type { ManifestFile } from '@contract';

/**
 * pnpm catalogs (QA-22). A package.json entry `"react": "catalog:"` or `"catalog:react18"` takes its version from
 * pnpm-workspace.yaml. This reads the small part of that YAML which holds the catalogs and writes the versions into the
 * package.json text handed to the engine, so those dependencies are examined like any other. It understands block
 * mappings with plain or quoted keys and values and `#` comments. Anything else (flow style, anchors) is not read, and the
 * entry stays "not read": a wrong version would be worse than none.
 */
export interface Catalogs {
  /** `catalog:` (also `catalog:default`). */
  default: Record<string, string>;
  /** `catalogs: { name: { pkg: version } }`. */
  named: Record<string, Record<string, string>>;
  /** What in the file the reader could not understand, for the catalog sections only (QA-34). Empty when it understood all. */
  issues: string[];
}

function unquote(text: string): string {
  const t = text.trim();
  if (t.length >= 2 && ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"')))) return t.slice(1, -1);
  return t;
}

/** Cuts a trailing comment from a value, outside quotes. */
function stripComment(text: string): string {
  let quote = '';
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '#' && (i === 0 || /\s/.test(text[i - 1] ?? ''))) return text.slice(0, i);
  }
  return text;
}

/** Splits `key: value` at the first colon that ends the key (quoted keys may hold colons and `@`). */
function splitEntry(line: string): { key: string; value: string } | null {
  const t = line.trim();
  let i = 0;
  if (t[0] === '"' || t[0] === "'") {
    const q = t[0];
    i = t.indexOf(q, 1);
    if (i < 0) return null;
    i += 1;
    if (t[i] !== ':') return null;
    return { key: t.slice(1, i - 1), value: t.slice(i + 1).trim() };
  }
  const colon = t.indexOf(':');
  if (colon <= 0) return null;
  return { key: t.slice(0, colon).trim(), value: t.slice(colon + 1).trim() };
}

export function parseCatalogs(yaml: string): Catalogs {
  const out: Catalogs = { default: {}, named: {}, issues: [] };
  const issue = (text: string): void => {
    if (!out.issues.includes(text)) out.issues.push(text);
  };
  const ANCHOR = /(^|\s)[&*][\w-]+/;
  type Frame = { indent: number; target: 'top' | 'default' | 'catalogs' | 'named'; name?: string };
  const stack: Frame[] = [{ indent: -1, target: 'top' }];
  for (const rawLine of yaml.replace(/\r/g, '').split('\n')) {
    const body = stripComment(rawLine);
    if (body.trim() === '' || body.trim() === '---') continue;
    const indent = body.length - body.trimStart().length;
    const entry = splitEntry(body);
    if (!entry) continue;
    while (stack.length > 1 && indent <= (stack[stack.length - 1] as Frame).indent) stack.pop();
    const parent = stack[stack.length - 1] as Frame;
    const key = unquote(entry.key);
    if (key === '__proto__') continue;
    const value = entry.value;
    if (parent.target === 'top') {
      if (value === '' && key === 'catalog') stack.push({ indent, target: 'default' });
      else if (value === '' && key === 'catalogs') stack.push({ indent, target: 'catalogs' });
      else if (key === 'catalog' || key === 'catalogs') issue(ANCHOR.test(value) ? 'it uses YAML anchors or aliases' : 'its catalog is written in flow style or on one line');
      continue;
    }
    if (key === '<<') issue('it uses YAML merge keys');
    if (ANCHOR.test(value)) issue('it uses YAML anchors or aliases');
    else if (/^[[{|>]/.test(value)) issue('its catalog is written in flow style or as a text block');
    if (parent.target === 'default') {
      if (value !== '' && !/^[[{&*|>]/.test(value)) out.default[key] = unquote(value);
      continue;
    }
    if (parent.target === 'catalogs') {
      if (value === '') {
        if (key === 'default') stack.push({ indent, target: 'default' });
        else {
          out.named[key] = out.named[key] ?? {};
          stack.push({ indent, target: 'named', name: key });
        }
      }
      continue;
    }
    if (parent.target === 'named' && parent.name !== undefined && value !== '' && !/^[[{&*|>]/.test(value)) {
      (out.named[parent.name] as Record<string, string>)[key] = unquote(value);
    }
  }
  return out;
}

export function hasCatalogEntries(packageJson: string): boolean {
  return /"catalog:/.test(packageJson);
}

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const;

export interface CatalogResolution {
  file: ManifestFile;
  /** `catalog:` entries replaced by a version. */
  resolved: number;
  /** `catalog:` entries that stay, because the catalog has no such package. */
  unresolved: number;
}

/** Writes the versions of the catalogs into one package.json. Returns the file unchanged when nothing is replaced. */
export function resolveCatalogs(file: ManifestFile, catalogs: Catalogs): CatalogResolution {
  let json: unknown;
  try {
    json = JSON.parse(file.content.replace(/^\uFEFF/, ''));
  } catch {
    return { file, resolved: 0, unresolved: 0 };
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) return { file, resolved: 0, unresolved: 0 };
  let resolved = 0;
  let unresolved = 0;
  for (const field of DEPENDENCY_FIELDS) {
    const table = (json as Record<string, unknown>)[field];
    if (!table || typeof table !== 'object' || Array.isArray(table)) continue;
    for (const [name, spec] of Object.entries(table as Record<string, unknown>)) {
      if (typeof spec !== 'string' || name === '__proto__') continue;
      const match = /^catalog:(.*)$/i.exec(spec.trim());
      if (!match) continue;
      const catalogName = (match[1] ?? '').trim();
      const source = catalogName === '' || catalogName === 'default' ? { ...catalogs.named['default'], ...catalogs.default } : catalogs.named[catalogName];
      const version = source ? Object.prototype.hasOwnProperty.call(source, name) ? source[name] : undefined : undefined;
      if (version !== undefined && version !== '' && !/^(catalog|workspace):/i.test(version)) {
        (table as Record<string, unknown>)[name] = version;
        resolved += 1;
      } else unresolved += 1;
    }
  }
  if (resolved === 0) return { file, resolved: 0, unresolved };
  return { file: { ...file, content: JSON.stringify(json, null, 2) }, resolved, unresolved };
}
