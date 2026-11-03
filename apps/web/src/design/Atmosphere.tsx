/** Fixed night backdrop: moon haze, cool horizon glow, two slow fog bands. Decorative only. */
export function Atmosphere() {
  return (
    <div className="atmosphere" aria-hidden="true">
      <div className="fog fog--b" />
      <div className="fog fog--a" />
    </div>
  );
}

/** A candle drawn for this project. The flame flickers unless the visitor prefers reduced motion. */
export function Candle({ className = '' }: { className?: string }) {
  return (
    <svg className={`candle ${className}`} viewBox="0 0 32 64" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="candle-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffd48a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd48a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="candle-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#f4a43a" />
          <stop offset="0.6" stopColor="#ffd48a" />
          <stop offset="1" stopColor="#fff3d6" />
        </linearGradient>
        <linearGradient id="candle-wax" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9c0a8" />
          <stop offset="0.45" stopColor="#ece6d6" />
          <stop offset="1" stopColor="#a89f88" />
        </linearGradient>
      </defs>
      <circle className="candle__glow" cx="16" cy="16" r="15" fill="url(#candle-glow)" />
      <path d="M9 30h14v30a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2z" fill="url(#candle-wax)" />
      <path d="M9 30h14v3.5c-2 2.2-3 .6-4.5 2.4-1.4 1.7-2.2-.4-4-.2-1.7.1-3.2 1.4-5.5-.4z" fill="#f6f1e2" />
      <path d="M16 29.5V24" stroke="#2a3748" strokeWidth="1.4" strokeLinecap="round" />
      <g className="candle__flame">
        <path d="M16 6c3.4 4.4 4.8 7.4 4.8 10.2A4.8 4.8 0 0 1 16 21a4.8 4.8 0 0 1-4.8-4.8C11.2 13.4 12.6 10.4 16 6z" fill="url(#candle-flame)" />
        <path d="M16 13c1.4 2 2 3.2 2 4.4a2 2 0 0 1-4 0c0-1.2.6-2.4 2-4.4z" fill="#fff8e6" opacity="0.9" />
      </g>
    </svg>
  );
}

/** The hero scene: hills, a bare tree, headstones and crosses under a moon. Static and decorative. */
export function GraveyardScene() {
  return (
    <div className="scene" aria-hidden="true">
      <div className="scene__moon" />
      <svg className="scene__art" viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax slice" focusable="false">
        <defs>
          <linearGradient id="hill-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#152031" />
            <stop offset="1" stopColor="#0c121b" />
          </linearGradient>
          <linearGradient id="hill-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0e1621" />
            <stop offset="1" stopColor="#080c12" />
          </linearGradient>
          <symbol id="s-arch" viewBox="0 0 40 64">
            <path d="M2 64V22a18 18 0 0 1 36 0v42z" />
          </symbol>
          <symbol id="s-cross" viewBox="0 0 40 64">
            <path d="M16 64V30H5v-8h11V8h8v14h11v8H24v34z" />
          </symbol>
          <symbol id="s-slab" viewBox="0 0 40 64">
            <path d="M3 64V14l5-6h24l5 6v50z" />
          </symbol>
          <symbol id="s-obelisk" viewBox="0 0 40 90">
            <path d="M12 90 15 14 20 0l5 14 3 76z" />
          </symbol>
        </defs>

        <path d="M0 230c120-40 230-46 340-20s210 38 330 8 230-58 360-34 280 52 410 6V420H0z" fill="url(#hill-far)" />
        <g fill="#0b111a" opacity="0.9">
          <use href="#s-arch" x="150" y="190" width="22" height="35" />
          <use href="#s-cross" x="230" y="196" width="18" height="30" />
          <use href="#s-slab" x="560" y="196" width="20" height="32" />
          <use href="#s-arch" x="840" y="178" width="24" height="38" />
          <use href="#s-cross" x="1180" y="190" width="20" height="32" />
        </g>

        {/* a bare tree */}
        <g stroke="#070a10" strokeLinecap="round" fill="none">
          <path d="M1190 330c-6-60-4-110 4-160" strokeWidth="14" />
          <path d="M1194 200c-30-24-58-36-84-40M1194 230c26-26 56-40 92-46M1192 172c-6-30-4-52 6-76M1198 184c26-20 44-44 52-76M1150 176c-18-4-30-14-38-30M1230 204c20-4 36-16 44-34M1196 120c-14-8-24-20-28-36" strokeWidth="5" />
        </g>

        <path d="M0 300c150-30 300-22 450-6s300 30 450 8 330-34 540-10v128H0z" fill="url(#hill-mid)" />
        <g fill="#080c12" stroke="#cdd8e8" strokeOpacity="0.16" strokeWidth="1.2">
          <use href="#s-slab" x="90" y="262" width="40" height="64" />
          <use href="#s-cross" x="300" y="268" width="38" height="60" transform="rotate(-6 319 298)" />
          <use href="#s-arch" x="470" y="256" width="46" height="74" />
          <use href="#s-arch" x="690" y="270" width="36" height="58" transform="rotate(4 708 300)" />
          <use href="#s-obelisk" x="860" y="224" width="38" height="100" />
          <use href="#s-slab" x="1010" y="268" width="38" height="60" />
          <use href="#s-cross" x="1320" y="262" width="40" height="64" transform="rotate(5 1340 294)" />
        </g>

        <path d="M0 360c200-16 420-22 640-8s520 22 800-4v72H0z" fill="#06090d" />
        <g fill="#06090d" stroke="#cdd8e8" strokeOpacity="0.2" strokeWidth="1.2">
          <use href="#s-arch" x="40" y="318" width="58" height="92" />
          <use href="#s-cross" x="170" y="334" width="48" height="76" transform="rotate(-4 194 372)" />
          <use href="#s-slab" x="1100" y="326" width="54" height="84" />
          <use href="#s-arch" x="1240" y="338" width="52" height="82" transform="rotate(5 1266 380)" />
          <use href="#s-cross" x="1370" y="330" width="48" height="76" />
        </g>
        {/* iron fence */}
        <g stroke="#06090d" strokeWidth="3" fill="#06090d">
          <path d="M340 392h330" />
          <path d="M340 380h330" />
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d={`M${346 + i * 28} 396V362l-3-8 3-4 3 4-3 8`} />
          ))}
        </g>
      </svg>
    </div>
  );
}
