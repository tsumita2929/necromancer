import { createContext, useCallback, useContext, useMemo, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ExternalIcon, InfoIcon, WarningIcon } from './icons';

/* ---------- Button ---------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'quiet';
  size?: 'normal' | 'large';
};

export function Button({ variant = 'default', size = 'normal', className = '', type = 'button', ...rest }: ButtonProps) {
  const classes = ['btn', variant !== 'default' ? `btn--${variant}` : '', size === 'large' ? 'btn--large' : '', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest} />;
}

/* ---------- External link: opens a new tab and says so ---------- */
export function ExtLink({ children, className = '', ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={`extlink ${className}`} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
      <ExternalIcon className="extlink__icon" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/* ---------- Callout ---------- */
export function Callout({
  kind = 'info',
  title,
  children,
  role,
}: {
  kind?: 'info' | 'warning' | 'error';
  title?: string;
  children: ReactNode;
  role?: 'status' | 'alert';
}) {
  const Icon = kind === 'info' ? InfoIcon : WarningIcon;
  return (
    <div className={`callout callout--${kind}`} role={role}>
      <Icon className="callout__icon" />
      <div>
        {title ? <p className="callout__title">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}

/* ---------- Live region: one polite channel for every announcement ---------- */
const AnnounceContext = createContext<(message: string) => void>(() => {});

export function useAnnounce(): (message: string) => void {
  return useContext(AnnounceContext);
}

export function LiveRegionProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  // Alternate a trailing space so repeating the same message is announced again.
  const [flip, setFlip] = useState(false);
  const announce = useCallback((text: string) => {
    setFlip((value) => !value);
    setMessage(text);
  }, []);
  const value = useMemo(() => announce, [announce]);
  return (
    <AnnounceContext.Provider value={value}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="live-region">
        {message}
        {flip ? '\u00a0' : ''}
      </div>
    </AnnounceContext.Provider>
  );
}

/* ---------- Dates ---------- */
const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "11 Feb 2020". Returns the raw text for anything that is not a date, and '' for nothing. */
export function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const time = Date.parse(iso);
  return Number.isNaN(time) ? iso : DATE_FORMAT.format(new Date(time));
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
