import type { Route } from '../state/url';

function Mark() {
  return (
    <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M7 28V14a9 9 0 0 1 18 0v14z" fill="#1d2735" stroke="#cdd8e8" strokeWidth="1.6" />
      <path d="M16 10v10M11.5 14.5h9" stroke="#f4b95a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SiteHeader({ route, navigate }: { route: Route; navigate: (route: Route) => void }) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a
          className="brand"
          href="#/"
          onClick={(event) => {
            event.preventDefault();
            navigate({ name: 'landing' });
          }}
        >
          <Mark />
          <span className="brand__name">Necromancer</span>
        </a>
        <nav aria-label="Main">
          <ul className="nav">
            <li>
              <a href="#/" aria-current={route.name === 'landing' ? 'page' : undefined}>
                Autopsy
              </a>
            </li>
            <li>
              <a href="#/about" aria-current={route.name === 'about' ? 'page' : undefined}>
                Credits
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p>
          Static site. No login, no tracking. Only public data is read, and nothing is stored on your device.
        </p>
        <p>
          <a href="#/about">Credits and licences</a>
        </p>
      </div>
    </footer>
  );
}
