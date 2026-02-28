import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Home, Compass } from 'lucide-react';

// ── Starfield ──────────────────────────────────────────────
interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

function generateStars(count: number): Star[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2.5 + 0.5,
    duration: Math.random() * 4 + 2,
    delay: Math.random() * 5,
  }));
}

// ── Meteor ─────────────────────────────────────────────────
interface Meteor {
  id: number;
  top: number;
  left: number;
  duration: number;
  delay: number;
  length: number;
}

function generateMeteors(count: number): Meteor[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    top: Math.random() * 60,
    left: Math.random() * 100,
    duration: Math.random() * 2 + 2,
    delay: Math.random() * 8,
    length: Math.random() * 80 + 60,
  }));
}

// ── Orb ────────────────────────────────────────────────────
interface Orb {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
}

const ORB_COLORS = [
  'rgba(99,102,241,0.25)',
  'rgba(168,85,247,0.2)',
  'rgba(236,72,153,0.2)',
  'rgba(59,130,246,0.2)',
];

function generateOrbs(count: number): Orb[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 90,
    y: Math.random() * 90,
    size: Math.random() * 200 + 120,
    color: ORB_COLORS[i % ORB_COLORS.length],
    duration: Math.random() * 6 + 6,
    delay: Math.random() * 4,
  }));
}

// ── Typewriter ─────────────────────────────────────────────
const FULL_TEXT = 'Trang bạn đang tìm đã lạc vào vũ trụ truyện không đáy…';

function useTypewriter(text: string, speed = 45) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayed, done };
}

// ── Main Component ─────────────────────────────────────────
export default function NotFoundPage() {
  const starsRef = useRef(generateStars(140));
  const meteorsRef = useRef(generateMeteors(8));
  const orbsRef = useRef(generateOrbs(4));
  const { displayed, done } = useTypewriter(FULL_TEXT, 40);

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-center select-none"
      style={{ background: 'radial-gradient(ellipse at 60% 40%, #0f0c29 0%, #0a0a1a 55%, #000000 100%)' }}
    >
      {/* ── Stars ── */}
      <div className="absolute inset-0 pointer-events-none">
        {starsRef.current.map((s) => (
          <span
            key={s.id}
            className="absolute rounded-full bg-white animate-twinkle"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              '--duration': `${s.duration}s`,
              animationDelay: `${s.delay}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* ── Meteors ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {meteorsRef.current.map((m) => (
          <span
            key={m.id}
            className="absolute animate-meteor"
            style={{
              top: `${m.top}%`,
              left: `${m.left}%`,
              '--duration': `${m.duration}s`,
              animationDelay: `${m.delay}s`,
              width: m.length,
              height: 1.5,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.85), transparent)',
              borderRadius: 999,
              transform: 'rotate(215deg)',
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* ── Floating Orbs ── */}
      <div className="absolute inset-0 pointer-events-none">
        {orbsRef.current.map((o) => (
          <div
            key={o.id}
            className="absolute rounded-full animate-orb-float"
            style={{
              left: `${o.x}%`,
              top: `${o.y}%`,
              width: o.size,
              height: o.size,
              background: `radial-gradient(circle, ${o.color}, transparent 70%)`,
              '--duration': `${o.duration}s`,
              animationDelay: `${o.delay}s`,
              filter: 'blur(2px)',
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">

        {/* Compass icon */}
        <div
          className="animate-fade-in-up"
          style={{ animationDelay: '0.1s', opacity: 0 }}
        >
          <Compass
            size={44}
            className="text-indigo-400 drop-shadow-[0_0_12px_rgba(99,102,241,0.8)]"
            strokeWidth={1.5}
          />
        </div>

        {/* 404 */}
        <div className="relative">
          {/* Breathing halo */}
          <div
            className="absolute inset-0 rounded-full animate-breathe pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(168,85,247,0.4) 0%, transparent 70%)',
              transform: 'scale(1.6)',
              filter: 'blur(30px)',
            }}
          />
          <h1
            className="relative font-black text-transparent bg-clip-text animate-glitch"
            style={{
              fontSize: 'clamp(7rem, 20vw, 14rem)',
              lineHeight: 1,
              backgroundImage: 'linear-gradient(135deg, #818cf8 0%, #c084fc 40%, #f472b6 70%, #818cf8 100%)',
              letterSpacing: '-0.04em',
            }}
          >
            404
          </h1>
        </div>

        {/* Title */}
        <h2
          className="text-2xl sm:text-3xl font-bold text-white animate-fade-in-up"
          style={{ animationDelay: '0.3s', opacity: 0 }}
        >
          Trang không tồn tại
        </h2>

        {/* Typewriter subtitle */}
        <p
          className="text-indigo-300/80 text-base sm:text-lg max-w-md font-light min-h-[3em]"
          style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
        >
          {displayed}
          {!done && (
            <span className="inline-block w-0.5 h-4 bg-indigo-300 ml-0.5 animate-pulse align-middle" />
          )}
        </p>

        {/* Divider line */}
        <div
          className="w-24 h-px animate-fade-in-up"
          style={{
            animationDelay: '0.6s',
            opacity: 0,
            background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.6), transparent)',
          }}
        />

        {/* Home button */}
        <Link
          to="/"
          className="group animate-fade-in-up flex items-center gap-2 px-7 py-3 rounded-full font-semibold text-white transition-all duration-300"
          style={{
            animationDelay: '0.7s',
            opacity: 0,
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            boxShadow: '0 0 20px rgba(99,102,241,0.35)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.boxShadow =
              '0 0 40px rgba(168,85,247,0.65), 0 0 80px rgba(99,102,241,0.3)';
            (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.06)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.boxShadow =
              '0 0 20px rgba(99,102,241,0.35)';
            (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)';
          }}
        >
          <Home size={18} strokeWidth={2} />
          Về trang chủ
        </Link>

        {/* Error code label */}
        <p
          className="text-xs text-white/20 tracking-widest uppercase animate-fade-in-up"
          style={{ animationDelay: '0.9s', opacity: 0 }}
        >
          Error 404 · Page Not Found
        </p>
      </div>
    </div>
  );
}
