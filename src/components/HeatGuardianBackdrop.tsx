import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Volume2, VolumeX, Maximize } from 'lucide-react';
import { playBalatroSound } from '../lib/soundEffects';
import { cn } from '../lib/utils';
import { AulaPlayLogo } from './AulaPlayLogo';

export interface HeatGuardianMenuItem {
  id: string;
  label: string;
  sublabel?: string;
  onClick: () => void;
  isPrimary?: boolean;
  active?: boolean;
  disabled?: boolean;
  badge?: string;
  isDanger?: boolean;
}

interface HeatGuardianAtmosphereProps {
  /** Subtle tint for the horizon & guardian backpack core */
  variant?: 'frost_amber' | 'crimson_mist' | 'arctic_cyan' | 'golden_ember';
  /** Whether to show the lone guardian & pine forest silhouette */
  showGuardianScene?: boolean;
  /** Opacity of the background scene when used behind active gameplay boards */
  sceneOpacity?: number;
}

/**
 * Recreates the exact atmospheric snowy/misty pine forest, warm horizon glow,
 * lone survivor with the glowing amber backpack core, grunge vignette, and
 * falling snow particles from the HEAT GUARDIAN reference aesthetic.
 */
export const HeatGuardianAtmosphere: React.FC<HeatGuardianAtmosphereProps> = ({
  variant = 'frost_amber',
  showGuardianScene = true,
  sceneOpacity = 1,
}) => {
  const palette = {
    frost_amber: {
      skyTop: '#3f4b50',
      skyMid: '#687378',
      horizonGlow: '#c98a78',
      fogColor: '#cbd5e1',
      coreGlow: '#f59e0b',
      coreCenter: '#fef08a',
    },
    crimson_mist: {
      skyTop: '#2d373c',
      skyMid: '#575e63',
      horizonGlow: '#b86b5e',
      fogColor: '#cbd5e1',
      coreGlow: '#ef4444',
      coreCenter: '#fde047',
    },
    arctic_cyan: {
      skyTop: '#2c3c44',
      skyMid: '#566973',
      horizonGlow: '#b58373',
      fogColor: '#dbeafe',
      coreGlow: '#f59e0b',
      coreCenter: '#fef08a',
    },
    golden_ember: {
      skyTop: '#364147',
      skyMid: '#626d73',
      horizonGlow: '#cf8e76',
      fogColor: '#e2e8f0',
      coreGlow: '#f59e0b',
      coreCenter: '#fef9c3',
    },
  }[variant];

  // Deterministic snow particles so SSR/hydration & re-renders never flicker
  const snowParticles = useMemo(() => {
    return Array.from({ length: 42 }, (_, i) => {
      const seed = (i * 73 + 19) % 100;
      const left = (i * 29 + 7) % 100;
      const size = i % 9 === 0 ? 10 : i % 4 === 0 ? 5 : 2.5;
      const duration = 7 + (seed % 9);
      const delay = -(seed % 12);
      const opacity = i % 9 === 0 ? 0.85 : 0.45 + (seed % 40) / 100;
      return { id: i, left, size, duration, delay, opacity };
    });
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0"
      style={{ opacity: sceneOpacity }}
    >
      {/* 1. Base Desaturated Cold Overcast Sky + Warm Dusk Horizon Gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${palette.skyTop} 0%, ${palette.skyMid} 46%, ${palette.horizonGlow} 74%, #1e262b 100%)`,
        }}
      />

      {/* 2. Reference Artwork Texture Blend (when showing full guardian scene) */}
      {showGuardianScene && (
        <img
          src="/assets/aistudio/image_02881dad.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-right opacity-45 mix-blend-luminosity scale-105 filter contrast-115"
        />
      )}

      {/* 3. Layered SVG Pine Forest, Misty Snow Hills & Lone Guardian with Glowing Core */}
      {showGuardianScene && (
        <svg
          className="absolute inset-0 w-full h-full object-cover"
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMax slice"
        >
          <defs>
            <linearGradient id="hgMistGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.horizonGlow} stopOpacity="0.35" />
              <stop offset="55%" stopColor={palette.fogColor} stopOpacity="0.75" />
              <stop offset="100%" stopColor="#0f171c" stopOpacity="0.95" />
            </linearGradient>

            <radialGradient id="hgCoreBeacon" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={palette.coreCenter} stopOpacity="1" />
              <stop offset="38%" stopColor={palette.coreGlow} stopOpacity="0.9" />
              <stop offset="100%" stopColor={palette.coreGlow} stopOpacity="0" />
            </radialGradient>

            <linearGradient id="hgSnowDrift" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f1f5f9" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#94a3b8" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="1" />
            </linearGradient>
          </defs>

          {/* Warm sunset haze above tree line */}
          <rect x="0" y="420" width="1920" height="420" fill="url(#hgMistGrad)" />

          {/* Far background frosted pine silhouettes */}
          <g fill="#64748b" opacity="0.45">
            {[
              480, 540, 610, 690, 760, 830, 910, 1080, 1150, 1230, 1310, 1390, 1460, 1540, 1620,
              1700, 1790, 1860,
            ].map((x, idx) => {
              const h = 150 + ((idx * 37) % 110);
              const baseY = 820;
              return (
                <g key={x}>
                  <polygon points={`${x},${baseY - h} ${x - 36},${baseY} ${x + 36},${baseY}`} />
                  <polygon
                    points={`${x},${baseY - h * 0.75} ${x - 46},${baseY} ${x + 46},${baseY}`}
                  />
                </g>
              );
            })}
          </g>

          {/* Midground dark pine trees in fog */}
          <g fill="#2c3a40" opacity="0.78">
            {[520, 640, 730, 860, 1140, 1250, 1340, 1450, 1570, 1680, 1810].map((x, idx) => {
              const h = 190 + ((idx * 53) % 120);
              const baseY = 860;
              return (
                <g key={x}>
                  <polygon points={`${x},${baseY - h} ${x - 42},${baseY - h * 0.55} ${x + 42},${baseY - h * 0.55}`} />
                  <polygon points={`${x},${baseY - h * 0.72} ${x - 55},${baseY - h * 0.25} ${x + 55},${baseY - h * 0.25}`} />
                  <polygon points={`${x},${baseY - h * 0.45} ${x - 68},${baseY} ${x + 68},${baseY}`} />
                </g>
              );
            })}
          </g>

          {/* Ground mist bank */}
          <ellipse cx="1050" cy="850" rx="780" ry="95" fill="#e2e8f0" opacity="0.65" />

          {/* Lone Guardian Survivor Figure in the Snow (Centered-Left of Right Canvas) */}
          <g transform="translate(980, 625)">
            {/* Rifle barrel silhouette */}
            <rect x="3" y="-32" width="6" height="90" rx="2" fill="#1e293b" transform="rotate(-4)" />
            {/* Legs */}
            <path d="M-8,155 L-14,245 L4,245 L8,165 L14,245 L32,245 L28,155 Z" fill="#131c21" />
            {/* Heavy Winter Coat & Hood */}
            <path
              d="M-24,52 C-24,25 42,25 42,52 L52,158 L-30,158 Z"
              fill="#192328"
              stroke="#0f171c"
              strokeWidth="3"
            />
            {/* Hood Head */}
            <ellipse cx="10" cy="24" rx="22" ry="25" fill="#141d22" />
            {/* Survivor Backpack */}
            <rect
              x="-18"
              y="48"
              width="52"
              height="78"
              rx="8"
              fill="#263339"
              stroke="#0f171c"
              strokeWidth="3"
            />
            {/* Iconic Glowing Heat Core inside Backpack */}
            <circle cx="8" cy="88" r="38" fill="url(#hgCoreBeacon)" />
            <rect
              x="-4"
              y="70"
              width="24"
              height="34"
              rx="4"
              fill={palette.coreCenter}
              stroke={palette.coreGlow}
              strokeWidth="3"
            />
          </g>

          {/* Foreground Snowy Ridge */}
          <path
            d="M0,1080 L0,940 Q420,910 760,955 Q1120,860 1540,915 Q1760,940 1920,900 L1920,1080 Z"
            fill="url(#hgSnowDrift)"
          />
        </svg>
      )}

      {/* 4. Falling Snowflakes & Ash Particles */}
      <div className="absolute inset-0 overflow-hidden">
        {snowParticles.map((flake) => (
          <motion.div
            key={flake.id}
            initial={{ y: '-5vh', x: 0 }}
            animate={{
              y: '108vh',
              x: [0, flake.id % 2 === 0 ? 25 : -25, 0],
            }}
            transition={{
              duration: flake.duration,
              repeat: Infinity,
              delay: flake.delay,
              ease: 'linear',
            }}
            style={{
              left: `${flake.left}%`,
              width: `${flake.size}px`,
              height: `${flake.size}px`,
              opacity: flake.opacity,
            }}
            className={cn(
              'absolute rounded-full bg-white',
              flake.size >= 8 ? 'blur-[1.5px] shadow-[0_0_12px_rgba(255,255,255,0.9)]' : ''
            )}
          />
        ))}
      </div>

      {/* 5. Heavy Cold Dark Grunge Vignette Around Screen Edges */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 58% 50%, transparent 32%, rgba(10, 16, 20, 0.55) 75%, rgba(5, 9, 12, 0.92) 100%)',
        }}
      />

      {/* Subtle distressed film grain / frost lines */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 1px, transparent 1px, transparent 14px)',
        }}
      />
    </div>
  );
};

interface HeatGuardianLobbyShellProps {
  titleLine1: string;
  titleLine2: string;
  subtitleBadge?: string;
  roomCode: string;
  menuItems: HeatGuardianMenuItem[];
  soundMuted: boolean;
  onToggleSound: () => void;
  onToggleFullscreen: () => void;
  variant?: 'frost_amber' | 'crimson_mist' | 'arctic_cyan' | 'golden_ember';
  footerCredit?: string;
  children: React.ReactNode;
}

/**
 * Full-screen Heat Guardian layout featuring the iconic Left Dark Vertical Monolith
 * with overflowing distressed stencil typography and triangular pointer menu, paired
 * with the right-hand classroom mission control panels.
 */
export const HeatGuardianLobbyShell: React.FC<HeatGuardianLobbyShellProps> = ({
  titleLine1,
  titleLine2,
  subtitleBadge,
  roomCode,
  menuItems,
  soundMuted,
  onToggleSound,
  onToggleFullscreen,
  variant = 'frost_amber',
  footerCredit = 'AULAPLAY EXPEDITION',
  children,
}) => {
  return (
    <div className="relative w-full min-h-screen overflow-y-auto select-none bg-[#12191d] text-slate-100 font-sans flex flex-col lg:flex-row">
      {/* Full-bleed Heat Guardian Snow & Pine Forest Atmosphere */}
      <HeatGuardianAtmosphere variant={variant} showGuardianScene={true} />

      {/* Top-right minimal utility buttons (Audio & Fullscreen) */}
      <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSound}
          className="p-2.5 bg-[#0b1114]/90 hover:bg-[#162229] border border-slate-600/60 text-slate-200 hover:text-white transition-colors cursor-pointer shadow-lg"
          title={soundMuted ? 'Activar sonido' : 'Silenciar sonido'}
        >
          {soundMuted ? (
            <VolumeX size={16} className="text-red-400" />
          ) : (
            <Volume2 size={16} className="text-amber-400" />
          )}
        </button>
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="p-2.5 bg-[#0b1114]/90 hover:bg-[#162229] border border-slate-600/60 text-slate-200 hover:text-white transition-colors cursor-pointer shadow-lg"
          title="Pantalla completa"
        >
          <Maximize size={16} />
        </button>
      </div>

      {/* =====================================================================
          1. LEFT VERTICAL MONOLITH BANNER (EXACT HEAT GUARDIAN STYLE)
      ===================================================================== */}
      <aside className="relative z-30 w-full lg:w-[310px] xl:w-[340px] lg:ml-12 xl:ml-20 lg:h-full bg-[#0b1114]/95 border-b-2 lg:border-b-0 lg:border-x-2 border-[#26353d] shadow-[0_0_70px_rgba(0,0,0,0.95)] flex flex-col justify-between px-6 py-5 lg:py-12 shrink-0">
        {/* Distressed vertical frost/grunge edge texture */}
        <div
          className="absolute inset-y-0 left-0 w-2 opacity-35 pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(180deg, #94a3b8 0px, transparent 3px, #0b1114 7px)',
          }}
        />
        <div
          className="absolute inset-y-0 right-0 w-2 opacity-35 pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(180deg, #94a3b8 0px, transparent 4px, #0b1114 9px)',
          }}
        />

        {/* TOP: Monumental Stacked Title Overlapping Monolith Edges */}
        <div className="relative z-10 text-center lg:-mx-9">
          <div
            className="font-sans font-black uppercase text-4xl sm:text-5xl lg:text-[3.4rem] leading-[0.88] tracking-[0.06em] text-[#f1f5f9] drop-shadow-[0_6px_18px_rgba(0,0,0,0.95)]"
            style={{
              textShadow: '0 2px 0 #475569, 0 8px 24px rgba(0,0,0,0.95)',
            }}
          >
            {titleLine1}
          </div>
          <div
            className="font-sans font-black uppercase text-xl sm:text-2xl lg:text-[1.75rem] leading-tight tracking-[0.22em] text-[#cbd5e1] mt-1 drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)]"
          >
            {titleLine2}
          </div>
          {subtitleBadge && (
            <div className="mt-2.5 inline-block text-[10px] font-mono uppercase tracking-[0.25em] text-amber-400/90 border-y border-amber-500/30 py-0.5 px-3">
              {subtitleBadge}
            </div>
          )}
        </div>

        {/* CENTER: Minimalist Centered Vertical Menu with White Triangle Pointer ▶ */}
        <nav className="relative z-10 my-4 lg:my-auto flex flex-row lg:flex-col flex-wrap items-center justify-center gap-3 lg:gap-5">
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                playBalatroSound(item.isPrimary ? 'play' : 'select');
                item.onClick();
              }}
              className={cn(
                'group relative px-4 py-1.5 lg:py-2 flex items-center justify-center gap-3 uppercase tracking-[0.22em] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
                item.isPrimary
                  ? 'text-white font-black text-sm sm:text-base lg:text-lg scale-105'
                  : item.active
                  ? 'text-amber-300 font-black text-xs sm:text-sm lg:text-[15px]'
                  : item.isDanger
                  ? 'text-slate-300 hover:text-rose-400 font-bold text-xs sm:text-sm lg:text-[15px]'
                  : 'text-slate-300 hover:text-white font-bold text-xs sm:text-sm lg:text-[15px]'
              )}
            >
              <span className="relative">
                {item.label}
                {item.badge && (
                  <span className="ml-2 text-[10px] font-mono tracking-normal text-amber-400 font-bold">
                    [{item.badge}]
                  </span>
                )}
                {/* Subtle underline on hover */}
                <span
                  className={cn(
                    'block h-[2px] bg-amber-400 transition-all duration-200 mx-auto mt-0.5',
                    item.isPrimary || item.active ? 'w-full' : 'w-0 group-hover:w-full'
                  )}
                />
              </span>

              {/* Iconic HEAT GUARDIAN Right Triangular Pointer Arrow ▶ */}
              <span
                className={cn(
                  'inline-block text-white transition-all duration-200 text-xs lg:text-sm',
                  item.isPrimary || item.active
                    ? 'opacity-100 translate-x-0 text-amber-300 animate-pulse'
                    : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
                )}
              >
                ▶
              </span>
            </button>
          ))}
        </nav>

        {/* BOTTOM: Subtle Monolith Credit & Room PIN */}
        <div className="relative z-10 hidden lg:flex flex-col items-center gap-1 text-center pt-4 border-t border-slate-800/80">
          <AulaPlayLogo size="xs" theme="light" />
          <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-slate-400">
            SALA <strong className="text-slate-200">{roomCode}</strong>
          </div>
        </div>
      </aside>

      {/* =====================================================================
          2. RIGHT CLASSROOM MISSION PANEL OVER SNOWY LANDSCAPE
      ===================================================================== */}
      <main className="relative z-20 flex-1 min-h-full overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-start lg:justify-center items-center">
        <div className="w-full max-w-3xl my-auto">{children}</div>
      </main>
    </div>
  );
};
