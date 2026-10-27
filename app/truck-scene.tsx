// Animated road scene for the landing hero: a LOGIPAY truck drives while the landscape moves past.
// Pure SVG + CSS animations, so it costs no JavaScript and respects reduced-motion settings.

function Hills({ className, color, path }: { className: string; color: string; path: string }) {
  return (
    <div className={`ts-layer ${className}`}>
      {[0, 1].map((copy) => (
        <svg key={copy} viewBox="0 0 800 120" preserveAspectRatio="none" aria-hidden="true"><path d={path} fill={color} /></svg>
      ))}
    </div>
  );
}

function Wheel({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 118)`}>
      <circle r="15" fill="#101820" />
      <g className="ts-wheel">
        <circle r="8" fill="#9fb2bd" />
        <path d="M0-8V8M-8 0H8M-5.6-5.6 5.6 5.6M-5.6 5.6 5.6-5.6" stroke="#4d6070" strokeWidth="1.6" />
      </g>
      <circle r="2.5" fill="#dfe8ec" />
    </g>
  );
}

export function TruckScene() {
  return (
    <div className="ts" aria-hidden="true">
      <div className="ts-sky">
        <i className="ts-sun" />
        <i className="ts-cloud ts-cloud-1" />
        <i className="ts-cloud ts-cloud-2" />
        <i className="ts-cloud ts-cloud-3" />
      </div>
      <Hills className="ts-far" color="#b9e3dd" path="M0 120V70C80 40 140 30 220 52S360 92 440 64 600 18 680 40 780 70 800 60V120Z" />
      <Hills className="ts-near" color="#7fcfc2" path="M0 120V88C70 70 120 64 200 80S330 108 420 90 560 58 650 76 760 98 800 86V120Z" />
      <div className="ts-poles">{Array.from({ length: 6 }, (_, index) => <i key={index} style={{ left: `${index * 20}%` }} />)}</div>
      <div className="ts-road"><i className="ts-lane" /></div>
      <div className="ts-truck">
        <svg viewBox="0 0 300 140" aria-hidden="true">
          <defs>
            <linearGradient id="ts-trailer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dfe9ed" /></linearGradient>
            <linearGradient id="ts-cab" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#16b8a3" /><stop offset="1" stopColor="#1b8fc9" /></linearGradient>
          </defs>
          <ellipse cx="150" cy="134" rx="138" ry="6" fill="#0b1a29" opacity=".18" />
          <rect x="8" y="22" width="196" height="88" rx="8" fill="url(#ts-trailer)" stroke="#c8d6dc" strokeWidth="2" />
          <g transform="translate(40 50)">
            <rect width="26" height="26" rx="7" fill="url(#ts-cab)" />
            <path d="M7 19l3-11M12 19l3-11M17 19l3-11" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
            <text x="36" y="20" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="19" letterSpacing="3" fill="#0b1a29">LOGIPAY</text>
          </g>
          <rect x="8" y="104" width="196" height="8" rx="3" fill="#2a3a46" />
          <path d="M210 112V56c0-8 6-14 14-14h28c6 0 11 3 14 8l20 30c2 3 3 6 3 10v22Z" fill="url(#ts-cab)" />
          <path d="M232 52h22c4 0 7 2 9 5l13 20h-44Z" fill="#dff4fb" opacity=".95" />
          <rect x="280" y="96" width="10" height="6" rx="2" fill="#ffe7a3" />
          <rect x="204" y="104" width="88" height="10" rx="4" fill="#2a3a46" />
          <Wheel x={44} />
          <Wheel x={80} />
          <Wheel x={170} />
          <Wheel x={258} />
        </svg>
        <i className="ts-beam" />
      </div>
    </div>
  );
}
