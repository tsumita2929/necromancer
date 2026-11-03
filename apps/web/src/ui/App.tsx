import { useEffect, useRef } from 'react';
import { Atmosphere } from '../design/Atmosphere';
import { LiveRegionProvider } from '../design/controls';
import { useRoute } from '../state/router';
import { findSampleTitle } from './titles';
import { About } from './About';
import { Graveyard } from './Graveyard';
import { Landing } from './Landing';
import { SiteFooter, SiteHeader } from './Chrome';

export function App() {
  const [route, navigate] = useRoute();
  const main = useRef<HTMLElement>(null);
  const firstRoute = useRef(true);

  // After a route change, scroll to the top and move focus to the page so screen readers start there.
  useEffect(() => {
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [route.name]);

  useEffect(() => {
    document.title =
      route.name === 'graveyard'
        ? `${findSampleTitle(route.view.source)} · Necromancer`
        : route.name === 'about'
          ? 'Credits · Necromancer'
          : 'Necromancer: find the dead in your dependency tree';
  }, [route]);

  return (
    <LiveRegionProvider>
      <Atmosphere />
      <a className="skip-link" href="#main" onClick={(event) => { event.preventDefault(); main.current?.focus(); }}>
        Skip to the content
      </a>
      <SiteHeader route={route} navigate={navigate} />
      <main id="main" ref={main} tabIndex={-1} className="main">
        {route.name === 'landing' ? <Landing go={navigate} /> : null}
        {route.name === 'graveyard' ? <Graveyard key={route.name} view={route.view} navigate={navigate} /> : null}
        {route.name === 'about' ? <About /> : null}
      </main>
      <SiteFooter />
    </LiveRegionProvider>
  );
}
