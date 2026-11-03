export type AutopsyErrorCode =
  | 'invalid'
  | 'not-found'
  | 'no-manifest'
  | 'rate-limited'
  | 'unreachable'
  | 'too-large'
  | 'cancelled';

/** An autopsy that cannot produce a graveyard. The text is for the visitor. */
export class AutopsyError extends Error {
  readonly code: AutopsyErrorCode;
  /** What the visitor can do next. */
  readonly hint: string;

  constructor(code: AutopsyErrorCode, message: string, hint = '') {
    super(message);
    this.name = 'AutopsyError';
    this.code = code;
    this.hint = hint;
  }
}

export function isAbort(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof AutopsyError && error.code === 'cancelled')
  );
}

/** A fact about the result that is not part of the report. */
export interface Note {
  kind: 'info' | 'warning';
  title: string;
  text: string;
}
