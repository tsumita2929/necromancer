import { ExtLink } from '../design/controls';

const FONTS = [
  { name: 'IM Fell English SC and IM Fell English Italic', author: 'Igino Marini', licence: 'SIL Open Font License 1.1', file: 'licenses/IM-Fell-English-SC-OFL.txt', use: 'Headings and epitaphs' },
  { name: 'Source Sans 3 Variable', author: 'Adobe', licence: 'SIL Open Font License 1.1', file: 'licenses/Source-Sans-3-OFL.txt', use: 'Body text' },
  { name: 'JetBrains Mono Variable', author: 'The JetBrains Mono Project Authors', licence: 'SIL Open Font License 1.1', file: 'licenses/JetBrains-Mono-OFL.txt', use: 'Versions, identifiers and paths' },
];

const SOURCES = [
  'npm registry',
  'PyPI JSON API',
  'deps.dev, including OpenSSF Scorecard',
  'OSV.dev advisories',
  'GitHub REST API (unauthenticated)',
  'e18e module replacements',
];

export function About() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="page page--narrow prose">
      <h1 className="page__title">Credits and licences</h1>
      <section aria-labelledby="about-fonts">
        <h2 id="about-fonts">Fonts</h2>
        <p>All fonts are served from this site under the SIL Open Font License 1.1. No font is loaded from another host.</p>
        <ul className="credits">
          {FONTS.map((font) => (
            <li key={font.name}>
              <p className="credits__name">{font.name}</p>
              <p>
                {font.use}. By {font.author}. {font.licence}.{' '}
                <ExtLink href={`${base}${font.file}`}>Read the licence</ExtLink>
              </p>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="about-art">
        <h2 id="about-art">Art</h2>
        <p>
          The graveyard scene, the candle, the icons and the logo mark were drawn for this project. They use no third-party artwork and no trademarks.
        </p>
      </section>
      <section aria-labelledby="about-data">
        <h2 id="about-data">Where the facts come from</h2>
        <p>Necromancer reads public data only, straight from your browser. No account, no key and no server of ours is involved.</p>
        <ul className="plainlist">
          {SOURCES.map((source) => (
            <li key={source}>{source}</li>
          ))}
        </ul>
        <p>
          The samples on the start page are real. The engine examined those public repositories on the day shown, and
          the reports are kept exactly as the engine wrote them. Nothing in them was written by hand.
        </p>
        <p>
          A verdict is a reading of public signals, not a judgement of a maintainer. A package can be finished rather
          than dead, so every verdict shows the evidence behind it.
        </p>
      </section>
      <section aria-labelledby="about-privacy">
        <h2 id="about-privacy">Privacy</h2>
        <p>The app stores nothing on your device and sets no cookies. Files you drop are read in your browser.</p>
      </section>
      <p>
        <a href="#/">← Back to the start</a>
      </p>
    </div>
  );
}
