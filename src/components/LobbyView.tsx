import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Copy,
  Check,
  QrCode,
  Users,
  Play,
  Volume2,
  VolumeX,
  Maximize,
  Palette,
  Share2,
  Clock,
  LogOut,
  Crown,
  Minus,
  Plus,
  Info,
  Sparkles,
  Settings,
} from 'lucide-react';
import { playBalatroSound, isSfxMuted, setSfxMuted } from '../lib/soundEffects';
import { QRCodeSVG } from 'qrcode.react';
import { RoomState, GamePlayer } from '../types';
import { cn } from '../lib/utils';

export interface LobbyViewProps {
  room: RoomState;
  currentUserId: string;
  startingChips?: number;
  onSelectStartingChips?: (chips: number) => void;
  onStartGame: () => void;
  onSetBotCount: (count: number) => void;
  onLeaveRoom: () => void;
  onOpenRules: () => void;
}

export function LobbyView({
  room,
  currentUserId,
  startingChips = 1000,
  onSelectStartingChips,
  onStartGame,
  onSetBotCount,
  onLeaveRoom,
  onOpenRules,
}: LobbyViewProps) {
  const isHost = room.hostId === currentUserId;
  const isTeacherOrSpectator = (p: GamePlayer) => {
    return Boolean(
      p.isSpectator ||
      p.role === 'teacher' ||
      p.name.toLowerCase().includes('profesor') ||
      p.name.toLowerCase().includes('docente') ||
      (room.hostIsSpectator && p.id === room.hostId)
    );
  };

  const studentPlayers = useMemo(() => {
    return room.players.filter((p) => !p.isBot && !isTeacherOrSpectator(p));
  }, [room.players, room.hostIsSpectator, room.hostId]);

  const botPlayers = useMemo(() => {
    return room.players.filter((p) => p.isBot);
  }, [room.players]);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isTeacherConfigOpen, setIsTeacherConfigOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(isSfxMuted());
  const [currentTheme, setCurrentTheme] = useState<'neon' | 'dungeon' | 'cyber'>('neon');
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  // Teacher Pre-game Configuration State for Póker del Octeto
  const [localChips, setLocalChips] = useState<number>(startingChips);
  const [betCapLimit, setBetCapLimit] = useState<number>(300); // 0 = Sin límite
  const [blindAmount, setBlindAmount] = useState<number>(25);
  const [chemicalHintsEnabled, setChemicalHintsEnabled] = useState<boolean>(true);
  const [winnerBonusPts, setWinnerBonusPts] = useState<number>(100);
  const [turnTimerSecs, setTurnTimerSecs] = useState<number>(0); // 0 = Sin límite

  const hostDisplay = typeof window !== 'undefined' ? window.location.host : 'pokerocteto.edu';
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?room=${room.code}&game=${room.gameType || 'poker_quimico'}`
    : `https://pokerocteto.edu?room=${room.code}&game=${room.gameType || 'poker_quimico'}`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopiedCode(true);
      playBalatroSound('select');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedUrl(true);
      playBalatroSound('select');
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const toggleSound = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    setSfxMuted(next);
    if (!next) playBalatroSound('click');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Theme color accents matching Escape Room Lobby
  const themeStyles = {
    neon: {
      leftDoor1: '#facc15',
      leftDoor2: '#ec4899',
      rightDoor1: '#f97316',
      rightDoor2: '#06b6d4',
      bgGradient: 'from-[#1a0826] via-[#12051a] to-[#0a020f]',
    },
    dungeon: {
      leftDoor1: '#dc2626',
      leftDoor2: '#9333ea',
      rightDoor1: '#b91c1c',
      rightDoor2: '#7e22ce',
      bgGradient: 'from-[#240a12] via-[#140612] to-[#08020a]',
    },
    cyber: {
      leftDoor1: '#10b981',
      leftDoor2: '#06b6d4',
      rightDoor1: '#3b82f6',
      rightDoor2: '#8b5cf6',
      bgGradient: 'from-[#071824] via-[#041019] to-[#02080d]',
    },
  }[currentTheme];

  return (
    <div className={`relative w-full h-[100dvh] flex flex-col justify-between overflow-hidden select-none bg-gradient-to-b ${themeStyles.bgGradient} text-white font-sans`}>
      
      {/* 1. 3D PERSPECTIVE CORRIDOR BACKGROUND (IDENTICAL TO ESCAPE ROOM LOBBY) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg
          className="w-full h-full object-cover"
          viewBox="0 0 1920 1080"
          preserveAspectRatio="none"
        >
          <defs>
            <radialGradient id="pokerVanishingGlow" cx="50%" cy="46%" r="50%">
              <stop offset="0%" stopColor="#1e0a2e" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#0d0414" stopOpacity="1" />
              <stop offset="100%" stopColor="#050108" stopOpacity="1" />
            </radialGradient>

            <linearGradient id="pokerDoorYellowGlow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={themeStyles.leftDoor1} stopOpacity="0.8" />
              <stop offset="100%" stopColor={themeStyles.leftDoor1} stopOpacity="0.1" />
            </linearGradient>

            <linearGradient id="pokerDoorPinkGlow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={themeStyles.leftDoor2} stopOpacity="0.75" />
              <stop offset="100%" stopColor={themeStyles.leftDoor2} stopOpacity="0.05" />
            </linearGradient>

            <linearGradient id="pokerDoorOrangeGlow" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor={themeStyles.rightDoor1} stopOpacity="0.8" />
              <stop offset="100%" stopColor={themeStyles.rightDoor1} stopOpacity="0.1" />
            </linearGradient>

            <linearGradient id="pokerDoorTealGlow" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor={themeStyles.rightDoor2} stopOpacity="0.75" />
              <stop offset="100%" stopColor={themeStyles.rightDoor2} stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Vanishing back wall */}
          <rect width="1920" height="1080" fill="url(#pokerVanishingGlow)" />

          {/* CEILING PERSPECTIVE */}
          <polygon points="0,0 1920,0 1160,490 760,490" fill="#150622" opacity="0.6" />

          {/* LEFT WALL WITH GLOWING ARCHWAYS */}
          <polygon points="0,0 760,490 760,820 0,1080" fill="#1b082c" />

          {/* Left Door 1 (Foreground) */}
          <polygon
            points="0,180 280,310 280,950 0,1080"
            fill="url(#pokerDoorYellowGlow)"
            stroke={themeStyles.leftDoor1}
            strokeWidth="5"
          />
          <polygon points="20,230 250,335 250,920 20,1040" fill="#2d1702" opacity="0.8" />

          {/* Left Door 2 (Midground) */}
          <polygon
            points="380,355 580,430 580,870 380,920"
            fill="url(#pokerDoorPinkGlow)"
            stroke={themeStyles.leftDoor2}
            strokeWidth="4"
          />
          <polygon points="400,375 560,438 560,855 400,900" fill="#29052b" opacity="0.85" />

          {/* RIGHT WALL WITH GLOWING ARCHWAYS */}
          <polygon points="1920,0 1160,490 1160,820 1920,1080" fill="#1b082c" />

          {/* Right Door 1 (Foreground) */}
          <polygon
            points="1920,180 1640,310 1640,950 1920,1080"
            fill="url(#pokerDoorOrangeGlow)"
            stroke={themeStyles.rightDoor1}
            strokeWidth="5"
          />
          <polygon points="1900,230 1670,335 1670,920 1900,1040" fill="#300d02" opacity="0.8" />

          {/* Right Door 2 (Midground) */}
          <polygon
            points="1540,355 1340,430 1340,870 1540,920"
            fill="url(#pokerDoorTealGlow)"
            stroke={themeStyles.rightDoor2}
            strokeWidth="4"
          />
          <polygon points="1520,375 1360,438 1360,855 1520,900" fill="#032429" opacity="0.85" />

          {/* FLOOR PERSPECTIVE GRID */}
          <polygon points="0,1080 760,820 1160,820 1920,1080" fill="#0d0416" />

          {/* Converging Floor Grid Lines */}
          {[
            [120, 1080, 780, 820],
            [340, 1080, 820, 820],
            [600, 1080, 870, 820],
            [960, 1080, 960, 820],
            [1320, 1080, 1050, 820],
            [1580, 1080, 1100, 820],
            [1800, 1080, 1140, 820],
          ].map(([x1, y1, x2, y2], idx) => (
            <line
              key={idx}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#431e5c"
              strokeWidth="2"
              opacity="0.5"
            />
          ))}

          {/* Horizontal Transverse Floor Lines */}
          {[840, 880, 930, 990, 1060].map((y, idx) => {
            const progress = (y - 820) / (1080 - 820);
            const xLeft = 760 - progress * 760;
            const xRight = 1160 + progress * (1920 - 1160);
            return (
              <line
                key={idx}
                x1={xLeft}
                y1={y}
                x2={xRight}
                y2={y}
                stroke="#582779"
                strokeWidth={1 + progress * 2}
                opacity={0.3 + progress * 0.4}
              />
            );
          })}

          {/* Floor Reflection Glows */}
          <ellipse cx="250" cy="1000" rx="220" ry="40" fill={themeStyles.leftDoor1} opacity="0.14" />
          <ellipse cx="500" cy="890" rx="140" ry="25" fill={themeStyles.leftDoor2} opacity="0.12" />
          <ellipse cx="1670" cy="1000" rx="220" ry="40" fill={themeStyles.rightDoor1} opacity="0.14" />
          <ellipse cx="1420" cy="890" rx="140" ry="25" fill={themeStyles.rightDoor2} opacity="0.12" />
        </svg>

        <div className="absolute inset-0 bg-radial from-transparent via-[#0e0316]/40 to-[#07010c]/80 pointer-events-none" />
      </div>

      {/* 2. TOP NAV BAR (MATCHING ESCAPE ROOM LOBBY) */}
      <header className="relative z-30 w-full px-4 sm:px-8 py-3 flex items-center justify-between border-b border-white/10 bg-[#0d0416]/70 backdrop-blur-md">
        
        {/* Left: Game Title Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#250d38] border border-fuchsia-500/40 rounded-xl shadow-lg">
            <span className="text-lg">🧪</span>
            <div>
              <span className="font-medieval text-sm sm:text-base font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300">
                PÓKER DEL OCTETO
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-retro-mono px-1.5 py-0.2 rounded bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-800">
                SALA DE ESPERA
              </span>
            </div>
          </div>
          {room.name && (
            <span className="hidden md:inline-block text-xs font-mono text-zinc-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
              {room.name}
            </span>
          )}
        </div>

        {/* Right: Controls & Terminar Button */}
        <div className="flex items-center gap-2 font-retro-mono text-xs">
          
          {/* Themes Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsThemeMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1f0f30] hover:bg-[#2e1647] border border-white/10 rounded-xl text-zinc-200 transition-colors cursor-pointer text-xs"
              title="Cambiar tema de ambiente"
            >
              <Palette size={14} className="text-fuchsia-400" />
              <span className="hidden sm:inline">Temas</span>
            </button>

            {isThemeMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-[#1b0d2b] border border-fuchsia-500/40 rounded-xl shadow-2xl p-1.5 z-50 space-y-1">
                {[
                  { id: 'neon', label: 'Neón Wayground' },
                  { id: 'dungeon', label: 'Cripta Oscura' },
                  { id: 'cyber', label: 'Cyber Matrix' },
                ].map((th) => (
                  <button
                    key={th.id}
                    onClick={() => {
                      setCurrentTheme(th.id as any);
                      setIsThemeMenuOpen(false);
                      playBalatroSound('click');
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      currentTheme === th.id
                        ? 'bg-fuchsia-600 text-white'
                        : 'text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    {th.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="p-2 bg-[#1f0f30] hover:bg-[#2e1647] border border-white/10 rounded-xl text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title={soundMuted ? 'Activar sonido' : 'Silenciar sonido'}
          >
            {soundMuted ? <VolumeX size={15} className="text-red-400" /> : <Volume2 size={15} className="text-emerald-400" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-[#1f0f30] hover:bg-[#2e1647] border border-white/10 rounded-xl text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Pantalla completa"
          >
            <Maximize size={15} />
          </button>

          {/* Vibrant Red "TERMINAR" button */}
          <button
            onClick={onLeaveRoom}
            className="px-4 py-1.5 bg-[#e11d48] hover:bg-[#f43f5e] active:scale-95 text-white font-bold rounded-xl cursor-pointer shadow-[0_4px_12px_rgba(225,29,72,0.5)] transition-all flex items-center gap-1.5"
          >
            <LogOut size={13} />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* 3. MAIN CENTER FLOATING PIN CARD */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-2xl bg-[#0b1114]/90 border border-[#26353d] shadow-[0_24px_65px_rgba(0,0,0,0.92)] p-5 sm:p-6 backdrop-blur-md space-y-4"
        >
          {/* Top Card: PIN, Link & QR */}
          <div className="bg-[#121c21]/95 border border-[#223038] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex-1 min-w-0 text-center sm:text-left space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 block">
                Código PIN de la Sala
              </span>
              <div className="flex items-center justify-center sm:justify-start gap-3">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="text-3xl sm:text-5xl font-black font-mono tracking-widest text-white hover:text-amber-400 transition-colors cursor-pointer"
                  title="Clic para copiar código"
                >
                  {room.code}
                </button>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-2 bg-[#1a272e] hover:bg-[#243640] border border-slate-600/50 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Copiar código PIN"
                >
                  {copiedCode ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-2 pt-0.5">
                <span className="text-xs font-mono text-slate-400">{hostDisplay}</span>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="text-[11px] font-mono text-amber-400 hover:text-amber-300 underline cursor-pointer"
                >
                  {copiedUrl ? 'Enlace copiado' : 'Copiar enlace'}
                </button>
              </div>
            </div>

            {/* Direct QR */}
            <div
              onClick={() => setIsQrModalOpen(true)}
              className="w-24 h-24 bg-white p-2 shadow-lg cursor-pointer hover:scale-105 transition-transform flex items-center justify-center shrink-0"
              title="Clic para agrandar QR"
            >
              <QRCodeSVG value={joinUrl} size={84} level="M" includeMargin={false} />
            </div>
          </div>

          {/* Quick Settings & Controls Row */}
          <div className="bg-[#121c21]/95 border border-[#223038] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onOpenRules}
                className="px-3 py-1.5 bg-[#17262e] hover:bg-[#20343f] border border-slate-600/60 text-slate-200 text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors flex items-center gap-1.5"
                title="Ver reglas didácticas"
              >
                <Info size={13} className="text-amber-400" />
                <span>Reglas</span>
              </button>

              {isHost && (
                <button
                  type="button"
                  onClick={() => {
                    playBalatroSound('select');
                    setIsTeacherConfigOpen(true);
                  }}
                  className="px-3 py-1.5 bg-[#17262e] hover:bg-[#20343f] border border-slate-600/60 text-slate-200 text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors flex items-center gap-1.5"
                  title="Configurar fichas y reglas"
                >
                  <Settings size={13} className="text-emerald-400" />
                  <span>Ajustes</span>
                </button>
              )}

              {/* Bots Control */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#17262e] border border-slate-600/60 text-xs font-mono text-slate-300">
                <Sparkles size={12} className="text-amber-400" />
                <span>{botPlayers.length} Bots</span>
                {isHost && (
                  <div className="flex items-center gap-1 ml-1">
                    <button
                      type="button"
                      onClick={() => onSetBotCount(Math.max(0, botPlayers.length - 1))}
                      disabled={botPlayers.length <= 0}
                      className="w-4 h-4 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-white flex items-center justify-center cursor-pointer text-xs"
                    >
                      <Minus size={10} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetBotCount(Math.min(5, botPlayers.length + 1))}
                      disabled={botPlayers.length >= 5}
                      className="w-4 h-4 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-white flex items-center justify-center cursor-pointer text-xs"
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#17262e] border border-slate-600/60 text-slate-200 font-mono text-xs font-bold">
                <Users size={14} className="text-amber-400" />
                <span>{studentPlayers.length}/{room.maxPlayers}</span>
              </div>

              {isHost ? (
                <button
                  type="button"
                  onClick={() => {
                    playBalatroSound('play');
                    onStartGame();
                  }}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-[0.2em] cursor-pointer shadow-md transition-all flex items-center gap-2"
                >
                  <Play size={16} fill="currentColor" />
                  <span>Iniciar Mesa ▶</span>
                </button>
              ) : (
                <div className="px-4 py-2 bg-[#17262e] border border-amber-500/30 text-amber-300 font-bold text-xs font-mono flex items-center gap-2">
                  <Clock size={14} className="text-amber-400 animate-spin" />
                  <span>Esperando al profesor...</span>
                </div>
              )}
            </div>
          </div>

          {/* Connected Students Roster */}
          <div className="pt-2 border-t border-[#1e2c34]">
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {studentPlayers.length === 0 ? (
                <div className="w-full text-center py-2.5 bg-[#10181d] border border-dashed border-slate-700/70 text-xs font-mono text-slate-400">
                  Esperando a que los estudiantes ingresen con el PIN...
                </div>
              ) : (
                studentPlayers.map((p) => {
                  const isMe = p.id === currentUserId;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 bg-[#142026] border text-xs font-mono text-white',
                        isMe ? 'border-amber-400/60' : 'border-slate-700/70'
                      )}
                    >
                      <span>{p.avatar}</span>
                      <span className="font-bold flex items-center gap-1">
                        {p.name}
                        {p.isHost && <Crown size={11} className="text-amber-400" />}
                      </span>
                    </div>
                  );
                })
              )}

              {/* Bots */}
              {botPlayers.map((bot) => (
                <div
                  key={bot.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#142026] border border-cyan-500/30 text-xs font-mono text-cyan-200"
                >
                  <span>{bot.avatar}</span>
                  <span className="font-medium">{bot.name}</span>
                  <span className="text-[10px] text-cyan-400">Bot</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

      </main>

      {/* QR MODAL PREVIEW */}
      <AnimatePresence>
        {isQrModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-[#170c26] border-2 border-fuchsia-500 p-6 rounded-3xl max-w-sm w-full text-center space-y-4 shadow-2xl"
            >
              <h3 className="font-medieval text-xl font-bold text-amber-400">
                Código QR de la Mesa
              </h3>
              <p className="font-retro-mono text-xs text-zinc-300">
                Los estudiantes pueden escanear este código con su móvil para unirse a la partida:
              </p>
              
              <div className="w-56 h-56 bg-white p-3 rounded-2xl mx-auto shadow-2xl flex items-center justify-center">
                <QRCodeSVG
                  value={joinUrl}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <div className="bg-[#24133b] p-3 rounded-xl border border-fuchsia-500/30 text-center font-retro-mono">
                <span className="text-[11px] text-zinc-400 block">PIN de la mesa:</span>
                <span className="text-3xl font-black text-white tracking-widest">{room.code}</span>
              </div>

              <button
                onClick={() => setIsQrModalOpen(false)}
                className="w-full py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Cerrar QR
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TEACHER PRE-GAME CONFIGURATION MODAL (PÓKER DEL OCTETO) */}
      <AnimatePresence>
        {isTeacherConfigOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#140b24] border-2 border-emerald-500/70 p-5 sm:p-6 rounded-3xl max-w-lg w-full space-y-4 shadow-2xl text-xs font-sans text-zinc-200 max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Settings size={18} className="text-emerald-400" />
                  <h3 className="font-medieval text-base font-bold text-amber-300">
                    Configuraciones del Docente · Póker del Octeto
                  </h3>
                </div>
                <button
                  onClick={() => setIsTeacherConfigOpen(false)}
                  aria-label="Cerrar configuración"
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* 1. Fichas Iniciales por Estudiante */}
              <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800 space-y-1.5">
                <label className="text-[11px] font-bold text-amber-300 block">
                  💰 Fichas Iniciales por Estudiante / Químico
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[500, 1000, 2500, 5000].map((chips) => (
                    <button
                      key={chips}
                      type="button"
                      onClick={() => {
                        playBalatroSound('select');
                        setLocalChips(chips);
                        onSelectStartingChips?.(chips);
                      }}
                      className={`py-2 px-2 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${
                        localChips === chips
                          ? 'bg-amber-500 text-zinc-950 border-amber-400'
                          : 'bg-[#1e1133] border-zinc-700 text-zinc-300 hover:text-white'
                      }`}
                    >
                      ${chips.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Cantidad de Bots IA en la Mesa */}
              <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800 space-y-1.5">
                <label className="text-[11px] font-bold text-cyan-300 block">
                  🤖 Cantidad de Bots IA Químicos en la Mesa
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {[0, 1, 2, 3, 4, 5].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => {
                        playBalatroSound('select');
                        onSetBotCount(cnt);
                      }}
                      className={`py-2 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${
                        botPlayers.length === cnt
                          ? 'bg-cyan-500 text-zinc-950 border-cyan-400'
                          : 'bg-[#1e1133] border-zinc-700 text-zinc-300 hover:text-white'
                      }`}
                    >
                      {cnt} {cnt === 1 ? 'Bot' : 'Bots'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Límite de Apuesta por Ronda & Ciega Inicial */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800 space-y-1.5">
                  <label className="text-[11px] font-bold text-fuchsia-300 block">
                    📈 Tope de Subida por Ronda
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { v: 150, label: '$150' },
                      { v: 300, label: '$300 (Est.)' },
                      { v: 500, label: '$500' },
                      { v: 0, label: 'All-In Libre' },
                    ].map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setBetCapLimit(opt.v)}
                        className={`py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                          betCapLimit === opt.v
                            ? 'bg-fuchsia-500 text-white border-fuchsia-400'
                            : 'bg-[#1e1133] border-zinc-700 text-zinc-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800 space-y-1.5">
                  <label className="text-[11px] font-bold text-emerald-300 block">
                    🎯 Apuesta Base Inicial (Ciega)
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { v: 0, label: '$0 (Libre)' },
                      { v: 25, label: '$25 Fichas' },
                      { v: 50, label: '$50 Fichas' },
                      { v: 100, label: '$100 Fichas' },
                    ].map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setBlindAmount(opt.v)}
                        className={`py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                          blindAmount === opt.v
                            ? 'bg-emerald-500 text-zinc-950 border-emerald-400'
                            : 'bg-[#1e1133] border-zinc-700 text-zinc-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4. Asistente Químico & Tiempo por Turno */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800 space-y-1.5">
                  <label className="text-[11px] font-bold text-amber-300 block">
                    🧪 Asistente de Enlaces Químicos
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setChemicalHintsEnabled(true)}
                      className={`py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                        chemicalHintsEnabled
                          ? 'bg-emerald-500 text-zinc-950 border-emerald-400'
                          : 'bg-[#1e1133] border-zinc-700 text-zinc-300'
                      }`}
                    >
                      🧪 Pistas ON
                    </button>
                    <button
                      type="button"
                      onClick={() => setChemicalHintsEnabled(false)}
                      className={`py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                        !chemicalHintsEnabled
                          ? 'bg-rose-600 text-white border-rose-400'
                          : 'bg-[#1e1133] border-zinc-700 text-zinc-300'
                      }`}
                    >
                      📝 Modo Examen
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800 space-y-1.5">
                  <label className="text-[11px] font-bold text-purple-300 block">
                    🏆 Bonificación al Ganador
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {[100, 200, 300].map((pts) => (
                      <button
                        key={pts}
                        type="button"
                        onClick={() => setWinnerBonusPts(pts)}
                        className={`py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                          winnerBonusPts === pts
                            ? 'bg-purple-500 text-white border-purple-400'
                            : 'bg-[#1e1133] border-zinc-700 text-zinc-300'
                        }`}
                      >
                        +{pts} pts
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 5. Reloj de Decisión por Turno */}
              <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800 space-y-1.5">
                <label className="text-[11px] font-bold text-cyan-300 block">
                  ⏱️ Tiempo Límite de Decisión por Turno
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { v: 0, label: 'Sin límite' },
                    { v: 20, label: '20 seg' },
                    { v: 30, label: '30 seg' },
                    { v: 45, label: '45 seg' },
                  ].map((t) => (
                    <button
                      key={t.v}
                      type="button"
                      onClick={() => setTurnTimerSecs(t.v)}
                      className={`py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${
                        turnTimerSecs === t.v
                          ? 'bg-cyan-500 text-zinc-950 border-cyan-400'
                          : 'bg-[#1e1133] border-zinc-700 text-zinc-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  playBalatroSound('play');
                  localStorage.setItem(
                    'po_poker_teacher_config',
                    JSON.stringify({
                      startingChips: localChips,
                      betCapLimit,
                      blindAmount,
                      chemicalHintsEnabled,
                      winnerBonusPts,
                      turnTimerSecs,
                    })
                  );
                  setIsTeacherConfigOpen(false);
                }}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs rounded-xl cursor-pointer shadow-lg transition-colors"
              >
                Guardar y Aplicar Configuraciones del Docente
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
