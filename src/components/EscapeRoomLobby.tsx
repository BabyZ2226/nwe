import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Copy,
  Check,
  QrCode,
  Users,
  Play,
  Settings,
  Sparkles,
  Share2,
  Clock,
} from 'lucide-react';
import { playBalatroSound, isSfxMuted, setSfxMuted } from '../lib/soundEffects';
import { QRCodeSVG } from 'qrcode.react';
import { HeatGuardianLobbyShell, HeatGuardianMenuItem } from './HeatGuardianBackdrop';

export interface EscapeRoomLobbyProps {
  roomCode: string;
  roomName?: string;
  totalInitialSeconds: number;
  questionsCount: number;
  activePackTitle?: string;
  wrongPenaltySecs?: number;
  enableJumpscare?: boolean;
  onStartMatch: () => void;
  onOpenSettings: (tab: 'time' | 'rules' | 'ai' | 'questions') => void;
  onOpenEscapeLibrary?: () => void;
  onExit: () => void;
  players?: Array<{ id: string; name: string; avatar: string; ready: boolean }>;
  isHost?: boolean;
  isTeacherSpectator?: boolean;
  onOpenTeacherSummary?: () => void;
}

export const EscapeRoomLobby: React.FC<EscapeRoomLobbyProps> = ({
  roomCode,
  roomName,
  totalInitialSeconds,
  questionsCount,
  activePackTitle,
  wrongPenaltySecs = 20,
  enableJumpscare = true,
  onStartMatch,
  onOpenSettings,
  onOpenEscapeLibrary,
  onExit,
  players = [],
  isHost = true,
  isTeacherSpectator = false,
  onOpenTeacherSummary,
}) => {
  const uniquePlayers = useMemo(() => {
    const seen = new Set<string>();
    return players.filter((p) => {
      const anyP = p as any;
      if (
        anyP.isSpectator ||
        anyP.role === 'teacher' ||
        p.name.toLowerCase().includes('profesor') ||
        p.name.toLowerCase().includes('docente') ||
        (isTeacherSpectator && anyP.isHost)
      ) {
        return false;
      }
      const key = `${p.name.trim().toLowerCase()}_${p.avatar}`;
      if (seen.has(key) || seen.has(p.id)) return false;
      seen.add(key);
      seen.add(p.id);
      return true;
    });
  }, [players, isTeacherSpectator]);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(isSfxMuted());

  const hostDisplay = typeof window !== 'undefined' ? window.location.host : 'escaperoom.edu';
  const joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${roomCode}&game=escape_room`
      : `https://escaperoom.edu?room=${roomCode}&game=escape_room`;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
    } catch {}
    setCopiedCode(true);
    playBalatroSound('select');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
    } catch {}
    setCopiedUrl(true);
    playBalatroSound('select');
    setTimeout(() => setCopiedUrl(false), 2000);
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

  const menuItems: HeatGuardianMenuItem[] = [
    ...(isHost || isTeacherSpectator
      ? [
          {
            id: 'play',
            label: 'JUGAR',
            isPrimary: true,
            onClick: onStartMatch,
          },
          {
            id: 'rules',
            label: 'AJUSTES',
            badge: `${formatTime(totalInitialSeconds)}`,
            onClick: () => onOpenSettings('rules'),
          },
          {
            id: 'time',
            label: 'TIEMPO',
            onClick: () => onOpenSettings('time'),
          },
        ]
      : []),
    ...(onOpenEscapeLibrary
      ? [
          {
            id: 'library',
            label: 'BIBLIOTECA',
            badge: `${questionsCount} CÁM`,
            onClick: onOpenEscapeLibrary,
          },
        ]
      : []),
    {
      id: 'qr',
      label: 'CÓDIGO QR',
      onClick: () => setIsQrModalOpen(true),
    },
    {
      id: 'exit',
      label: 'SALIR',
      isDanger: true,
      onClick: onExit,
    },
  ];

  return (
    <HeatGuardianLobbyShell
      titleLine1="ESCAPE"
      titleLine2="GUARDIAN"
      subtitleBadge="SUPERVIVENCIA ACADÉMICA"
      roomCode={roomCode}
      menuItems={menuItems}
      soundMuted={soundMuted}
      onToggleSound={toggleSound}
      onToggleFullscreen={toggleFullscreen}
      variant="crimson_mist"
      footerCredit={roomName || 'ESCAPE ROOM EDUCATIVO'}
    >
      {/* MAIN MISSION CONTROL PANEL */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full bg-[#0b1114]/90 border border-[#26353d] shadow-[0_24px_65px_rgba(0,0,0,0.92)] p-5 sm:p-6 backdrop-blur-md space-y-4"
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
                {roomCode}
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

          {/* Quick QR display */}
          <div
            onClick={() => setIsQrModalOpen(true)}
            className="w-24 h-24 bg-white p-2 shadow-lg cursor-pointer hover:scale-105 transition-transform flex items-center justify-center shrink-0"
            title="Clic para agrandar QR"
          >
            <QRCodeSVG value={joinUrl} size={84} level="M" includeMargin={false} />
          </div>
        </div>

        {/* Active Pack & Details Summary */}
        <div className="bg-[#121c21]/95 border border-[#223038] px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
              {questionsCount} CÁMARAS · ⏱️ {formatTime(totalInitialSeconds)} · {wrongPenaltySecs > 0 ? `-${wrongPenaltySecs}s error` : 'Sin penalización'}
            </div>
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wide text-white truncate mt-0.5">
              {activePackTitle || 'Escape Multidisciplinar: Las 10 Cámaras del Saber'}
            </h4>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            {onOpenEscapeLibrary && (
              <button
                type="button"
                onClick={() => {
                  playBalatroSound('select');
                  onOpenEscapeLibrary();
                }}
                className="px-3 py-1.5 bg-[#17262e] hover:bg-[#20343f] border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <Sparkles size={13} />
                <span>Biblioteca</span>
              </button>
            )}

            {(isHost || isTeacherSpectator) && (
              <button
                type="button"
                onClick={() => {
                  onOpenSettings('time');
                  playBalatroSound('click');
                }}
                className="px-3 py-1.5 bg-[#17262e] hover:bg-[#20343f] border border-slate-600/60 text-slate-200 text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors flex items-center gap-1.5"
                title="Configurar tiempo y reglas del docente"
              >
                <Settings size={13} className="text-amber-400" />
                <span>Ajustes</span>
              </button>
            )}

            {(isHost || isTeacherSpectator) && onOpenTeacherSummary && (
              <button
                type="button"
                onClick={onOpenTeacherSummary}
                className="px-3 py-1.5 bg-[#17262e] hover:bg-[#20343f] border border-slate-600/60 text-slate-200 text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors flex items-center gap-1.5"
                title="Ver resumen de calificaciones"
              >
                <span>Notas</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Row & Student Count */}
        <div className="pt-2 border-t border-[#1e2c34] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#121c21] border border-[#223038] text-slate-200 font-mono text-xs font-bold">
            <Users size={14} className="text-amber-400" />
            <span>{uniquePlayers.length} Conectados</span>
          </div>

          {isHost || isTeacherSpectator ? (
            <button
              type="button"
              onClick={() => {
                playBalatroSound('play');
                onStartMatch();
              }}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-[0.2em] cursor-pointer shadow-md transition-all flex items-center gap-2"
            >
              <Play size={16} fill="currentColor" />
              <span>Iniciar Partida ▶</span>
            </button>
          ) : (
            <div className="px-4 py-2 bg-[#121c21] border border-amber-500/30 text-amber-300 font-bold text-xs font-mono flex items-center gap-2">
              <Clock size={14} className="text-amber-400 animate-spin" />
              <span>Esperando al docente para iniciar...</span>
            </div>
          )}
        </div>

        {/* Connected Students Roster */}
        <div className="pt-2 border-t border-[#1e2c34]">
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {uniquePlayers.length === 0 ? (
              <div className="w-full text-center py-2.5 bg-[#10181d] border border-dashed border-slate-700/70 text-xs font-mono text-slate-400">
                Esperando a que los estudiantes ingresen con el PIN...
              </div>
            ) : (
              uniquePlayers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#142026] border border-slate-700/70 text-xs font-mono text-white"
                >
                  <span>{p.avatar}</span>
                  <span className="font-bold">{p.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>

      {/* QR MODAL PREVIEW */}
      <AnimatePresence>
        {isQrModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              className="bg-[#0b1114] border-2 border-amber-500/70 p-6 max-w-sm w-full text-center space-y-4 shadow-2xl"
            >
              <h3 className="font-sans text-lg font-black uppercase tracking-widest text-amber-400">
                Código QR · Escape Guardian
              </h3>
              <p className="font-mono text-xs text-slate-300">
                Escanea con la cámara para ingresar a la expedición:
              </p>

              <div className="w-56 h-56 bg-white p-3 mx-auto shadow-2xl flex items-center justify-center">
                <QRCodeSVG value={joinUrl} size={200} level="H" includeMargin={false} />
              </div>

              <div className="bg-[#121c21] p-3 border border-slate-700 text-center font-mono">
                <span className="text-[11px] text-slate-400 block uppercase">
                  PIN de la partida:
                </span>
                <span className="text-3xl font-black text-white tracking-widest">{roomCode}</span>
              </div>

              <button
                onClick={() => setIsQrModalOpen(false)}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-wider text-xs cursor-pointer"
              >
                Cerrar QR
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </HeatGuardianLobbyShell>
  );
};
