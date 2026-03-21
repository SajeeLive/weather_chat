import type { WeatherTheme } from '../../types';

interface AtmosphericBackgroundProps {
  theme: WeatherTheme;
}

// ── Cloud shapes ──────────────────────────────────────────────────────────
// Each cloud is a compound of circles/rect centered at (0,0); use transform to position.

interface CloudProps {
  x: number;
  y: number;
  scale?: number;
  fill?: string;
  delay?: number;
  duration?: number;
  animKind?: 'drift' | 'slow';
}

function Cloud({ x, y, scale = 1, fill = 'rgba(255,255,255,0.82)', delay = 0, duration = 10, animKind = 'drift' }: CloudProps) {
  const s = scale;
  const anim = animKind === 'slow' ? 'svg-drift-slow' : 'svg-drift';
  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ animation: `${anim} ${duration}s ease-in-out infinite`, animationDelay: `${delay}s` }}
    >
      {/* Base body */}
      <rect x={-88 * s} y={16 * s} width={176 * s} height={38 * s} rx={19 * s} fill={fill} />
      {/* Bumps */}
      <circle cx={-52 * s} cy={16 * s} r={28 * s} fill={fill} />
      <circle cx={0} cy={4 * s} r={38 * s} fill={fill} />
      <circle cx={52 * s} cy={18 * s} r={26 * s} fill={fill} />
    </g>
  );
}

// ── Rain lines ────────────────────────────────────────────────────────────

interface RainProps {
  x: number;
  delay: number;
  duration: number;
  stroke?: string;
  length?: number;
  angled?: boolean;
}

function Rain({ x, delay, duration, stroke = 'rgba(147,197,253,0.55)', length = 55, angled = false }: RainProps) {
  const anim = angled ? 'svg-rain-angled' : 'svg-rain';
  return (
    <line
      x1={x} y1={-14}
      x2={angled ? x - 8 : x} y2={length}
      stroke={stroke}
      strokeWidth={1.5}
      strokeLinecap="round"
      style={{ animation: `${anim} ${duration}s linear infinite`, animationDelay: `${delay}s` }}
    />
  );
}

// ── Sun with rotating rays ────────────────────────────────────────────────

const SUN_X = 1180;
const SUN_Y = 118;
const RAY_COUNT = 12;

function Sun() {
  return (
    <g>
      {/* Outer pulsing glow halo */}
      <circle
        cx={SUN_X} cy={SUN_Y} r={130}
        fill="rgba(255,210,0,0.10)"
        style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'svg-pulse-glow 5s ease-in-out infinite' }}
      />
      {/* Mid glow */}
      <circle cx={SUN_X} cy={SUN_Y} r={95} fill="rgba(255,200,0,0.16)" />
      {/* Rotating rays */}
      <g style={{ transformOrigin: `${SUN_X}px ${SUN_Y}px`, animation: 'svg-spin 50s linear infinite' }}>
        {Array.from({ length: RAY_COUNT }, (_, i) => {
          const angle = (i / RAY_COUNT) * Math.PI * 2;
          const innerR = 88;
          const outerR = 118 + (i % 3) * 8;
          return (
            <line
              key={i}
              x1={SUN_X + Math.cos(angle) * innerR}
              y1={SUN_Y + Math.sin(angle) * innerR}
              x2={SUN_X + Math.cos(angle) * outerR}
              y2={SUN_Y + Math.sin(angle) * outerR}
              stroke="#FFD000"
              strokeWidth={i % 3 === 0 ? 5 : 3}
              strokeLinecap="round"
              opacity={0.80}
            />
          );
        })}
      </g>
      {/* Corona */}
      <circle cx={SUN_X} cy={SUN_Y} r={72} fill="#FFD600" opacity={0.98}
        style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'svg-pulse-sun 6s ease-in-out infinite' }}
      />
      {/* Inner bright core */}
      <circle cx={SUN_X} cy={SUN_Y} r={50} fill="#FFF5A0" opacity={0.90} />
      {/* Lens flare — diagonal line of circles below-left of sun */}
      <circle cx={SUN_X - 80}  cy={SUN_Y + 90}  r={14} fill="rgba(255,255,255,0.07)" />
      <circle cx={SUN_X - 155} cy={SUN_Y + 170} r={22} fill="rgba(255,220,0,0.05)" />
      <circle cx={SUN_X - 220} cy={SUN_Y + 240} r={9}  fill="rgba(255,255,255,0.08)" />
      <circle cx={SUN_X - 310} cy={SUN_Y + 330} r={34} fill="rgba(255,220,100,0.04)" />
    </g>
  );
}

// ── Lightning bolt ────────────────────────────────────────────────────────

interface BoltProps {
  x: number;
  topY: number;
  delay?: number;
  period?: number;
  opacity?: number;
  hasBranch?: boolean;
}

function Bolt({ x, topY, delay = 0, period = 4, opacity = 1, hasBranch = false }: BoltProps) {
  const pts = `${x},${topY} ${x - 18},${topY + 140} ${x + 16},${topY + 140} ${x - 28},${topY + 330}`;
  const branchPts = `${x + 16},${topY + 140} ${x + 55},${topY + 230}`;
  return (
    <g
      opacity={opacity}
      style={{ animation: `svg-lightning ${period}s ease-in-out infinite`, animationDelay: `${delay}s` }}
    >
      {/* Glow copy (wide, soft) */}
      <polyline points={pts} fill="none" stroke="rgba(160,130,255,0.5)" strokeWidth={14} strokeLinejoin="round" strokeLinecap="round" />
      {/* Core bolt */}
      <polyline points={pts} fill="none" stroke="rgba(235,225,255,0.97)" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={pts} fill="none" stroke="#a87dff" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {hasBranch && (
        <>
          <polyline points={branchPts} fill="none" stroke="rgba(235,225,255,0.75)" strokeWidth={3} strokeLinecap="round" />
          <polyline points={branchPts} fill="none" stroke="#a87dff" strokeWidth={1.5} strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function AtmosphericBackground({ theme }: AtmosphericBackgroundProps) {
  // Rain drops — normal
  const rainDrops = Array.from({ length: 65 }, (_, i) => ({
    x: (i * 22.4 + 30) % 1440,
    delay: -((i * 0.21) % 1.8),
    duration: 0.62 + (i % 6) * 0.07,
  }));

  // Heavy storm rain (angled, more dense)
  const stormRain = Array.from({ length: 100 }, (_, i) => ({
    x: (i * 14.5 + 20) % 1550,
    delay: -((i * 0.13) % 1.4),
    duration: 0.34 + (i % 5) * 0.04,
  }));

  return (
    <div className="atmospheric-bg" aria-hidden="true">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Sky gradients */}
          <linearGradient id="g-neutral" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#3d607e" />
            <stop offset="45%"  stopColor="#6088a8" />
            <stop offset="80%"  stopColor="#90b8d0" />
            <stop offset="100%" stopColor="#c8dce8" />
          </linearGradient>
          <linearGradient id="g-sunny" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#013e80" />
            <stop offset="35%"  stopColor="#0d70c0" />
            <stop offset="70%"  stopColor="#3da0e0" />
            <stop offset="100%" stopColor="#88caf0" />
          </linearGradient>
          <linearGradient id="g-cloudy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#22323c" />
            <stop offset="40%"  stopColor="#3e5870" />
            <stop offset="80%"  stopColor="#6a8898" />
            <stop offset="100%" stopColor="#96b0be" />
          </linearGradient>
          <linearGradient id="g-rainy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#010810" />
            <stop offset="35%"  stopColor="#061428" />
            <stop offset="70%"  stopColor="#0c2040" />
            <stop offset="100%" stopColor="#163258" />
          </linearGradient>
          <linearGradient id="g-stormy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#010106" />
            <stop offset="40%"  stopColor="#040318" />
            <stop offset="75%"  stopColor="#080630" />
            <stop offset="100%" stopColor="#0c0a40" />
          </linearGradient>
          {/* Purple atmospheric glow for stormy */}
          <radialGradient id="g-storm-glow" cx="50%" cy="35%" r="55%">
            <stop offset="0%"   stopColor="rgba(90,40,160,0.25)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          {/* Horizon haze */}
          <linearGradient id="g-horizon-warm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgba(255,180,60,0)" />
            <stop offset="100%" stopColor="rgba(255,180,60,0.14)" />
          </linearGradient>
          <linearGradient id="g-puddle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgba(80,140,220,0.22)" />
            <stop offset="100%" stopColor="rgba(40,80,160,0.08)" />
          </linearGradient>
          {/* Cloud silver lining */}
          <linearGradient id="g-silver" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.30)" />
          </linearGradient>
        </defs>

        {/* ══════════════════════ NEUTRAL ══════════════════════════════════ */}
        {theme === 'neutral' && (
          <>
            <rect width="1440" height="900" fill="url(#g-neutral)" />
            {/* Horizon glow */}
            <ellipse cx={720} cy={900} rx={900} ry={120} fill="rgba(255,255,255,0.08)" />
            {/* Wispy cirrus streaks */}
            <ellipse cx={340} cy={140} rx={120} ry={8}  fill="rgba(255,255,255,0.22)" style={{ animation: 'svg-drift-slow 18s ease-in-out infinite' }} />
            <ellipse cx={900} cy={100} rx={90}  ry={6}  fill="rgba(255,255,255,0.16)" style={{ animation: 'svg-drift-slow 22s ease-in-out infinite', animationDelay: '-6s' }} />
            <ellipse cx={1200} cy={180} rx={70} ry={5}  fill="rgba(255,255,255,0.18)" style={{ animation: 'svg-drift-slow 16s ease-in-out infinite', animationDelay: '-10s' }} />
            {/* Cumulus clouds */}
            <Cloud x={260}  y={200} scale={1.1} fill="rgba(255,255,255,0.60)" delay={0}  duration={13} />
            <Cloud x={1020} y={230} scale={0.85} fill="rgba(255,255,255,0.50)" delay={-5} duration={17} animKind="slow" />
          </>
        )}

        {/* ══════════════════════ SUNNY ════════════════════════════════════ */}
        {theme === 'sunny' && (
          <>
            <rect width="1440" height="900" fill="url(#g-sunny)" />
            {/* Horizon warm haze */}
            <rect x={0} y={680} width={1440} height={220} fill="url(#g-horizon-warm)" />
            {/* Sun + lens flare */}
            <Sun />
            {/* Light rays (subtle, radiating from sun toward horizon) */}
            {[200, 300, 400, 520, 650, 780].map((ry, i) => (
              <line key={i}
                x1={SUN_X} y1={SUN_Y}
                x2={ry} y2={900}
                stroke="rgba(255,230,100,0.04)"
                strokeWidth={60 + i * 15}
                style={{ animation: `svg-ray ${4 + i * 0.7}s ease-in-out infinite`, animationDelay: `${-i * 0.5}s` }}
              />
            ))}
            {/* Clouds */}
            <Cloud x={200}  y={178} scale={1.4} fill="rgba(255,255,255,0.92)" delay={0}   duration={15} />
            <Cloud x={680}  y={130} scale={0.9} fill="rgba(255,255,255,0.82)" delay={-6}  duration={20} animKind="slow" />
            <Cloud x={1050} y={260} scale={0.7} fill="rgba(255,255,255,0.65)" delay={-10} duration={25} animKind="slow" />
          </>
        )}

        {/* ══════════════════════ CLOUDY ═══════════════════════════════════ */}
        {theme === 'cloudy' && (
          <>
            <rect width="1440" height="900" fill="url(#g-cloudy)" />
            {/* Back layer — small, faint */}
            <Cloud x={120}  y={80}  scale={0.75} fill="rgba(200,218,228,0.45)" delay={0}   duration={18} animKind="slow" />
            <Cloud x={820}  y={60}  scale={0.65} fill="rgba(200,218,228,0.38)" delay={-8}  duration={22} animKind="slow" />
            <Cloud x={1360} y={100} scale={0.70} fill="rgba(200,218,228,0.42)" delay={-14} duration={20} animKind="slow" />
            {/* Mid layer */}
            <Cloud x={380}  y={140} scale={1.15} fill="rgba(235,245,250,0.72)" delay={-3}  duration={14} />
            <Cloud x={1060} y={155} scale={1.30} fill="rgba(235,245,250,0.78)" delay={-9}  duration={12} />
            {/* Front layer — large, bright */}
            <Cloud x={660}  y={200} scale={1.55} fill="rgba(255,255,255,0.85)" delay={-5}  duration={11} />
            <Cloud x={0}    y={260} scale={1.20} fill="rgba(255,255,255,0.78)" delay={-2}  duration={13} />
            <Cloud x={1300} y={240} scale={1.10} fill="rgba(255,255,255,0.72)" delay={-7}  duration={15} />
            {/* Silver lining strip at bottom of front clouds */}
            <rect x={0} y={305} width={1440} height={30} fill="url(#g-silver)" opacity={0.5} />
          </>
        )}

        {/* ══════════════════════ RAINY ════════════════════════════════════ */}
        {theme === 'rainy' && (
          <>
            <rect width="1440" height="900" fill="url(#g-rainy)" />
            {/* Massive storm clouds covering top 40% */}
            <Cloud x={0}    y={10}  scale={2.2} fill="rgba(8,20,55,0.97)"  delay={0}  duration={10} />
            <Cloud x={580}  y={-10} scale={2.5} fill="rgba(5,14,45,1)"     delay={-4} duration={13} />
            <Cloud x={1200} y={20}  scale={2.0} fill="rgba(8,20,55,0.95)"  delay={-7} duration={11} />
            {/* Second cloud row */}
            <Cloud x={320}  y={100} scale={1.8} fill="rgba(10,25,65,0.92)" delay={-2} duration={9}  />
            <Cloud x={980}  y={90}  scale={1.6} fill="rgba(10,25,65,0.90)" delay={-6} duration={12} />
            {/* Rain */}
            {rainDrops.map((d, i) => (
              <Rain key={i} x={d.x} delay={d.delay} duration={d.duration} stroke="rgba(130,185,255,0.50)" />
            ))}
            {/* Ground puddle / wet horizon */}
            <ellipse cx={720} cy={900} rx={750} ry={40} fill="url(#g-puddle)"
              style={{ animation: 'svg-puddle-shimmer 4s ease-in-out infinite' }}
            />
          </>
        )}

        {/* ══════════════════════ STORMY ═══════════════════════════════════ */}
        {theme === 'stormy' && (
          <>
            <rect width="1440" height="900" fill="url(#g-stormy)" />
            {/* Purple atmospheric glow */}
            <rect width="1440" height="900" fill="url(#g-storm-glow)" />
            {/* Massive near-black clouds */}
            <Cloud x={0}    y={0}   scale={2.8} fill="rgba(4,3,18,1)"    delay={0}  duration={8}  />
            <Cloud x={660}  y={-20} scale={3.0} fill="rgba(2,2,12,1)"    delay={-3} duration={10} />
            <Cloud x={1400} y={10}  scale={2.6} fill="rgba(4,3,18,1)"    delay={-5} duration={9}  />
            <Cloud x={350}  y={80}  scale={2.2} fill="rgba(6,4,22,0.98)" delay={-1} duration={7}  />
            <Cloud x={1080} y={70}  scale={2.0} fill="rgba(6,4,22,0.97)" delay={-6} duration={11} />
            {/* Heavy angled rain */}
            {stormRain.map((d, i) => (
              <Rain key={i} x={d.x} delay={d.delay} duration={d.duration}
                stroke="rgba(100,140,255,0.32)" angled length={60} />
            ))}
            {/* Lightning bolts */}
            <Bolt x={680}  topY={100} delay={0}   period={4.5} hasBranch />
            <Bolt x={1080} topY={80}  delay={2.2} period={6.0} opacity={0.75} />
            <Bolt x={340}  topY={140} delay={3.8} period={8.0} opacity={0.55} />
          </>
        )}
      </svg>
    </div>
  );
}
