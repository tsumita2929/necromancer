import type { SVGProps } from 'react';
import type { Verdict } from '@contract';

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps): IconProps {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
    ...props,
  };
}

/** One silhouette per verdict, so shape alone also tells them apart. */
export function VerdictIcon({ verdict, ...props }: IconProps & { verdict: Verdict }) {
  switch (verdict) {
    case 'alive': // a sprig
      return (
        <svg {...base(props)}>
          <path d="M12 21v-9" />
          <path d="M12 13c0-4 3-6.5 7.5-6.5 0 4-3 6.5-7.5 6.5z" />
          <path d="M12 16c0-3-2.2-5-6.5-5 0 3 2.2 5 6.5 5z" />
        </svg>
      );
    case 'dying': // an hourglass
      return (
        <svg {...base(props)}>
          <path d="M6.5 3h11M6.5 21h11" />
          <path d="M8 3v3.5l4 5.5-4 5.5V21M16 3v3.5l-4 5.5 4 5.5V21" />
        </svg>
      );
    case 'dead': // a cross-marked headstone
      return (
        <svg {...base(props)}>
          <path d="M6.5 21V10.5a5.5 5.5 0 0 1 11 0V21z" />
          <path d="M12 8v7M9.2 11h5.6" />
        </svg>
      );
    case 'ghost': // a ghost
      return (
        <svg {...base(props)}>
          <path d="M5.5 21V11a6.5 6.5 0 0 1 13 0v10l-2.6-2.2L13.3 21 12 19.2 10.7 21l-2.6-2.2z" />
          <circle cx="9.7" cy="11" r="1" fill="currentColor" stroke="none" />
          <circle cx="14.3" cy="11" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'zombie': // a hand rising from the ground
      return (
        <svg {...base(props)}>
          <path d="M3 21h18" />
          <path d="M8 21v-3.5l-2-3.5a1.2 1.2 0 0 1 2-1.2l1 1.4V7.5a1.2 1.2 0 0 1 2.4 0V12" />
          <path d="M11.4 12V6a1.2 1.2 0 0 1 2.4 0v6M13.8 12V7.5a1.2 1.2 0 0 1 2.4 0V13l.8 8" />
        </svg>
      );
  }
}

export function WarningIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5 2.8 19.5h18.4z" />
      <path d="M12 10v4.5M12 17.2v.1" />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.8v.1" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function ExternalIcon(props: IconProps) {
  return (
    <svg {...base({ strokeWidth: 2, ...props })}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 16V4M7 9l5-5 5 5M4 17v3h16v-3" />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}
