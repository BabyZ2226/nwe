import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldAlert,
  Users,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Globe,
  Home,
  QrCode,
  Vote,
  Sparkles,
  Award,
  Trophy,
  Copy,
  Check,
  Play,
  Volume2,
  VolumeX,
  Maximize,
  Palette,
  Share2,
  LogOut,
  Clock,
  ArrowLeft,
  Settings,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  GamePlayer,
  RoomState,
  ImpostorGamePack,
  ImpostorMatchState,
  ImpostorVoteRecord,
} from '../types';
import {
  SEED_IMPOSTOR_LIBRARY,
  createInitialImpostorMatchState,
} from '../lib/impostorEngine';
import { ImpostorLibraryModal } from './ImpostorLibraryModal';
import { QRCodeModal } from './QRCodeModal';
import { MatchStartCountdown } from './MatchStartCountdown';
import { TeacherSpectatorDashboard } from './TeacherSpectatorDashboard';
import { socketClient } from '../lib/socketClient';
import { playBalatroSound, isSfxMuted, setSfxMuted } from '../lib/soundEffects';
import { saveMatchRecord } from '../lib/matchHistory';
import { cn } from '../lib/utils';
import {
  HeatGuardianAtmosphere,
  HeatGuardianLobbyShell,
  HeatGuardianMenuItem,
} from './HeatGuardianBackdrop';

interface ElImpostorGameProps {
  players: GamePlayer[];
  currentUserId: string;
  isTeacherSpectator?: boolean;
  isSoloPractice?: boolean;
  room?: RoomState | null;
  initialPack?: ImpostorGamePack;
  onGoHome: () => void;
}

/**
 * Renders an Among-Us style Crewmate / Scientist SVG icon in the statement's color.
 */
const CrewmateSuspectIcon: React.FC<{
  color: 'red' | 'cyan' | 'lime' | 'amber';
  isEjected?: boolean;
}> = ({ color, isEjected = false }) => {
  const palette = {
    red: { body: '#ef4444', shadow: '#991b1b', visor: '#bae6fd' },
    cyan: { body: '#06b6d4', shadow: '#155e75', visor: '#e0f2fe' },
    lime: { body: '#22c55e', shadow: '#166534', visor: '#dcfce7' },
    amber: { body: '#f59e0b', shadow: '#92400e', visor: '#fef3c7' },
  }[color];

  return (
    <svg
      viewBox="0 0 48 54"
      className={cn('w-10 h-11 shrink-0 transition-transform', isEjected && 'rotate-45 scale-90')}
    >
      {/* Backpack */}
      <rect x="4" y="16" width="8" height="22" rx="4" fill={palette.shadow} stroke="#090a0f" strokeWidth="2.5" />
      {/* Main Suit Body */}
      <path
        d="M12,18 C12,8 36,8 36,18 L36,40 L30,40 L30,48 L22,48 L22,38 L20,38 L20,48 L12,48 Z"
        fill={palette.body}
        stroke="#090a0f"
        strokeWidth="2.5"
      />
      {/* Visor Goggle */}
      <rect
        x="20"
        y="14"
        width="20"
        height="12"
        rx="6"
        fill={palette.visor}
        stroke="#090a0f"
        strokeWidth="2.5"
      />
      {/* Visor Highlight */}
      <ellipse cx="27" cy="17.5" rx="5" ry="2" fill="#ffffff" opacity="0.85" />
    </svg>
  );
};

export const ElImpostorGame: React.FC<ElImpostorGameProps> = ({
  players,
  currentUserId,
  isTeacherSpectator = false,
  isSoloPractice = false,
  room,
  initialPack,
  onGoHome,
}) => {
  const [selectedPack, setSelectedPack] = useState<ImpostorGamePack>(
    () => initialPack || SEED_IMPOSTOR_LIBRARY[0]
  );
  const [localState, setLocalState] = useState<ImpostorMatchState>(() =>
    createInitialImpostorMatchState(initialPack || SEED_IMPOSTOR_LIBRARY[0])
  );
  const [selectedStatementIdx, setSelectedStatementIdx] = useState<number | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);

  // Pre-game Lobby vs In-game Match Phase & 3-Second Countdown
  const [gamePhase, setGamePhase] = useState<'lobby' | 'playing'>('lobby');
  const [isCountdownActive, setIsCountdownActive] = useState<boolean>(false);

  // Auto-request fullscreen when match begins
  useEffect(() => {
    if (gamePhase === 'playing') {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    }
  }, [gamePhase]);

  const toggleMatchFullscreen = () => {
    playBalatroSound('select');
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Lobby UI controls
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isTeacherConfigOpen, setIsTeacherConfigOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(isSfxMuted());
  const [currentTheme, setCurrentTheme] = useState<'neon' | 'dungeon' | 'cyber'>('neon');
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  // Teacher Pre-game Configuration State for El Impostor
  const [cfgRoundTime, setCfgRoundTime] = useState<number>(0); // 0 = Sin límite, 30, 45, 60, 90
  const [cfgMaxRounds, setCfgMaxRounds] = useState<number>(0); // 0 = Todas
  const [cfgPointsPerHit, setCfgPointsPerHit] = useState<number>(100);
  const [cfgWrongPenalty, setCfgWrongPenalty] = useState<number>(0);
  const [cfgShuffleRounds, setCfgShuffleRounds] = useState<boolean>(false);
  const [cfgShuffleStatements, setCfgShuffleStatements] = useState<boolean>(true);
  const [cfgHideLiveVotes, setCfgHideLiveVotes] = useState<boolean>(false);
  const [cfgAutoReveal, setCfgAutoReveal] = useState<boolean>(false);
  const [roundSecondsLeft, setRoundSecondsLeft] = useState<number>(0);

  const isHost = room ? room.hostId === currentUserId : true;
  const effectiveIsTeacher = Boolean(
    isTeacherSpectator ||
      (room && room.hostIsSpectator && room.hostId === currentUserId) ||
      (typeof window !== 'undefined' && localStorage.getItem('po_user_role') === 'teacher')
  );
  const roomCode = room?.code || (isSoloPractice ? 'SOLO' : '404888');

  // Auto-provision a live room if mounting in classroom multiplayer mode without one
  useEffect(() => {
    if (!room && !isSoloPractice) {
      const pName =
        localStorage.getItem('po_player_name') || (isTeacherSpectator ? 'Profesor' : 'Estudiante');
      const pAvatar =
        localStorage.getItem('po_player_avatar') || (isTeacherSpectator ? '👨‍🏫' : '🧑‍🎓');
      socketClient.createRoom(
        pName,
        pAvatar,
        0,
        20,
        'Debate: El Impostor en Clase',
        isTeacherSpectator,
        'el_impostor'
      );
    }
  }, [room, isTeacherSpectator, isSoloPractice]);

  // Sync pack if initialPack changes
  useEffect(() => {
    if (initialPack) {
      setSelectedPack(initialPack);
      const next = createInitialImpostorMatchState(initialPack);
      setLocalState(next);
      setSelectedStatementIdx(null);
      if (room && !isSoloPractice) {
        socketClient.updateImpostorState(next);
      }
    }
  }, [initialPack]);

  // Sync phase transitions from multiplayer room
  const prevRoomPhaseRef = useRef<string>(room?.phase || 'lobby');
  useEffect(() => {
    const currentPhase = room?.phase;
    if (!currentPhase) return;
    if (currentPhase !== prevRoomPhaseRef.current) {
      prevRoomPhaseRef.current = currentPhase;
      if (currentPhase === 'countdown') {
        setIsCountdownActive(true);
        setGamePhase('playing');
      } else if (currentPhase === 'playing') {
        setGamePhase('playing');
      } else if (currentPhase === 'lobby') {
        setIsCountdownActive(false);
        setGamePhase('lobby');
      }
    }
  }, [room?.phase]);

  const matchState: ImpostorMatchState =
    !isSoloPractice && room?.impostorState ? room.impostorState : localState;

  // Strictly filter out teacher spectators so the teacher NEVER appears as a connected player
  const studentPlayers = useMemo(() => {
    const list = room?.players || players;
    const seen = new Set<string>();
    return list.filter((p) => {
      if (p.isBot) return false;
      if (
        p.isSpectator ||
        p.role === 'teacher' ||
        p.name.toLowerCase().includes('profesor') ||
        p.name.toLowerCase().includes('docente') ||
        (effectiveIsTeacher &&
          (p.id === room?.hostId || p.id === currentUserId || p.id === 'hero-player'))
      ) {
        return false;
      }
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [room?.players, players, effectiveIsTeacher, room?.hostId, currentUserId]);

  const currentPlayer = useMemo(
    () => studentPlayers.find((p) => p.id === currentUserId) || null,
    [studentPlayers, currentUserId]
  );

  const currentRound =
    matchState.rounds[matchState.currentRoundIndex] || matchState.rounds[0];

  const myVoterId = currentUserId || 'solo-hero';
  const myExistingVote = matchState.votes?.[myVoterId];
  const myScore = matchState.playerScores?.[myVoterId] || 0;

  // Reset local selection when round changes
  useEffect(() => {
    setSelectedStatementIdx(null);
  }, [matchState.currentRoundIndex, matchState.packId]);

  const syncMatchState = (nextState: ImpostorMatchState) => {
    setLocalState(nextState);
    if (!isSoloPractice && room) {
      socketClient.updateImpostorState(nextState);
    }
  };

  const buildTeacherConfig = () => ({
    roundTimeSeconds: cfgRoundTime,
    maxRounds: cfgMaxRounds,
    pointsPerHit: cfgPointsPerHit,
    wrongVotePenalty: cfgWrongPenalty,
    shuffleRounds: cfgShuffleRounds,
    shuffleStatements: cfgShuffleStatements,
    hideLiveVotes: cfgHideLiveVotes,
    autoRevealWhenAllVote: cfgAutoReveal,
  });

  const handleSelectPackFromLibrary = (pack: ImpostorGamePack) => {
    setSelectedPack(pack);
    const next = createInitialImpostorMatchState(pack, buildTeacherConfig());
    setSelectedStatementIdx(null);
    syncMatchState(next);
  };

  const handleStartMatchFromLobby = () => {
    const fresh = createInitialImpostorMatchState(selectedPack, buildTeacherConfig());
    setSelectedStatementIdx(null);
    setLocalState(fresh);
    if (room && !isSoloPractice) {
      socketClient.updateImpostorState(fresh);
      socketClient.startGame();
    }
    setIsCountdownActive(true);
    setGamePhase('playing');
  };

  const handleReturnToLobby = () => {
    setIsCountdownActive(false);
    setGamePhase('lobby');
    if (room && !isSoloPractice) {
      socketClient.returnToLobby();
    }
    playBalatroSound('click');
  };

  const hostDisplay = typeof window !== 'undefined' ? window.location.host : 'aulaplay.edu';
  const joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${roomCode}&game=el_impostor`
      : `https://aulaplay.edu?room=${roomCode}&game=el_impostor`;

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

  const themeStyles = {
    neon: {
      leftDoor1: '#ef4444',
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

  const handleCastVote = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStatementIdx === null || !currentRound) return;

    playBalatroSound('play');
    const voterName =
      currentPlayer?.name ||
      localStorage.getItem('po_player_name') ||
      (isTeacherSpectator ? 'Demostración' : 'Estudiante');

    const voteRecord: ImpostorVoteRecord = {
      playerId: myVoterId,
      playerName: voterName,
      playerAvatar: currentPlayer?.avatar || '🕵️',
      statementIndex: selectedStatementIdx,
      timestamp: Date.now(),
    };

    const hitPoints = matchState.pointsPerHit || 100;
    const penaltyPoints = matchState.wrongVotePenalty || 0;

    if (isSoloPractice || !room) {
      // In solo practice, immediately reveal the ejection verdict!
      const isCorrectImpostor =
        currentRound.statements[selectedStatementIdx]?.isImpostor === true;
      const deltaPoints = isCorrectImpostor ? hitPoints : -penaltyPoints;
      const currentScores = matchState.playerScores || {};

      const nextState: ImpostorMatchState = {
        ...matchState,
        phase: 'revealed',
        ejectedStatementIndex: selectedStatementIdx,
        playerScores: {
          ...currentScores,
          [voteRecord.playerId]: Math.max(0, (currentScores[voteRecord.playerId] || 0) + deltaPoints),
        },
        votes: {
          ...matchState.votes,
          [voteRecord.playerId]: voteRecord,
        },
      };
      setLocalState(nextState);
    } else {
      socketClient.submitImpostorVote(voteRecord);
    }
  };

  const handleRevealImpostor = () => {
    if (!currentRound) return;
    playBalatroSound('play');

    const hitPoints = matchState.pointsPerHit || 100;
    const penaltyPoints = matchState.wrongVotePenalty || 0;

    const updatedScores: Record<string, number> = {
      ...(matchState.playerScores || {}),
    };
    const voteCounts: Record<number, number> = {};

    (Object.values(matchState.votes || {}) as ImpostorVoteRecord[]).forEach((v) => {
      voteCounts[v.statementIndex] = (voteCounts[v.statementIndex] || 0) + 1;
      const isRightImpostor = currentRound.statements[v.statementIndex]?.isImpostor === true;
      if (isRightImpostor) {
        updatedScores[v.playerId] = (updatedScores[v.playerId] || 0) + hitPoints;
      } else if (penaltyPoints > 0) {
        updatedScores[v.playerId] = Math.max(0, (updatedScores[v.playerId] || 0) - penaltyPoints);
      }
    });

    // Find most voted statement index (or actual impostor if no votes yet)
    const realImpostorIdx = currentRound.statements.findIndex((s) => s.isImpostor);
    let mostVotedIdx = realImpostorIdx;
    let maxVotes = 0;
    Object.entries(voteCounts).forEach(([idxStr, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        mostVotedIdx = Number(idxStr);
      }
    });

    const nextState: ImpostorMatchState = {
      ...matchState,
      phase: 'revealed',
      ejectedStatementIndex: mostVotedIdx,
      playerScores: updatedScores,
    };

    syncMatchState(nextState);
  };

  // Auto-reveal when all connected students have voted (if enabled by teacher)
  useEffect(() => {
    if (
      gamePhase === 'playing' &&
      !isCountdownActive &&
      matchState.phase === 'debate' &&
      matchState.autoRevealWhenAllVote &&
      (isHost || effectiveIsTeacher) &&
      studentPlayers.length > 0
    ) {
      const currentVotesCount = Object.keys(matchState.votes || {}).length;
      if (currentVotesCount >= studentPlayers.length) {
        handleRevealImpostor();
      }
    }
  }, [
    gamePhase,
    isCountdownActive,
    matchState.phase,
    matchState.autoRevealWhenAllVote,
    matchState.votes,
    isHost,
    effectiveIsTeacher,
    studentPlayers.length,
  ]);

  // Round countdown timer if roundTimeSeconds > 0
  useEffect(() => {
    const configuredSecs = matchState.roundTimeSeconds || 0;
    if (gamePhase !== 'playing' || isCountdownActive || matchState.phase !== 'debate' || configuredSecs <= 0) {
      setRoundSecondsLeft(0);
      return;
    }

    setRoundSecondsLeft(configuredSecs);
    const interval = setInterval(() => {
      setRoundSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (isHost || effectiveIsTeacher || isSoloPractice) {
            handleRevealImpostor();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gamePhase, isCountdownActive, matchState.phase, matchState.currentRoundIndex, matchState.roundTimeSeconds]);

  const handleNextRound = () => {
    playBalatroSound('select');
    if (matchState.currentRoundIndex + 1 < matchState.rounds.length) {
      const nextState: ImpostorMatchState = {
        ...matchState,
        currentRoundIndex: matchState.currentRoundIndex + 1,
        phase: 'debate',
        votes: {},
        ejectedStatementIndex: null,
      };
      syncMatchState(nextState);
    } else {
      const finishedState: ImpostorMatchState = {
        ...matchState,
        phase: 'finished',
      };
      syncMatchState(finishedState);

      const maxPossible = Math.max(100, matchState.rounds.length * 100);
      const scoresMap = matchState.playerScores || {};
      const myFinalScore = scoresMap[myVoterId] || 0;
      const myGrade = Math.min(100, Math.max(60, Math.round((myFinalScore / maxPossible) * 100)));

      // Save individual match history record
      saveMatchRecord({
        gameType: 'el_impostor',
        gameTitle: `El Impostor: ${matchState.packTitle}`,
        roomCode: room?.code || 'SOLO',
        role: isTeacherSpectator ? 'teacher' : 'student',
        playerName: currentPlayer?.name || room?.teacherName || 'Detective',
        playerAvatar: currentPlayer?.avatar || '🕵️',
        grade: myGrade,
        score: myFinalScore,
        isVictory: myFinalScore >= maxPossible * 0.6,
        statusText: `Puntaje Individual: ${myFinalScore} pts`,
        detailsText: `Investigación Individual (${matchState.rounds.length} rondas)`,
        studentResults: studentPlayers.map((p) => {
          const stScore = scoresMap[p.id] || 0;
          const stGrade = Math.min(100, Math.max(60, Math.round((stScore / maxPossible) * 100)));
          return {
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            grade: stGrade,
            score: stScore,
            escapedOrWon: stScore >= maxPossible * 0.6,
            details: `${stScore} pts (${Math.round(stScore / 100)}/${matchState.rounds.length} impostores detectados)`,
          };
        }),
      });
    }
  };

  const handleRestartMatch = () => {
    playBalatroSound('select');
    const fresh: ImpostorMatchState = {
      ...matchState,
      currentRoundIndex: 0,
      phase: 'debate',
      playerScores: {},
      votes: {},
      ejectedStatementIndex: null,
    };
    syncMatchState(fresh);
  };

  const votesList: ImpostorVoteRecord[] = useMemo(
    () => Object.values(matchState.votes || {}),
    [matchState.votes]
  );

  const realImpostorIndex = useMemo(
    () => currentRound?.statements.findIndex((s) => s.isImpostor) ?? 0,
    [currentRound]
  );

  // Individual leaderboard for finished screen
  const individualRanking = useMemo(() => {
    const scoresMap = matchState.playerScores || {};
    if (isSoloPractice || studentPlayers.length === 0) {
      const soloName =
        currentPlayer?.name ||
        localStorage.getItem('po_player_name') ||
        'Detective';
      return [
        {
          id: myVoterId,
          name: soloName,
          avatar: currentPlayer?.avatar || '🕵️',
          score: scoresMap[myVoterId] || 0,
        },
      ];
    }

    return studentPlayers
      .map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: scoresMap[p.id] || 0,
      }))
      .sort((a, b) => b.score - a.score);
  }, [matchState.playerScores, isSoloPractice, studentPlayers, currentPlayer, myVoterId]);

  const selectedStatement =
    selectedStatementIdx !== null ? currentRound?.statements[selectedStatementIdx] : null;

  // ============================================================================
  // A. UNIFIED PRE-GAME WAITING ROOM / LOBBY VIEW (HEAT GUARDIAN MONOLITH STYLE)
  // ============================================================================
  if (gamePhase === 'lobby') {
    const canControlLobby = isHost || effectiveIsTeacher || isSoloPractice;
    const impostorMenuItems: HeatGuardianMenuItem[] = [
      {
        id: 'play',
        label: canControlLobby ? 'JUGAR' : 'ESPERANDO...',
        active: true,
        disabled: !canControlLobby,
        onClick: () => {
          if (canControlLobby) {
            playBalatroSound('play');
            handleStartMatchFromLobby();
          }
        },
      },
      ...(canControlLobby
        ? [
            {
              id: 'settings',
              label: 'AJUSTES',
              badge: cfgRoundTime > 0 ? `${cfgRoundTime}S` : 'LIBRE',
              onClick: () => {
                playBalatroSound('select');
                setIsTeacherConfigOpen(true);
              },
            },
          ]
        : []),
      {
        id: 'library',
        label: 'BIBLIOTECA',
        badge: `${SEED_IMPOSTOR_LIBRARY.length}+`,
        onClick: () => {
          playBalatroSound('click');
          setIsLibraryOpen(true);
        },
      },
      {
        id: 'qr',
        label: 'CÓDIGO QR',
        onClick: () => {
          playBalatroSound('click');
          setIsQrModalOpen(true);
        },
      },
      {
        id: 'exit',
        label: 'SALIR',
        onClick: onGoHome,
      },
    ];

    return (
      <HeatGuardianLobbyShell
        titleLine1="EL"
        titleLine2="IMPOSTOR"
        subtitleBadge="INVESTIGACIÓN INDIVIDUAL · 3 VERDADES Y 1 MENTIRA"
        creditText={`EXPEDIENTE PIN · ${roomCode}`}
        variant="crimson_mist"
        menuItems={impostorMenuItems}
        topRightSlot={
          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => {
                playBalatroSound('click');
                setIsLibraryOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0b1114]/90 hover:bg-[#162127] text-amber-400 border border-amber-500/40 font-sans font-bold rounded-none cursor-pointer text-xs shadow-md tracking-wider uppercase"
            >
              <Globe size={14} />
              <span className="hidden sm:inline">
                Expedientes ({SEED_IMPOSTOR_LIBRARY.length}+)
              </span>
              <span className="sm:hidden">Temas</span>
            </button>

            <button
              onClick={toggleSound}
              className="p-2 bg-[#0b1114]/90 hover:bg-[#162127] border border-white/15 rounded-none text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Silenciar / Activar sonido"
            >
              {soundMuted ? (
                <VolumeX size={15} className="text-red-400" />
              ) : (
                <Volume2 size={15} className="text-amber-400" />
              )}
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2 bg-[#0b1114]/90 hover:bg-[#162127] border border-white/15 rounded-none text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Pantalla completa"
            >
              <Maximize size={15} />
            </button>

            <button
              onClick={onGoHome}
              className="px-3.5 py-1.5 bg-[#1b0e12]/90 hover:bg-red-950/90 border border-red-500/40 text-red-200 font-bold rounded-none cursor-pointer transition-all flex items-center gap-1.5 uppercase tracking-wider"
            >
              <LogOut size={13} />
              <span>Salir</span>
            </button>
          </div>
        }
      >
        <div className="w-full max-w-2xl space-y-4">
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full bg-[#0b1114]/92 border-2 border-[#2a3b44] shadow-[0_24px_60px_rgba(0,0,0,0.9)] p-5 sm:p-6 backdrop-blur-md space-y-5 relative overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
              <div className="md:col-span-2 flex flex-col justify-between space-y-3">
                <div className="bg-[#121c21]/90 border border-[#283842] p-3 sm:p-3.5 flex items-center gap-3">
                  <div className="w-7 h-7 bg-[#0b1114] text-amber-400 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/40">
                    01
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block leading-tight">
                      Enlace de acceso al expediente:
                    </span>
                    <div
                      onClick={handleCopyUrl}
                      className="text-xs sm:text-sm font-mono text-slate-100 font-bold truncate block cursor-pointer hover:text-amber-300"
                      title="Clic para copiar enlace directo"
                    >
                      {hostDisplay}
                    </div>
                  </div>
                  <button
                    onClick={handleCopyUrl}
                    className="p-2 bg-[#1a2830] hover:bg-[#243742] text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer shrink-0"
                    title="Copiar enlace de acceso"
                  >
                    {copiedUrl ? <Check size={15} className="text-amber-400" /> : <Copy size={15} />}
                  </button>
                </div>

                <div className="bg-[#121c21]/90 border border-[#283842] p-3 sm:p-3.5 flex items-center gap-3">
                  <div className="w-7 h-7 bg-[#0b1114] text-amber-400 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/40">
                    02
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block leading-tight">
                      {roomCode === 'SOLO'
                        ? 'Modo de práctica individual:'
                        : 'PIN de acceso a la sala:'}
                    </span>
                    <div
                      onClick={handleCopyCode}
                      className="text-3xl sm:text-4xl font-black font-mono tracking-[0.2em] text-white drop-shadow-[0_2px_10px_rgba(245,158,11,0.3)] cursor-pointer hover:text-amber-300 transition-colors"
                      title="Clic para copiar código"
                    >
                      {roomCode}
                    </div>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="p-2.5 bg-[#1a2830] hover:bg-[#243742] text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer shrink-0"
                    title="Copiar código PIN"
                  >
                    {copiedCode ? <Check size={17} className="text-amber-400" /> : <Copy size={17} />}
                  </button>
                </div>
              </div>

              <div className="bg-[#121c21]/90 border border-[#283842] p-3.5 flex flex-col items-center justify-between text-center">
                <div
                  onClick={() => setIsQrModalOpen(true)}
                  className="w-24 h-24 sm:w-28 sm:h-28 bg-white p-2 shadow-lg cursor-pointer hover:scale-105 transition-transform flex items-center justify-center border-2 border-amber-500/40"
                  title="Clic para agrandar QR"
                >
                  <QRCodeSVG value={joinUrl} size={96} level="M" includeMargin={false} />
                </div>

                <div className="w-full mt-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                    Escanear QR
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={handleCopyUrl}
                      className="p-1.5 bg-[#1a2830] hover:bg-[#243742] text-slate-200 border border-white/10 text-xs cursor-pointer"
                      title="Copiar enlace"
                    >
                      <Share2 size={13} />
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `¡Únete a la partida de El Impostor! Ingresa en ${joinUrl} o usa el código PIN ${roomCode}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 bg-[#1a2830] hover:bg-[#243742] text-amber-300 border border-amber-500/30 text-xs cursor-pointer"
                      title="Compartir en WhatsApp"
                    >
                      📱
                    </a>
                    <button
                      onClick={() => setIsQrModalOpen(true)}
                      className="p-1.5 bg-[#1a2830] hover:bg-[#243742] text-slate-200 border border-white/10 text-xs cursor-pointer"
                      title="Ver QR gigante"
                    >
                      <QrCode size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#121c21]/95 border border-amber-500/35 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-lg shrink-0">
                  🕵️
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                      Expediente · {matchState.rounds[0]?.subject || selectedPack.subject}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#0b1114] text-slate-200 border border-white/15">
                      {matchState.rounds.length} Rondas
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate mt-0.5">
                    {matchState.packTitle}
                  </h4>
                </div>
              </div>

              {canControlLobby && (
                <button
                  type="button"
                  onClick={() => {
                    playBalatroSound('select');
                    setIsLibraryOpen(true);
                  }}
                  className="w-full sm:w-auto px-3.5 py-2 bg-[#1a2830] hover:bg-[#243742] text-amber-300 border border-amber-500/40 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 uppercase tracking-wider"
                >
                  <Sparkles size={13} />
                  <span>Cambiar Tema / IA</span>
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-[#121c21] border border-[#283842] text-slate-200 text-xs">
                  <ShieldAlert size={15} className="text-amber-400 shrink-0" />
                  <div className="text-left leading-tight">
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
                      Modalidad
                    </span>
                    <span className="text-white font-mono font-bold">
                      Individual · 3 Verdades y 1 Impostor
                    </span>
                  </div>
                </div>

                {canControlLobby && (
                  <button
                    type="button"
                    onClick={() => {
                      playBalatroSound('select');
                      setIsTeacherConfigOpen(true);
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-[#121c21] hover:bg-[#1a2830] border border-amber-500/40 hover:border-amber-400 text-slate-200 text-xs font-bold transition-all cursor-pointer"
                    title="Configurar tiempo por ronda, puntos, barajado de impostor y voto secreto"
                  >
                    <Settings size={15} className="text-amber-400" />
                    <div className="text-left leading-tight">
                      <span className="text-[10px] text-slate-400 block font-normal uppercase tracking-wider">
                        Ajustes Docente
                      </span>
                      <span className="text-amber-300 font-mono font-bold">
                        {cfgRoundTime > 0 ? `⏱️ ${cfgRoundTime}s` : '⏱️ Libre'} · +{cfgPointsPerHit} pts ·{' '}
                        {cfgHideLiveVotes ? '🔒 Secreto' : '👁️ Público'}
                      </span>
                    </div>
                  </button>
                )}
              </div>

              <div className="flex-1 sm:flex-initial flex justify-center">
                {canControlLobby ? (
                  <button
                    type="button"
                    onClick={() => {
                      playBalatroSound('play');
                      handleStartMatchFromLobby();
                    }}
                    className="w-full sm:w-auto px-8 sm:px-10 py-3 bg-amber-500 hover:bg-amber-400 active:translate-y-0.5 text-slate-950 font-black text-sm sm:text-base cursor-pointer shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all flex items-center justify-center gap-2 tracking-[0.2em] uppercase"
                  >
                    <Play size={17} fill="currentColor" />
                    <span>JUGAR</span>
                  </button>
                ) : (
                  <div className="w-full sm:w-auto px-5 py-2.5 bg-[#121c21] border border-amber-500/30 text-amber-300 font-bold text-xs font-mono flex items-center justify-center gap-2 select-none">
                    <Clock size={15} className="text-amber-400 animate-spin" />
                    <span>Esperando al docente...</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 px-3 py-2 bg-[#121c21] border border-[#283842] text-slate-200 font-mono text-xs font-bold">
                <Users size={15} className="text-amber-400" />
                <span>{studentPlayers.length}</span>
              </div>
            </div>
          </motion.div>

          <div className="w-full bg-[#0b1114]/85 border border-[#26353d] p-3.5 backdrop-blur-sm space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-300">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Detectives conectados en la frecuencia ({studentPlayers.length})</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pt-1">
              {studentPlayers.length === 0 ? (
                <div className="w-full text-center py-3 bg-[#121c21]/70 border border-dashed border-[#283842] text-xs font-mono text-slate-400">
                  Sin detectives en sala. Comparte el código{' '}
                  <strong className="text-amber-400">{roomCode}</strong> o pulsa{' '}
                  <strong className="text-white">JUGAR ▶</strong> en la columna izquierda.
                </div>
              ) : (
                studentPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#121c21] border border-amber-500/30 text-xs font-mono"
                  >
                    <span className="text-base">{p.avatar}</span>
                    <span className="font-bold text-slate-100">{p.name}</span>
                    <span className="text-[10px] text-amber-400 font-bold">✓ LISTO</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* QR MODAL PREVIEW */}
        <AnimatePresence>
          {isQrModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[#0b1114] border-2 border-[#2a3b44] p-6 max-w-sm w-full text-center space-y-4 shadow-2xl"
              >
                <h3 className="font-sans text-lg font-black uppercase tracking-widest text-amber-400">
                  Código QR · El Impostor
                </h3>
                <p className="font-mono text-xs text-slate-300">
                  Los estudiantes pueden escanear este código para unirse a la investigación:
                </p>
                <div className="w-56 h-56 bg-white p-3 mx-auto shadow-2xl flex items-center justify-center border-2 border-amber-500/40">
                  <QRCodeSVG value={joinUrl} size={200} level="H" includeMargin={false} />
                </div>
                <div className="bg-[#121c21] p-3 border border-[#283842] text-center font-mono">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    PIN de la sala:
                  </span>
                  <span className="text-3xl font-black text-white tracking-widest">{roomCode}</span>
                </div>
                <button
                  onClick={() => setIsQrModalOpen(false)}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-widest text-xs cursor-pointer"
                >
                  Cerrar QR
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Infinite Library Modal */}
        <ImpostorLibraryModal
          isOpen={isLibraryOpen}
          defaultAuthorName={room?.teacherName || localStorage.getItem('po_player_name') || 'Docente'}
          onClose={() => setIsLibraryOpen(false)}
          onSelectPack={(pack) => {
            setIsLibraryOpen(false);
            handleSelectPackFromLibrary(pack);
          }}
        />

        {/* TEACHER PRE-GAME CONFIGURATION MODAL (EL IMPOSTOR) */}
        <AnimatePresence>
          {isTeacherConfigOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                className="bg-[#0b1114] border-2 border-[#2a3b44] p-5 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl text-xs font-sans text-slate-200 max-h-[90dvh] overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-[#26353d] pb-3">
                  <div className="flex items-center gap-2">
                    <Settings size={18} className="text-amber-400" />
                    <h3 className="font-sans text-sm sm:text-base font-black uppercase tracking-wider text-amber-400">
                      Configuraciones del Docente · El Impostor
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsTeacherConfigOpen(false)}
                    aria-label="Cerrar configuración"
                    className="p-1 text-slate-400 hover:text-white hover:bg-[#162127] cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* 1. Tiempo de Votación por Ronda */}
                <div className="bg-[#121c21] p-3 border border-[#26353d] space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                    ⏱️ Tiempo Límite de Investigación y Votación por Ronda
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { v: 0, label: 'Sin reloj' },
                      { v: 30, label: '30 seg' },
                      { v: 45, label: '45 seg' },
                      { v: 60, label: '60 seg' },
                      { v: 90, label: '90 seg' },
                    ].map((t) => (
                      <button
                        key={t.v}
                        type="button"
                        onClick={() => {
                          playBalatroSound('select');
                          setCfgRoundTime(t.v);
                        }}
                        className={`py-2 border text-[11px] font-bold cursor-pointer transition-colors ${
                          cfgRoundTime === t.v
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300 hover:text-white'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Cantidad de Rondas a Jugar */}
                <div className="bg-[#121c21] p-3 border border-[#26353d] space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-200 block">
                    🔢 Cantidad de Rondas a Jugar (Expediente tiene {selectedPack.rounds.length})
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { v: 0, label: `Todas (${selectedPack.rounds.length})` },
                      { v: 1, label: '1 Ronda' },
                      { v: 2, label: '2 Rondas' },
                      { v: 3, label: '3 Rondas' },
                      { v: 4, label: '4 Rondas' },
                    ].map((r) => (
                      <button
                        key={r.v}
                        type="button"
                        onClick={() => {
                          playBalatroSound('select');
                          setCfgMaxRounds(r.v);
                        }}
                        className={`py-1.5 border text-[11px] font-bold cursor-pointer transition-colors ${
                          cfgMaxRounds === r.v
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300 hover:text-white'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Puntos por Acierto & Penalización por Error */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="bg-[#121c21] p-3 border border-[#26353d] space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                      🏆 Puntos por Detectar Impostor
                    </label>
                    <div className="grid grid-cols-4 gap-1">
                      {[100, 150, 200, 250].map((pts) => (
                        <button
                          key={pts}
                          type="button"
                          onClick={() => setCfgPointsPerHit(pts)}
                          className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                            cfgPointsPerHit === pts
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                          }`}
                        >
                          +{pts}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#121c21] p-3 border border-[#26353d] space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-rose-300 block">
                      ⚠️ Penalización por Error
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { v: 0, label: '0 pts' },
                        { v: 25, label: '-25 pts' },
                        { v: 50, label: '-50 pts' },
                      ].map((pen) => (
                        <button
                          key={pen.v}
                          type="button"
                          onClick={() => setCfgWrongPenalty(pen.v)}
                          className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                            cfgWrongPenalty === pen.v
                              ? 'bg-rose-600 text-white border-rose-400'
                              : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                          }`}
                        >
                          {pen.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Aleatoriedad de Posición del Impostor y Rondas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="bg-[#121c21] p-3 border border-[#26353d] space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-200 block">
                      🔀 Barajar Posición Impostor
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCfgShuffleStatements(true)}
                        className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                          cfgShuffleStatements
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                        }`}
                      >
                        Aleatoria
                      </button>
                      <button
                        type="button"
                        onClick={() => setCfgShuffleStatements(false)}
                        className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                          !cfgShuffleStatements
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                        }`}
                      >
                        Posición Fija
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#121c21] p-3 border border-[#26353d] space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                      🔀 Orden de las Rondas
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCfgShuffleRounds(false)}
                        className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                          !cfgShuffleRounds
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                        }`}
                      >
                        Secuencial
                      </button>
                      <button
                        type="button"
                        onClick={() => setCfgShuffleRounds(true)}
                        className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                          cfgShuffleRounds
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                        }`}
                      >
                        Barajar Rondas
                      </button>
                    </div>
                  </div>
                </div>

                {/* 5. Voto Secreto vs Público & Auto-Revelación */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="bg-[#121c21] p-3 border border-[#26353d] space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-200 block">
                      👁️ Visibilidad de Votos
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCfgHideLiveVotes(false)}
                        className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                          !cfgHideLiveVotes
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                        }`}
                      >
                        👁️ Público
                      </button>
                      <button
                        type="button"
                        onClick={() => setCfgHideLiveVotes(true)}
                        className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                          cfgHideLiveVotes
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                        }`}
                      >
                        🔒 Secreto
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#121c21] p-3 border border-[#26353d] space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                      ⚡ Revelar al Votar Todos
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCfgAutoReveal(false)}
                        className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                          !cfgAutoReveal
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                        }`}
                      >
                        Manual (Docente)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCfgAutoReveal(true)}
                        className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                          cfgAutoReveal
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                        }`}
                      >
                        Automático
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    playBalatroSound('play');
                    const updated = createInitialImpostorMatchState(selectedPack, buildTeacherConfig());
                    syncMatchState(updated);
                    setIsTeacherConfigOpen(false);
                  }}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-widest text-xs cursor-pointer shadow-lg transition-colors"
                >
                  Guardar y Aplicar Configuraciones
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </HeatGuardianLobbyShell>
    );
  }

  // ============================================================================
  // B. ACTIVE INVESTIGATION & VOTING STAGE (HEAT GUARDIAN MONOLITH STYLE)
  // ============================================================================
  if (effectiveIsTeacher) {
    return (
      <div className="relative w-full h-[100dvh]">
        {isCountdownActive && (
          <MatchStartCountdown
            onComplete={() => setIsCountdownActive(false)}
            subtitle="¡EL IMPOSTOR · MONITOREO DOCENTE!"
          />
        )}
        <TeacherSpectatorDashboard
          gameType="el_impostor"
          gameTitle={matchState.packTitle}
          room={room || null}
          players={players}
          roomCode={roomCode}
          totalInitialSeconds={cfgRoundTime || 120}
          timeRemainingSecs={roundSecondsLeft}
          totalQuestions={matchState.rounds.length}
          currentQuestionText={currentRound?.prompt}
          impostorState={matchState}
          onGoLobby={handleReturnToLobby}
          onGoHome={onGoHome}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 w-screen min-h-screen overflow-y-auto bg-[#0b1114] text-slate-100 flex flex-col justify-between select-none p-2 sm:p-3">
      {/* Fluid 3-2-1 Countdown Overlay */}
      {isCountdownActive && (
        <MatchStartCountdown
          onComplete={() => setIsCountdownActive(false)}
          subtitle="¡EL IMPOSTOR · INVESTIGACIÓN INDIVIDUAL!"
        />
      )}

      {/* Heat Guardian Winter & Ash Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <HeatGuardianAtmosphere
          variant="crimson_mist"
          showGuardianScene={false}
          sceneOpacity={0.45}
        />
      </div>

      {/* =====================================================================
          1. TOP EMERGENCY MEETING COMMAND BAR (INDIVIDUAL MODE)
      ===================================================================== */}
      <header className="sticky top-0 z-40 w-full px-4 sm:px-6 py-3 bg-[#0b1114]/95 border-b-2 border-[#26353d] backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <ShieldAlert size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-400">
                EL IMPOSTOR · MODO INDIVIDUAL
              </span>
              {room?.code && (
                <span className="px-2 py-0.5 bg-[#121c21] border border-[#283842] text-[10px] font-mono font-bold text-white">
                  PIN: {room.code}
                </span>
              )}
            </div>
            <h1 className="font-sans text-sm sm:text-base font-black uppercase tracking-wider text-white truncate max-w-md">
              {matchState.packTitle}
            </h1>
          </div>
        </div>

        {/* Center Individual Score & Round Status */}
        <div className="flex items-center gap-2 sm:gap-3">
          {!effectiveIsTeacher && (
            <div className="px-3.5 py-1.5 bg-[#121c21] border border-amber-500/40 flex items-center gap-2">
              <Trophy size={14} className="text-amber-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Tu Puntaje:
              </span>
              <span className="font-mono text-sm font-black text-amber-400">{myScore} pts</span>
            </div>
          )}

          <div className="px-3 py-1.5 bg-[#121c21] border border-[#283842] flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Ronda:
            </span>
            <span className="font-mono text-xs font-bold text-white">
              {matchState.currentRoundIndex + 1}/{matchState.rounds.length}
            </span>
          </div>

          {matchState.phase === 'debate' && roundSecondsLeft > 0 && (
            <div
              className={cn(
                'px-3 py-1.5 border flex items-center gap-1.5 font-mono text-xs font-black',
                roundSecondsLeft <= 10
                  ? 'bg-red-950 border-red-500 text-red-300 animate-pulse'
                  : 'bg-[#121c21] border-amber-500/50 text-amber-300'
              )}
            >
              <Clock size={14} />
              <span>{roundSecondsLeft}s</span>
            </div>
          )}
        </div>

        {/* Right Actions: Essential Match Controls Only (Fullscreen & Exit) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMatchFullscreen}
            className="px-3 py-1.5 bg-[#121c21] hover:bg-[#1a2830] border border-amber-500/40 text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Alternar pantalla completa"
          >
            <Maximize size={14} />
            <span className="hidden sm:inline">Pantalla Completa</span>
          </button>

          <button
            type="button"
            onClick={onGoHome}
            className="px-3 py-1.5 bg-[#1b0e12] hover:bg-red-950 border border-red-500/40 text-xs font-bold uppercase tracking-wider text-red-200 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Home size={14} />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* =====================================================================
          2. MAIN INVESTIGATION & VOTING STAGE
      ===================================================================== */}
      <main className="relative z-10 flex-1 min-h-0 max-w-6xl w-full mx-auto px-4 sm:px-6 py-4 space-y-4 overflow-y-auto">
        {matchState.phase === 'finished' ? (
          /* FINAL INDIVIDUAL SCOREBOARD SCREEN */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0b1114]/95 border-2 border-[#26353d] p-8 text-center max-w-2xl mx-auto space-y-6 shadow-2xl"
          >
            <div className="w-16 h-16 bg-amber-500/15 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
              <Award size={34} />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
                EXPEDIENTE CERRADO · RESULTADOS INDIVIDUALES
              </span>
              <h2 className="font-sans text-2xl sm:text-3xl font-black uppercase tracking-wider text-white mt-1">
                {individualRanking[0]
                  ? `¡Mejor Detective: ${individualRanking[0].name} (${individualRanking[0].score} pts)!`
                  : '¡Misión de Investigación Completada!'}
              </h2>
            </div>

            {/* Individual Ranking List */}
            <div className="max-w-md mx-auto space-y-2.5 text-left">
              {individualRanking.map((st, idx) => (
                <div
                  key={st.id}
                  className={cn(
                    'px-4 py-3 border flex items-center justify-between',
                    idx === 0
                      ? 'bg-amber-500/15 border-amber-500/50 text-white'
                      : 'bg-[#121c21] border-[#26353d] text-slate-200'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-black text-amber-400 w-5">
                      #{idx + 1}
                    </span>
                    <span className="text-lg">{st.avatar}</span>
                    <span className="font-bold text-sm">{st.name}</span>
                  </div>
                  <span className="font-mono text-base font-black text-amber-400">
                    {st.score} pts
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRestartMatch}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw size={15} />
                <span>Volver a Jugar</span>
              </button>

              <button
                type="button"
                onClick={() => setIsLibraryOpen(true)}
                className="px-5 py-2.5 bg-[#121c21] hover:bg-[#1a2830] text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer border border-[#283842]"
              >
                <Sparkles size={15} className="text-amber-400" />
                <span>Elegir Otro Tema o Crear con IA</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Round Banner */}
            <div className="bg-[#0b1114]/95 border-2 border-[#26353d] p-5 sm:p-6 shadow-xl relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#26353d] pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
                    <span>
                      RONDA {matchState.currentRoundIndex + 1} DE {matchState.rounds.length}
                    </span>
                    <span>·</span>
                    <span className="text-slate-300">{currentRound?.subject}</span>
                  </div>
                  <h2 className="font-sans text-xl sm:text-2xl font-black uppercase tracking-wider text-white mt-1">
                    {currentRound?.topicTitle}
                  </h2>
                </div>

                {!effectiveIsTeacher ? (
                  <div className="px-3.5 py-1.5 bg-[#121c21] border border-[#283842] text-xs text-slate-200 flex items-center gap-2 self-start md:self-center">
                    <span>🕵️ Investigación Individual</span>
                    <span className="text-amber-400 font-bold">
                      +{matchState.pointsPerHit || 100} pts por acierto
                    </span>
                  </div>
                ) : (
                  <div className="px-3.5 py-1.5 bg-[#121c21] border border-[#283842] text-xs text-slate-300 flex items-center gap-2 self-start md:self-center">
                    <span>👨‍🏫 Modo Docente (Moderador)</span>
                  </div>
                )}
              </div>

              <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                {currentRound?.prompt}
              </p>
            </div>

            {/* 4 SUSPECT STATEMENTS GRID (3 TRUTHS & 1 IMPOSTOR) */}
            <div className="grid sm:grid-cols-2 gap-4">
              {currentRound?.statements.map((stmt, idx) => {
                const isSelected = selectedStatementIdx === idx;
                const isRevealed = matchState.phase === 'revealed';
                const isRealImpostor = stmt.isImpostor;
                const votesForThis = votesList.filter((v) => v.statementIndex === idx);

                return (
                  <motion.div
                    key={stmt.id}
                    whileHover={matchState.phase === 'debate' ? { y: -2 } : undefined}
                    onClick={() => {
                      if (matchState.phase !== 'debate') return;
                      playBalatroSound('select');
                      setSelectedStatementIdx(idx);
                    }}
                    className={cn(
                      'relative p-5 border-2 transition-all flex flex-col justify-between cursor-pointer backdrop-blur-sm',
                      isRevealed && isRealImpostor
                        ? 'bg-red-950/60 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]'
                        : isRevealed && !isRealImpostor
                        ? 'bg-[#0b1114]/85 border-emerald-500/40 opacity-85'
                        : isSelected
                        ? 'bg-[#162229]/95 border-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.22)]'
                        : 'bg-[#0b1114]/92 border-[#26353d] hover:border-slate-500'
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <CrewmateSuspectIcon
                            color={stmt.crewColor}
                            isEjected={isRevealed && isRealImpostor}
                          />
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                              AFIRMACIÓN #{idx + 1}
                            </span>
                            <h3 className="font-sans text-base font-black uppercase tracking-wider text-white">
                              {stmt.label}
                            </h3>
                          </div>
                        </div>

                        {/* Status Badge */}
                        {isRevealed ? (
                          isRealImpostor ? (
                            <span className="px-3 py-1 bg-red-600 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                              <XCircle size={14} />
                              <span>ERA EL IMPOSTOR</span>
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-emerald-600/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                              <CheckCircle2 size={14} />
                              <span>VERDADERO</span>
                            </span>
                          )
                        ) : (
                          <span
                            className={cn(
                              'px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border',
                              isSelected
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-[#121c21] text-slate-400 border-[#283842]'
                            )}
                          >
                            {isSelected ? 'Sospechoso Elegido' : 'Seleccionar'}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-slate-100 leading-relaxed bg-[#121c21]/90 p-3.5 border border-[#26353d]">
                        “{stmt.text}”
                      </p>
                    </div>

                    {/* Live Individual Votes Badges on this Suspect */}
                    {votesForThis.length > 0 && (!matchState.hideLiveVotes || isRevealed) && (
                      <div className="mt-3 pt-2.5 border-t border-[#26353d] flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mr-1">
                          Votos ({votesForThis.length}):
                        </span>
                        {votesForThis.map((v) => (
                          <span
                            key={v.playerId}
                            className="px-2 py-0.5 bg-[#121c21] border border-[#283842] text-slate-200 text-[10px] font-bold"
                          >
                            {v.playerName}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* =================================================================
                3. DIRECT INDIVIDUAL EJECTION VOTE BAR (NO JUSTIFICATION)
            ================================================================= */}
            {matchState.phase === 'debate' ? (
              <form
                onSubmit={handleCastVote}
                className="bg-[#0b1114]/95 border-2 border-[#26353d] p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#121c21] border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <Vote size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-white">
                      {selectedStatement
                        ? `Sospechoso seleccionado: ${selectedStatement.label}`
                        : 'Selecciona una de las 4 afirmaciones de arriba para votar su expulsión'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Votos registrados en la sala: <strong className="text-amber-300">{votesList.length}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {!effectiveIsTeacher && (
                    <button
                      type="submit"
                      disabled={selectedStatementIdx === null}
                      className="px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg"
                    >
                      <Vote size={16} />
                      <span>
                        {myExistingVote
                          ? 'Actualizar Voto de Expulsión'
                          : 'Votar para Expulsar Impostor'}
                      </span>
                    </button>
                  )}

                  {/* Teacher / Host Reveal Button */}
                  {(effectiveIsTeacher || isSoloPractice || isHost) && (
                    <button
                      type="button"
                      onClick={handleRevealImpostor}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <ShieldAlert size={16} />
                      <span>Revelar Impostor y Veredicto</span>
                    </button>
                  )}
                </div>
              </form>
            ) : (
              /* EJECTION REVEAL & PEDAGOGICAL EXPLANATION BANNER */
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#0b1114]/95 border-2 border-amber-500/70 p-6 space-y-4 shadow-2xl"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
                      VEREDICTO DE EXPULSIÓN · EXPLICACIÓN DIDÁCTICA
                    </span>
                    <h3 className="font-sans text-xl font-black uppercase tracking-wider text-white">
                      Impostor Real: {currentRound?.statements[realImpostorIndex]?.label}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextRound}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer self-start sm:self-center shrink-0"
                  >
                    <span>
                      {matchState.currentRoundIndex + 1 < matchState.rounds.length
                        ? 'Siguiente Ronda'
                        : 'Ver Resultados Finales'}
                    </span>
                    <ArrowRight size={16} />
                  </button>
                </div>

                <p className="text-sm text-slate-100 leading-relaxed bg-[#121c21] p-4 border border-[#26353d]">
                  {currentRound?.impostorExplanation}
                </p>
              </motion.div>
            )}

            {/* Connected Students Roster */}
            {!isSoloPractice && (
              <div className="bg-[#0b1114]/90 border border-[#26353d] p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-amber-400" />
                  <span>
                    Detectives conectados: <strong className="text-white">{studentPlayers.length}</strong>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {studentPlayers.map((st) => {
                    const stScore = matchState.playerScores?.[st.id] || 0;
                    return (
                      <span
                        key={st.id}
                        className="px-2.5 py-1 bg-[#121c21] border border-[#283842] text-slate-200 flex items-center gap-1.5"
                      >
                        <span>{st.avatar}</span>
                        <span>{st.name}</span>
                        <span className="font-mono text-[10px] text-amber-300 font-bold">
                          {stScore} pts
                        </span>
                        {matchState.votes?.[st.id] && (
                          <span className="text-[10px] text-amber-400 font-bold">✓ Votó</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <ImpostorLibraryModal
        isOpen={isLibraryOpen}
        defaultAuthorName={room?.teacherName || localStorage.getItem('po_player_name') || 'Docente'}
        onClose={() => setIsLibraryOpen(false)}
        onSelectPack={(pack) => {
          setIsLibraryOpen(false);
          handleSelectPackFromLibrary(pack);
        }}
      />

      {isQrOpen && room?.code && (
        <QRCodeModal roomCode={room.code} onClose={() => setIsQrOpen(false)} />
      )}
    </div>
  );
};
