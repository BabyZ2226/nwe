import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  LogOut,
  Globe,
  Trophy,
  RotateCcw,
  ArrowRight,
  Send,
  XCircle,
  Eye,
  ArrowLeftRight,
  ArrowLeft,
  Settings,
  Shuffle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  GamePlayer,
  RoomState,
  LatinoGamePack,
  LatinosMatchState,
} from '../types';
import {
  SEED_LATINOS_LIBRARY,
  createInitialLatinosMatchState,
  submitTeamGuess,
  revealAnswerSlotByHost,
  advanceToNextRound,
  handleTurnTimeout,
} from '../lib/cienLatinosEngine';
import { saveMatchRecord } from '../lib/matchHistory';
import { playBalatroSound, isSfxMuted, setSfxMuted } from '../lib/soundEffects';
import { socketClient } from '../lib/socketClient';
import { MatchStartCountdown } from './MatchStartCountdown';
import { LatinosLibraryModal } from './LatinosLibraryModal';
import { MatchHistoryModal } from './MatchHistoryModal';
import { TeacherSpectatorDashboard } from './TeacherSpectatorDashboard';
import { HeatGuardianLobbyShell, HeatGuardianAtmosphere, HeatGuardianMenuItem } from './HeatGuardianBackdrop';
import { cn } from '../lib/utils';

interface CienLatinosGameProps {
  players: GamePlayer[];
  currentUserId: string;
  isTeacherSpectator?: boolean;
  isSoloPractice?: boolean;
  room?: RoomState | null;
  initialPack?: LatinoGamePack | null;
  onGoHome: () => void;
}

export const CienLatinosGame: React.FC<CienLatinosGameProps> = ({
  players,
  currentUserId,
  isTeacherSpectator = false,
  isSoloPractice = false,
  room = null,
  initialPack = null,
  onGoHome,
}) => {
  const [selectedPack, setSelectedPack] = useState<LatinoGamePack>(
    () => initialPack || SEED_LATINOS_LIBRARY[0]
  );

  const [matchState, setMatchState] = useState<LatinosMatchState>(() =>
    room?.latinosState || createInitialLatinosMatchState(initialPack || SEED_LATINOS_LIBRARY[0])
  );

  const [gamePhase, setGamePhase] = useState<'lobby' | 'playing'>('lobby');
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isMatchHistoryOpen, setIsMatchHistoryOpen] = useState(false);

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

  // Configurable turn timer & teacher match settings
  const [turnDurationConfig, setTurnDurationConfig] = useState<number>(15); // 0 = Sin límite
  const [maxStrikesConfig, setMaxStrikesConfig] = useState<number>(3); // 1, 2, 3, 4
  const [maxRoundsConfig, setMaxRoundsConfig] = useState<number>(0); // 0 = Todas
  const [finalMultiplierConfig, setFinalMultiplierConfig] = useState<1 | 2 | 3>(2);
  const [allowStealConfig, setAllowStealConfig] = useState<boolean>(true);
  const [shuffleRoundsConfig, setShuffleRoundsConfig] = useState<boolean>(false);
  const [startingTeamConfig, setStartingTeamConfig] = useState<'A' | 'B' | 'random'>('A');
  const [allowBoardWithoutDevices, setAllowBoardWithoutDevices] = useState<boolean>(true);
  const [isTeacherSettingsOpen, setIsTeacherSettingsOpen] = useState<boolean>(false);

  const [turnSecondsRemaining, setTurnSecondsRemaining] = useState<number>(15);

  // Team names & player assignments
  const [teamAName, setTeamAName] = useState('Equipo Sol ☀️');
  const [teamBName, setTeamBName] = useState('Equipo Rayo ⚡');
  const [localPlayerTeams, setLocalPlayerTeams] = useState<Record<string, 'A' | 'B'>>({});

  // In-game guess input & strike popup animation
  const [guessInput, setGuessInput] = useState('');
  const [strikeOverlayCount, setStrikeOverlayCount] = useState<number | null>(null);

  // Lobby UI controls
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(isSfxMuted());
  const [currentTheme, setCurrentTheme] = useState<'neon' | 'dungeon' | 'cyber'>('neon');
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  const isHost = room ? room.hostId === currentUserId : true;
  const effectiveIsTeacher = Boolean(
    isTeacherSpectator ||
    (room && room.hostIsSpectator && room.hostId === currentUserId) ||
    (typeof window !== 'undefined' && localStorage.getItem('po_user_role') === 'teacher')
  );
  const roomCode = room?.code || (isSoloPractice ? 'EQUIPOS' : '100500');
  const activePlayerTeams = room?.playerTeams || localPlayerTeams;
  const myTeam: 'A' | 'B' = effectiveIsTeacher ? 'A' : (activePlayerTeams[currentUserId] || 'A');
  const prevStrikesRef = useRef<number>(0);

  const syncMatchState = useCallback(
    (nextState: LatinosMatchState) => {
      if (nextState.strikes > prevStrikesRef.current && nextState.strikes > 0) {
        setStrikeOverlayCount(nextState.strikes);
        playBalatroSound('hover');
        setTimeout(() => setStrikeOverlayCount(null), 1100);
      } else if (nextState.lastGuessFeedback?.isCorrect) {
        playBalatroSound('play');
      }
      prevStrikesRef.current = nextState.strikes;
      setMatchState(nextState);
      if (room) {
        socketClient.updateLatinosState(nextState);
      }
    },
    [room]
  );

  const activeTurnDuration = matchState.turnDurationSeconds ?? turnDurationConfig;
  const activeMaxStrikes = matchState.maxStrikes ?? maxStrikesConfig;

  // Reset turn timer whenever active team, round, or revealed answers change
  useEffect(() => {
    if (activeTurnDuration > 0) {
      setTurnSecondsRemaining(activeTurnDuration);
    }
  }, [matchState.activeTeam, matchState.currentRoundIndex, matchState.revealedIndices.length, matchState.strikes, gamePhase, activeTurnDuration]);

  // Turn Countdown Timer Effect (respects Sin Límite = 0)
  useEffect(() => {
    if (
      gamePhase !== 'playing' ||
      isCountdownActive ||
      matchState.roundFinished ||
      matchState.matchFinished ||
      activeTurnDuration <= 0
    ) {
      return;
    }

    const timer = setInterval(() => {
      setTurnSecondsRemaining((prev) => {
        if (prev <= 1) {
          playBalatroSound('hover');
          const updated = handleTurnTimeout(matchState);
          syncMatchState(updated);
          return activeTurnDuration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gamePhase, isCountdownActive, matchState, syncMatchState, activeTurnDuration]);

  // Auto-provision a live room if mounting in classroom multiplayer mode without one
  useEffect(() => {
    if (!room && !isSoloPractice) {
      const pName = localStorage.getItem('po_player_name') || (isTeacherSpectator ? 'Profesor' : 'Estudiante');
      const pAvatar = localStorage.getItem('po_player_avatar') || (isTeacherSpectator ? '👨‍🏫' : '🧑‍🎓');
      socketClient.createRoom(pName, pAvatar, 0, 20, '100 Latinos Dicen en Clase', isTeacherSpectator, 'cien_latinos');
    }
  }, [room, isTeacherSpectator, isSoloPractice]);

  // If initialPack prop changes, update selected pack
  useEffect(() => {
    if (initialPack) {
      setSelectedPack(initialPack);
      const next = createInitialLatinosMatchState(initialPack, teamAName, teamBName);
      setMatchState(next);
      if (room && isHost) {
        socketClient.updateLatinosState(next);
      }
    }
  }, [initialPack]);

  // Sync multiplayer room state changes
  useEffect(() => {
    if (room?.latinosState) {
      // Trigger giant red X overlay if strikes increased
      if (
        room.latinosState.strikes > prevStrikesRef.current &&
        room.latinosState.strikes > 0
      ) {
        setStrikeOverlayCount(room.latinosState.strikes);
        playBalatroSound('hover');
        setTimeout(() => setStrikeOverlayCount(null), 1100);
      }
      prevStrikesRef.current = room.latinosState.strikes;
      setMatchState(room.latinosState);
      setTeamAName(room.latinosState.teamAName);
      setTeamBName(room.latinosState.teamBName);
    }
  }, [room?.latinosState]);

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

  // Fire confetti and save match history when match finishes
  useEffect(() => {
    if (matchState.matchFinished) {
      playBalatroSound('play');
      confetti({ particleCount: 160, spread: 100, origin: { y: 0.6 } });

      // Calculate total possible points across all rounds
      const totalPossiblePoints = matchState.rounds.reduce(
        (sum, r) => sum + r.answers.reduce((acc, a) => acc + a.points, 0),
        0
      ) || 400;

      const teamAScore = matchState.teamAScore;
      const teamBScore = matchState.teamBScore;
      const isTeamAWinner = teamAScore >= teamBScore;

      // Coherent academic grades on standard 0-100 scale:
      // Winning team achieves 85-100 depending on round mastery
      const gradeA = isTeamAWinner
        ? Math.min(100, Math.max(85, Math.round(80 + (teamAScore / totalPossiblePoints) * 20)))
        : Math.min(85, Math.max(65, Math.round(65 + (teamAScore / totalPossiblePoints) * 25)));

      const gradeB = !isTeamAWinner
        ? Math.min(100, Math.max(85, Math.round(80 + (teamBScore / totalPossiblePoints) * 20)))
        : Math.min(85, Math.max(65, Math.round(65 + (teamBScore / totalPossiblePoints) * 25)));

      const winningTeamName =
        teamAScore > teamBScore
          ? matchState.teamAName
          : teamBScore > teamAScore
          ? matchState.teamBName
          : 'Empate Técnico';

      // Current player's personal grade
      const myTeamGrade = myTeam === 'A' ? gradeA : gradeB;
      const myTeamScore = myTeam === 'A' ? teamAScore : teamBScore;
      const userWon = isTeamAWinner ? myTeam === 'A' : myTeam === 'B';

      // Build student results roster for teacher analysis
      const studentResultsList = uniquePlayers.map((p) => {
        const pTeam = activePlayerTeams[p.id] || 'A';
        const pGrade = pTeam === 'A' ? gradeA : gradeB;
        const pScore = pTeam === 'A' ? teamAScore : teamBScore;
        const pWon = isTeamAWinner ? pTeam === 'A' : pTeam === 'B';
        const teamLabel = pTeam === 'A' ? matchState.teamAName : matchState.teamBName;
        return {
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          grade: pGrade,
          score: pScore,
          escapedOrWon: pWon,
          details: `${teamLabel} · ${pWon ? 'Victoria' : 'Participación'} (${pScore} pts)`,
        };
      });

      saveMatchRecord({
        gameType: 'cien_latinos',
        gameTitle: `100 Latinos Dicen: ${matchState.packTitle}`,
        role: isTeacherSpectator ? 'teacher' : 'student',
        playerName: localStorage.getItem('po_player_name') || (isTeacherSpectator ? 'Profesor' : 'Estudiante'),
        playerAvatar: localStorage.getItem('po_player_avatar') || (isTeacherSpectator ? '👨‍🏫' : '🧑‍🎓'),
        grade: isTeacherSpectator ? Math.round((gradeA + gradeB) / 2) : myTeamGrade,
        score: isTeacherSpectator ? Math.max(teamAScore, teamBScore) : myTeamScore,
        maxScore: 1000,
        isVictory: userWon,
        statusText: `¡Victoria de ${winningTeamName}!`,
        detailsText: `${matchState.teamAName} (${teamAScore} pts) vs ${matchState.teamBName} (${teamBScore} pts) · ${matchState.rounds.length} Rondas.`,
        roomCode: roomCode,
        studentResults: studentResultsList,
      });
    }
  }, [matchState.matchFinished]);



  const buildConfiguredMatchState = useCallback(
    (packToUse: LatinoGamePack) => {
      const startTeam: 'A' | 'B' =
        startingTeamConfig === 'random'
          ? Math.random() < 0.5
            ? 'A'
            : 'B'
          : startingTeamConfig;
      return createInitialLatinosMatchState(packToUse, teamAName, teamBName, {
        maxStrikes: maxStrikesConfig,
        turnDurationSeconds: turnDurationConfig,
        allowSteal: allowStealConfig,
        finalMultiplier: finalMultiplierConfig,
        maxRounds: maxRoundsConfig > 0 ? maxRoundsConfig : undefined,
        shuffleRounds: shuffleRoundsConfig,
        startingTeam: startTeam,
      });
    },
    [
      teamAName,
      teamBName,
      maxStrikesConfig,
      turnDurationConfig,
      allowStealConfig,
      finalMultiplierConfig,
      maxRoundsConfig,
      shuffleRoundsConfig,
      startingTeamConfig,
    ]
  );

  const handleSelectPackFromLibrary = (pack: LatinoGamePack) => {
    setSelectedPack(pack);
    const fresh = buildConfiguredMatchState(pack);
    prevStrikesRef.current = 0;
    setMatchState(fresh);
    if (room && isHost) {
      socketClient.updateLatinosState(fresh);
    }
  };

  const handleStartMatchFromLobby = () => {
    const fresh = buildConfiguredMatchState(selectedPack);
    prevStrikesRef.current = 0;
    setMatchState(fresh);
    if (room) {
      socketClient.updateLatinosState(fresh);
      socketClient.startGame();
    }
    setIsCountdownActive(true);
    setGamePhase('playing');
  };

  const handleRandomBalanceTeams = () => {
    playBalatroSound('deal');
    const shuffled = [...uniquePlayers].sort(() => Math.random() - 0.5);
    const nextTeams: Record<string, 'A' | 'B'> = {};
    shuffled.forEach((p, idx) => {
      const t: 'A' | 'B' = idx % 2 === 0 ? 'A' : 'B';
      nextTeams[p.id] = t;
      if (room) {
        socketClient.switchLatinosTeam(p.id, t);
      }
    });
    setLocalPlayerTeams(nextTeams);
  };

  const handleReturnToLobby = () => {
    setIsCountdownActive(false);
    setGamePhase('lobby');
    if (room) {
      socketClient.returnToLobby();
    }
    playBalatroSound('click');
  };

  const handleSwitchPlayerTeam = (playerId: string, team: 'A' | 'B') => {
    playBalatroSound('select');
    if (room) {
      socketClient.switchLatinosTeam(playerId, team);
    } else {
      setLocalPlayerTeams((prev) => ({ ...prev, [playerId]: team }));
    }
  };

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessInput.trim() || matchState.roundFinished || matchState.matchFinished) return;

    // Disallow submission if it is not this player's team turn
    const isMyTeamTurn = isSoloPractice || (isHost && !effectiveIsTeacher) || myTeam === matchState.activeTeam;
    if (!isMyTeamTurn) return;

    const clean = guessInput.trim();
    setGuessInput('');

    const playerName = localStorage.getItem('po_player_name') || 'Equipo';
    if (room && !isHost) {
      socketClient.submitLatinosGuess(clean, playerName, myTeam);
      return;
    }

    const updated = submitTeamGuess(matchState, clean, playerName);
    syncMatchState(updated);
  };

  const handleHostRevealSlot = (slotIdx: number) => {
    if (!isHost && !isSoloPractice) return;
    const awardPoints = !matchState.roundFinished;
    const updated = revealAnswerSlotByHost(matchState, slotIdx, awardPoints);
    syncMatchState(updated);
  };

  const handleHostManualStrike = () => {
    if (!isHost && !isSoloPractice) return;
    if (matchState.roundFinished) return;
    const updated = submitTeamGuess(matchState, '__RESPUESTA_INCORRECTA_MANUAL__', 'Tablero');
    syncMatchState(updated);
  };

  const handleHostSwitchTurn = () => {
    if (!isHost && !isSoloPractice) return;
    playBalatroSound('select');
    const nextTeam: 'A' | 'B' = matchState.activeTeam === 'A' ? 'B' : 'A';
    syncMatchState({
      ...matchState,
      activeTeam: nextTeam,
    });
  };

  const handleNextRound = () => {
    playBalatroSound('play');
    prevStrikesRef.current = 0;
    const updated = advanceToNextRound(matchState);
    syncMatchState(updated);
  };

  const handleRevealAllRemainingForReview = () => {
    const currentRound = matchState.rounds[matchState.currentRoundIndex];
    if (!currentRound) return;
    playBalatroSound('select');
    const allIndices = currentRound.answers.map((_, i) => i);
    syncMatchState({
      ...matchState,
      revealedIndices: allIndices,
      roundFinished: true,
    });
  };

  const uniquePlayers = useMemo(() => {
    const list = room?.players || players;
    const seen = new Set<string>();
    return list.filter((p) => {
      if (p.isBot) return false;
      if (
        p.isSpectator ||
        p.role === 'teacher' ||
        p.name.toLowerCase().includes('profesor') ||
        p.name.toLowerCase().includes('docente') ||
        (effectiveIsTeacher && (p.id === room?.hostId || p.id === currentUserId || p.id === 'hero-player'))
      ) {
        return false;
      }
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [room?.players, players, effectiveIsTeacher, room?.hostId, currentUserId]);

  const teamAPlayers = useMemo(
    () => uniquePlayers.filter((p) => (activePlayerTeams[p.id] || 'A') === 'A'),
    [uniquePlayers, activePlayerTeams]
  );
  const teamBPlayers = useMemo(
    () => uniquePlayers.filter((p) => activePlayerTeams[p.id] === 'B'),
    [uniquePlayers, activePlayerTeams]
  );

  const hostDisplay = typeof window !== 'undefined' ? window.location.host : 'aulaplay.edu';
  const joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${roomCode}&game=cien_latinos`
      : `https://aulaplay.edu?room=${roomCode}&game=cien_latinos`;

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

  // ============================================================================
  // A. UNIFIED LOBBY VIEW (HEAT GUARDIAN MONOLITH & SNOWY EXPEDITION STYLE)
  // ============================================================================
  if (gamePhase === 'lobby') {
    const hasBothTeams = teamAPlayers.length >= 1 && teamBPlayers.length >= 1;
    const canStartMatch = hasBothTeams || allowBoardWithoutDevices || isSoloPractice;

    const menuItems: HeatGuardianMenuItem[] = [
      ...(isHost || effectiveIsTeacher || isSoloPractice
        ? [
            {
              id: 'play',
              label: 'JUGAR',
              isPrimary: true,
              disabled: !canStartMatch,
              onClick: handleStartMatchFromLobby,
            },
            {
              id: 'settings',
              label: 'AJUSTES',
              badge: `${turnDurationConfig > 0 ? `${turnDurationConfig}S` : 'LIBRE'}`,
              onClick: () => setIsTeacherSettingsOpen(true),
            },
          ]
        : []),
      {
        id: 'library',
        label: 'BIBLIOTECA',
        badge: `${SEED_LATINOS_LIBRARY.length}+`,
        onClick: () => setIsLibraryOpen(true),
      },
      {
        id: 'qr',
        label: 'CÓDIGO QR',
        onClick: () => setIsQrModalOpen(true),
      },
      {
        id: 'exit',
        label: 'SALIR',
        isDanger: true,
        onClick: onGoHome,
      },
    ];

    return (
      <HeatGuardianLobbyShell
        titleLine1="100 LATINOS"
        titleLine2="DICEN"
        subtitleBadge="DUELO POR EQUIPOS"
        roomCode={roomCode}
        menuItems={menuItems}
        soundMuted={soundMuted}
        onToggleSound={toggleSound}
        onToggleFullscreen={toggleFullscreen}
        variant="golden_ember"
        footerCredit={matchState.packTitle}
      >
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
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

            {/* Direct QR */}
            <div
              onClick={() => setIsQrModalOpen(true)}
              className="w-24 h-24 bg-white p-2 shadow-lg cursor-pointer hover:scale-105 transition-transform flex items-center justify-center shrink-0"
              title="Clic para agrandar QR"
            >
              <QRCodeSVG value={joinUrl} size={84} level="M" includeMargin={false} />
            </div>
          </div>

          {/* Active Community Pack Bar */}
          <div className="bg-[#121c21]/95 border border-[#223038] px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                {matchState.rounds[0]?.subject || selectedPack.subject} · {matchState.rounds.length} RONDAS
              </div>
              <h3 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wide text-white truncate mt-0.5">
                {matchState.packTitle}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => {
                playBalatroSound('click');
                setIsLibraryOpen(true);
              }}
              className="px-3 py-1.5 bg-[#17262e] hover:bg-[#20343f] border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
            >
              <Globe size={13} />
              <span>Biblioteca</span>
            </button>
          </div>

          {/* Two Teams Configuration (Equipo A vs Equipo B) */}
          <div className="grid sm:grid-cols-2 gap-3">
            {/* Team A Box */}
            <div className="bg-[#121c21]/95 border border-amber-500/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={teamAName}
                  onChange={(e) => setTeamAName(e.target.value)}
                  className="bg-transparent font-sans text-sm font-black uppercase tracking-wider text-amber-300 focus:outline-none border-b border-transparent focus:border-amber-400"
                />
                {!effectiveIsTeacher && (
                  <button
                    type="button"
                    onClick={() => handleSwitchPlayerTeam(currentUserId, 'A')}
                    className={cn(
                      'px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider cursor-pointer',
                      myTeam === 'A'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-[#1a272e] text-slate-300 hover:bg-[#243640]'
                    )}
                  >
                    {myTeam === 'A' ? '✓ En este equipo' : 'Unirme al Equipo A'}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {teamAPlayers.length === 0 ? (
                  <span className="text-[11px] text-slate-400 font-mono">
                    Listo para estudiantes del Equipo A
                  </span>
                ) : (
                  teamAPlayers.map((p) => (
                    <span
                      key={p.id}
                      className="px-2 py-0.5 bg-amber-500/15 border border-amber-400/30 text-xs text-amber-200 font-bold"
                    >
                      {p.avatar} {p.name}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Team B Box */}
            <div className="bg-[#121c21]/95 border border-sky-500/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={teamBName}
                  onChange={(e) => setTeamBName(e.target.value)}
                  className="bg-transparent font-sans text-sm font-black uppercase tracking-wider text-sky-300 focus:outline-none border-b border-transparent focus:border-sky-400"
                />
                {!effectiveIsTeacher && (
                  <button
                    type="button"
                    onClick={() => handleSwitchPlayerTeam(currentUserId, 'B')}
                    className={cn(
                      'px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider cursor-pointer',
                      myTeam === 'B'
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-[#1a272e] text-slate-300 hover:bg-[#243640]'
                    )}
                  >
                    {myTeam === 'B' ? '✓ En este equipo' : 'Unirme al Equipo B'}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {teamBPlayers.length === 0 ? (
                  <span className="text-[11px] text-slate-400 font-mono">
                    Listo para estudiantes del Equipo B
                  </span>
                ) : (
                  teamBPlayers.map((p) => (
                    <span
                      key={p.id}
                      className="px-2 py-0.5 bg-sky-500/15 border border-sky-400/30 text-xs text-sky-200 font-bold"
                    >
                      {p.avatar} {p.name}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Bottom Row: Teacher Pre-Game Settings + Start Match */}
          <div className="pt-3 border-t border-[#26353d] flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {(isHost || effectiveIsTeacher || isSoloPractice) && (
                <button
                  type="button"
                  onClick={() => {
                    playBalatroSound('click');
                    setIsTeacherSettingsOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#17262e] hover:bg-[#20343f] border border-slate-600/60 text-slate-200 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  <Settings size={13} className="text-amber-400" />
                  <span>Ajustes · {turnDurationConfig > 0 ? `${turnDurationConfig}s` : 'Manual'} · {maxStrikesConfig}X</span>
                </button>
              )}

              {uniquePlayers.length >= 2 && (isHost || effectiveIsTeacher) && (
                <button
                  type="button"
                  onClick={handleRandomBalanceTeams}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#17262e] hover:bg-[#20343f] border border-sky-500/40 text-sky-300 text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
                  title="Repartir estudiantes entre Equipo A y Equipo B"
                >
                  <Shuffle size={13} />
                  <span>Equilibrar</span>
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={!canStartMatch}
              onClick={handleStartMatchFromLobby}
              className={cn(
                'w-full sm:w-auto px-6 py-2.5 font-black text-xs sm:text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2',
                canStartMatch
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-md'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 opacity-60 cursor-not-allowed'
              )}
            >
              <Play size={16} fill="currentColor" />
              <span>Iniciar Partida ▶</span>
            </button>
          </div>
        </motion.div>

        {/* Teacher Pre-Game Configuration Modal for 100 Latinos Dicen */}
        <AnimatePresence>
          {isTeacherSettingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#0b1114] border border-amber-500/60 p-5 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl text-xs font-sans text-slate-200 max-h-[90dvh] overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Settings size={18} className="text-amber-400" />
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wide">
                        Ajustes del Docente
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Reglas, tiempos y rondas para la partida
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTeacherSettingsOpen(false)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  {/* 1. Tiempo por Turno */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                      Tiempo por Turno:
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { val: 10, label: '10s' },
                        { val: 15, label: '15s' },
                        { val: 20, label: '20s' },
                        { val: 30, label: '30s' },
                        { val: 0, label: 'Manual' },
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => {
                            playBalatroSound('select');
                            setTurnDurationConfig(opt.val);
                          }}
                          className={cn(
                            'p-2 rounded-xl border text-[11px] font-bold cursor-pointer transition-all text-center',
                            turnDurationConfig === opt.val
                              ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                              : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-amber-500/50'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Límite de Strikes */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                      Límite de Strikes:
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { val: 1, label: '1 Strike' },
                        { val: 2, label: '2 Strikes' },
                        { val: 3, label: '3 Strikes' },
                        { val: 4, label: '4 Strikes' },
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => {
                            playBalatroSound('select');
                            setMaxStrikesConfig(opt.val);
                          }}
                          className={cn(
                            'p-2 rounded-xl border text-[11px] font-bold cursor-pointer transition-all text-center',
                            maxStrikesConfig === opt.val
                              ? 'bg-red-600 text-white border-red-300 shadow'
                              : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-red-500/50'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Cantidad de Rondas y Multiplicador Final */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                        Rondas a Jugar:
                      </label>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { val: 0, label: `Todas (${selectedPack.rounds.length})` },
                          { val: 1, label: '1' },
                          { val: 2, label: '2' },
                          { val: 3, label: '3' },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => {
                              playBalatroSound('select');
                              setMaxRoundsConfig(opt.val);
                            }}
                            className={cn(
                              'p-2 rounded-xl border text-[10px] font-bold cursor-pointer transition-all',
                              maxRoundsConfig === opt.val
                                ? 'bg-sky-500 text-slate-950 border-sky-300'
                                : 'bg-zinc-900 border-zinc-700 text-zinc-300'
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                        Multiplicador Final:
                      </label>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { val: 1 as const, label: 'x1 Normal' },
                          { val: 2 as const, label: 'x2 Doble' },
                          { val: 3 as const, label: 'x3 Triple' },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => {
                              playBalatroSound('select');
                              setFinalMultiplierConfig(opt.val);
                            }}
                            className={cn(
                              'p-2 rounded-xl border text-[11px] font-bold cursor-pointer transition-all',
                              finalMultiplierConfig === opt.val
                                ? 'bg-fuchsia-600 text-white border-fuchsia-300'
                                : 'bg-zinc-900 border-zinc-700 text-zinc-300'
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 5. Robo de Puntos y Orden de Preguntas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white block">⚡ Robo de Puntos</span>
                        <span className="text-[10px] text-zinc-400">
                          El otro equipo puede robar el pozo tras los strikes
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          playBalatroSound('select');
                          setAllowStealConfig((v) => !v);
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-xl font-bold text-[11px] cursor-pointer transition-all',
                          allowStealConfig
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-zinc-800 text-zinc-400'
                        )}
                      >
                        {allowStealConfig ? 'Activado' : 'Sin Robo'}
                      </button>
                    </div>

                    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white block">🔀 Barajar Preguntas</span>
                        <span className="text-[10px] text-zinc-400">
                          Orden aleatorio de las rondas del pack
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          playBalatroSound('select');
                          setShuffleRoundsConfig((v) => !v);
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-xl font-bold text-[11px] cursor-pointer transition-all',
                          shuffleRoundsConfig
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-zinc-800 text-zinc-400'
                        )}
                      >
                        {shuffleRoundsConfig ? 'Aleatorio' : 'Orden Fijo'}
                      </button>
                    </div>
                  </div>

                  {/* 6. Equipo Inicial y Modo Pizarra */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block mb-1.5">
                        🎤 Equipo que Inicia:
                      </label>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { val: 'A' as const, label: 'Equipo A' },
                          { val: 'B' as const, label: 'Equipo B' },
                          { val: 'random' as const, label: 'Sorteo 🎲' },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => {
                              playBalatroSound('select');
                              setStartingTeamConfig(opt.val);
                            }}
                            className={cn(
                              'p-2 rounded-xl border text-[11px] font-bold cursor-pointer transition-all',
                              startingTeamConfig === opt.val
                                ? 'bg-amber-500 text-slate-950 border-amber-300'
                                : 'bg-zinc-900 border-zinc-700 text-zinc-300'
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white block">🖥️ Modo Pizarra Libre</span>
                        <span className="text-[10px] text-zinc-400">
                          Iniciar sin exigir móviles conectados
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          playBalatroSound('select');
                          setAllowBoardWithoutDevices((v) => !v);
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-xl font-bold text-[11px] cursor-pointer transition-all',
                          allowBoardWithoutDevices
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-zinc-800 text-zinc-400'
                        )}
                      >
                        {allowBoardWithoutDevices ? 'Sí' : 'Exigir PIN'}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    playBalatroSound('play');
                    const updated = buildConfiguredMatchState(selectedPack);
                    setMatchState(updated);
                    if (room && isHost) {
                      socketClient.updateLatinosState(updated);
                    }
                    setIsTeacherSettingsOpen(false);
                  }}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs rounded-xl cursor-pointer shadow-lg uppercase tracking-wider"
                >
                  Guardar y Aplicar Configuraciones
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* QR Modal */}
        <AnimatePresence>
          {isQrModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                className="bg-[#0b1114] border-2 border-amber-500 p-6 max-w-sm w-full text-center space-y-4 shadow-2xl"
              >
                <h3 className="font-sans text-lg font-black uppercase tracking-widest text-amber-400">
                  Código QR · 100 Latinos Dicen
                </h3>
                <div className="w-56 h-56 bg-white p-3 mx-auto shadow-2xl flex items-center justify-center">
                  <QRCodeSVG value={joinUrl} size={200} level="H" includeMargin={false} />
                </div>
                <div className="bg-[#121c21] p-3 border border-amber-500/30 text-center font-mono">
                  <span className="text-[11px] text-slate-400 block uppercase">PIN de la sala:</span>
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

        {/* Infinite Library Modal */}
        <LatinosLibraryModal
          isOpen={isLibraryOpen}
          onClose={() => setIsLibraryOpen(false)}
          selectedPackId={selectedPack.id}
          onSelectPack={handleSelectPackFromLibrary}
          defaultAuthorName={localStorage.getItem('po_player_name') || 'Docente AulaPlay'}
        />
      </HeatGuardianLobbyShell>
    );
  }

  // ============================================================================
  // B. ACTIVE TV GAME SHOW BOARD ("100 LATINOS DICEN" - HEAT GUARDIAN STYLE)
  // ============================================================================
  const currentRound = matchState.rounds[matchState.currentRoundIndex] || matchState.rounds[0];
  const multiplier = currentRound?.multiplier || (matchState.currentRoundIndex >= 2 ? 2 : 1);

  const renderTvBoard = (isSpectatorMode: boolean) => {
    const isMyTeamTurn = isSoloPractice || (isHost && !isSpectatorMode) || myTeam === matchState.activeTeam;

    return (
      <div
        className={cn(
          'flex flex-col justify-between bg-[#0b1114] text-slate-100 font-sans select-none overflow-y-auto',
          isSpectatorMode
            ? 'w-full min-h-full p-2 sm:p-3 relative'
            : 'fixed inset-0 z-50 w-screen min-h-screen p-2 sm:p-3.5 overflow-y-auto'
        )}
      >
        <HeatGuardianAtmosphere variant="golden_ember" showGuardianScene={false} sceneOpacity={0.45} />

        {/* Fluid 3-2-1 Countdown Overlay */}
        {!isSpectatorMode && isCountdownActive && (
          <MatchStartCountdown
            onComplete={() => setIsCountdownActive(false)}
            subtitle="¡100 LATINOS DICEN · DUELO POR EQUIPOS!"
          />
        )}

        {/* Giant Red ❌ Strike Overlay */}
        <AnimatePresence>
          {strikeOverlayCount !== null && (
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.3, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[105] pointer-events-none flex items-center justify-center bg-red-950/40 backdrop-blur-[2px]"
            >
              <div className="flex items-center gap-4">
                {Array.from({ length: strikeOverlayCount }).map((_, idx) => (
                  <div
                    key={idx}
                    className="w-28 h-28 sm:w-40 sm:h-40 bg-red-600 border-8 border-white shadow-[0_0_60px_rgba(239,68,68,1)] flex items-center justify-center text-white font-black text-7xl sm:text-8xl"
                  >
                    ✕
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 1. Top Studio Header (Heat Guardian Dark Monolith Bar) */}
        <header className="relative z-10 w-full flex flex-wrap items-center justify-between gap-2 bg-[#0b1114]/95 border-2 border-[#26353d] px-3.5 py-2.5 shadow-2xl shrink-0">
          <div className="flex items-center gap-2.5">
            {!isSpectatorMode && (
              <button
                type="button"
                onClick={handleReturnToLobby}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#142026] hover:bg-[#1e3038] border border-slate-600/60 text-xs font-bold uppercase tracking-wider text-slate-200 cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Lobby</span>
              </button>
            )}

          <div className="flex items-center gap-2">
            <span className="text-lg">🎤</span>
            <div>
              <span className="font-sans text-xs sm:text-sm font-black text-amber-300 block leading-none">
                {matchState.packTitle}
              </span>
              <span className="text-[11px] font-mono text-sky-300">
                Ronda {matchState.currentRoundIndex + 1} de {matchState.rounds.length} · Puntos x{multiplier}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Round Pot & 10s Turn Clock */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 bg-slate-950/90 border-2 border-amber-400 px-3.5 sm:px-5 py-1.5 rounded-2xl shadow-[0_0_25px_rgba(245,158,11,0.3)]">
            <span className="text-[10px] sm:text-[11px] font-mono uppercase text-amber-200 font-bold">
              Pozo:
            </span>
            <span className="font-mono text-xl sm:text-3xl font-black text-amber-400">
              {matchState.roundPot}
            </span>
            <span className="text-[10px] font-mono text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded-md font-bold">
              x{multiplier}
            </span>
          </div>

          {/* Turn Timer Badge */}
          {!matchState.roundFinished && activeTurnDuration > 0 && (
            <div
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border-2 font-mono font-black text-xs sm:text-base shadow-lg transition-all animate-pulse',
                turnSecondsRemaining <= 3
                  ? 'bg-red-600 border-red-300 text-white shadow-[0_0_20px_rgba(239,68,68,0.9)] scale-105'
                  : 'bg-amber-500/20 border-amber-400/60 text-amber-300'
              )}
              title={`Tiempo restante para responder (${activeTurnDuration} segundos)`}
            >
              <span>⏱️</span>
              <span>{turnSecondsRemaining}s</span>
            </div>
          )}
        </div>

        {/* Right: Essential Match Controls */}
        <div className="flex items-center gap-2">
          {!isSpectatorMode ? (
            <>
              <button
                type="button"
                onClick={toggleMatchFullscreen}
                className="px-3 py-1.5 bg-[#142026] hover:bg-[#1e3038] border border-amber-500/40 text-amber-300 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Alternar pantalla completa"
              >
                <Maximize size={14} />
                <span className="hidden sm:inline">Pantalla Completa</span>
              </button>

              <button
                type="button"
                onClick={onGoHome}
                className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-200 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors"
              >
                Salir
              </button>
            </>
          ) : (
            <span className="px-2.5 py-1 bg-amber-500/20 border border-amber-400/50 text-[10px] font-mono text-amber-300 uppercase font-bold tracking-wider">
              📺 Pantalla General de la Partida
            </span>
          )}
        </div>
      </header>

      {/* 2. Main TV Studio Board Area (Team A | Survey Board | Team B) */}
      <div className="relative z-10 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 my-1 sm:my-2 overflow-y-auto">
        {/* LEFT COLUMN: TEAM A SCOREBOARD */}
        <div
          className={cn(
            'lg:col-span-3 p-3 sm:p-4 flex flex-col justify-between border-2 transition-all',
            matchState.activeTeam === 'A'
              ? 'bg-[#0b1114]/95 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.28)]'
              : 'bg-[#0b1114]/80 border-[#26353d] opacity-85'
          )}
        >
          <div className="space-y-2 sm:space-y-3 text-center">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-extrabold uppercase tracking-wider">
              <span>☀️ EQUIPO A</span>
            </div>
            <h3 className="font-sans text-base sm:text-xl font-black uppercase tracking-wide text-white">
              {matchState.teamAName}
            </h3>
            <div className="bg-[#121c21] border-2 border-amber-500/50 py-2.5 sm:py-3.5 px-3 shadow-inner">
              <span className="font-mono text-3xl sm:text-5xl font-black text-amber-400">
                {matchState.teamAScore}
              </span>
              <span className="block text-[10px] font-mono text-slate-400 uppercase mt-0.5">
                Puntos Acumulados
              </span>
            </div>

            {matchState.activeTeam === 'A' && !matchState.roundFinished && (
              <div className="px-2.5 py-1.5 bg-amber-500 text-slate-950 font-sans font-black text-xs uppercase tracking-widest animate-pulse">
                {matchState.stealOpportunity
                  ? '⚡ ¡OPORTUNIDAD DE ROBO!'
                  : '🎤 TURNO DE RESPONDER'}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-center">
            <span className="text-[11px] font-mono text-slate-400 block mb-1">
              Integrantes ({teamAPlayers.length || 1}):
            </span>
            <div className="flex flex-wrap justify-center gap-1">
              {teamAPlayers.map((p) => (
                <span
                  key={p.id}
                  className="px-2 py-0.5 bg-[#142026] border border-slate-700 text-[11px] text-amber-200"
                >
                  {p.avatar} {p.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: THE 100 LATINOS DICEN SURVEY BOARD */}
        <div className="lg:col-span-6 bg-[#0b1114]/95 border-2 border-amber-500/70 p-2.5 sm:p-4 flex flex-col justify-between shadow-[0_0_50px_rgba(0,0,0,0.85)] relative gap-2 sm:gap-3">
          
          {/* REACTIVE TURN PROGRESS BAR */}
          {!matchState.roundFinished && !matchState.matchFinished && activeTurnDuration > 0 && (
            <div className="w-full bg-[#111a38] border-2 border-amber-500/50 rounded-xl sm:rounded-2xl p-2 shadow-xl flex flex-col gap-1 shrink-0">
              <div className="flex items-center justify-between text-xs font-mono font-bold">
                <div className="flex items-center gap-2">
                  <span className="text-amber-300 font-black flex items-center gap-1.5">
                    <span className="text-sm">⏱️</span>
                    <span>TURNO DE {matchState.activeTeam === 'A' ? matchState.teamAName : matchState.teamBName}:</span>
                  </span>
                </div>
                <span
                  className={cn(
                    'font-mono font-black text-xs sm:text-sm px-2.5 py-0.5 rounded-lg border shadow-sm transition-all',
                    turnSecondsRemaining <= 3
                      ? 'text-white bg-red-600 border-red-300 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.9)]'
                      : 'text-amber-300 bg-amber-950/80 border-amber-500/40'
                  )}
                >
                  {turnSecondsRemaining} / {activeTurnDuration} seg
                </span>
              </div>

              {/* Smooth Animated Progress Track */}
              <div className="w-full h-2.5 sm:h-3.5 bg-slate-950 border-2 border-slate-800 rounded-full overflow-hidden p-0.5 relative shadow-inner">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: `${(Math.max(0, Math.min(activeTurnDuration, turnSecondsRemaining)) / activeTurnDuration) * 100}%` }}
                  transition={{ duration: 0.35, ease: 'linear' }}
                  className={cn(
                    'h-full rounded-full transition-colors duration-300 relative shadow-md',
                    turnSecondsRemaining <= 3
                      ? 'bg-gradient-to-r from-red-600 via-rose-500 to-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-pulse'
                      : turnSecondsRemaining <= Math.ceil(activeTurnDuration * 0.5)
                      ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.6)]'
                      : 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]'
                  )}
                >
                  {/* Glossy sheen line */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/35 to-transparent rounded-full pointer-events-none" />
                </motion.div>
              </div>
            </div>
          )}

          {/* Survey Prompt Banner */}
          <div className="bg-gradient-to-r from-[#1e293b] via-[#172554] to-[#1e293b] border-2 border-amber-400/60 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 text-center shadow-lg">
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-amber-300 font-bold block mb-0.5">
              Le preguntamos a 100 personas ({currentRound?.subject}):
            </span>
            <h2 className="font-sans text-sm sm:text-lg font-black text-white leading-snug">
              “{currentRound?.prompt}”
            </h2>
          </div>

          {/* 5 Flip Answer Slots */}
          <div className="my-1.5 sm:my-2 space-y-1.5 sm:space-y-2 flex-1 flex flex-col justify-center">
            {currentRound?.answers.map((slot, idx) => {
              const isRevealed = matchState.revealedIndices.includes(idx);
              return (
                <motion.div
                  key={`${currentRound.id}_${idx}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => {
                    if (!isRevealed && (isHost || isSoloPractice)) {
                      handleHostRevealSlot(idx);
                    }
                  }}
                  className={cn(
                    'w-full h-9 sm:h-12 rounded-xl border-2 flex items-center justify-between px-3 sm:px-4 transition-all',
                    isRevealed
                      ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 border-white text-slate-950 shadow-[0_4px_20px_rgba(245,158,11,0.45)]'
                      : 'bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] border-sky-400/50 hover:border-amber-400 text-white cursor-pointer'
                  )}
                  title={
                    !isRevealed && (isHost || isSoloPractice)
                      ? 'Clic para revelar esta respuesta en el tablero'
                      : undefined
                  }
                >
                  {isRevealed ? (
                    <>
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-slate-950 text-amber-400 font-mono font-black text-xs flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <span className="font-sans text-xs sm:text-base font-black uppercase tracking-wide">
                          {slot.text}
                        </span>
                      </div>
                      <div className="px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl bg-slate-950 text-amber-300 font-mono text-sm sm:text-xl font-black">
                        {slot.points}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <span className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-amber-500 border-2 border-amber-200 text-slate-950 font-mono font-black text-xs sm:text-sm flex items-center justify-center shadow">
                          {idx + 1}
                        </span>
                        <span className="text-[10px] sm:text-xs font-mono text-sky-200/75 tracking-widest uppercase">
                          • • • RESPUESTA OCULTA • • •
                        </span>
                      </div>
                      {(isHost || isSoloPractice) && (
                        <span className="text-[9px] sm:text-[10px] font-mono text-amber-300/80 bg-slate-950/50 px-2 py-0.5 sm:py-1 rounded-lg border border-amber-400/30">
                          Revelar
                        </span>
                      )}
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Strikes Row + Last Guess Feedback */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400 font-bold">STRIKES:</span>
              {Array.from({ length: activeMaxStrikes }, (_, i) => i + 1).map((num) => {
                const active = matchState.strikes >= num;
                return (
                  <div
                    key={num}
                    className={cn(
                      'w-8 h-8 rounded-lg border-2 flex items-center justify-center font-black text-sm transition-all',
                      active
                        ? 'bg-red-600 border-white text-white shadow-[0_0_12px_rgba(239,68,68,0.8)] scale-110'
                        : 'bg-slate-900 border-slate-700 text-slate-700'
                    )}
                  >
                    ✕
                  </div>
                );
              })}
            </div>

            {matchState.lastGuessFeedback && (
              <div
                className={cn(
                  'px-3 py-1 rounded-xl text-xs font-bold truncate max-w-full',
                  matchState.lastGuessFeedback.isCorrect
                    ? 'bg-emerald-950/90 border border-emerald-500/50 text-emerald-300'
                    : 'bg-red-950/90 border border-red-500/50 text-red-300'
                )}
              >
                {matchState.lastGuessFeedback.text}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: TEAM B SCOREBOARD */}
        <div
          className={cn(
            'lg:col-span-3 p-3 sm:p-4 flex flex-col justify-between border-2 transition-all',
            matchState.activeTeam === 'B'
              ? 'bg-[#0b1114]/95 border-sky-400 shadow-[0_0_30px_rgba(56,189,248,0.28)]'
              : 'bg-[#0b1114]/80 border-[#26353d] opacity-85'
          )}
        >
          <div className="space-y-2 sm:space-y-3 text-center">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 bg-sky-500/15 border border-sky-400/40 text-sky-300 text-xs font-extrabold uppercase tracking-wider">
              <span>⚡ EQUIPO B</span>
            </div>
            <h3 className="font-sans text-base sm:text-xl font-black uppercase tracking-wide text-white">
              {matchState.teamBName}
            </h3>
            <div className="bg-[#121c21] border-2 border-sky-500/50 py-2.5 sm:py-3.5 px-3 shadow-inner">
              <span className="font-mono text-3xl sm:text-5xl font-black text-sky-400">
                {matchState.teamBScore}
              </span>
              <span className="block text-[10px] font-mono text-slate-400 uppercase mt-0.5">
                Puntos Acumulados
              </span>
            </div>

            {matchState.activeTeam === 'B' && !matchState.roundFinished && (
              <div className="px-2.5 py-1.5 bg-sky-400 text-slate-950 font-sans font-black text-xs uppercase tracking-widest animate-pulse">
                {matchState.stealOpportunity
                  ? '⚡ ¡OPORTUNIDAD DE ROBO!'
                  : '🎤 TURNO DE RESPONDER'}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-center">
            <span className="text-[11px] font-mono text-slate-400 block mb-1">
              Integrantes ({teamBPlayers.length || 1}):
            </span>
            <div className="flex flex-wrap justify-center gap-1">
              {teamBPlayers.map((p) => (
                <span
                  key={p.id}
                  className="px-2 py-0.5 bg-[#142026] border border-slate-700 text-[11px] text-sky-200"
                >
                  {p.avatar} {p.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM INPUT & TEACHER/HOST CONTROLS BAR */}
      <footer className="relative z-10 w-full bg-[#0b1114]/95 border-2 border-[#26353d] p-3 shadow-2xl shrink-0">
        {!matchState.roundFinished ? (
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {isSpectatorMode ? (
              /* Teacher Spectator Banner (Teachers supervise without student typing) */
              <div className="flex-1 bg-slate-950/90 border-2 border-amber-500/40 rounded-xl px-4 py-2.5 text-xs text-amber-200/90 font-mono font-bold flex items-center justify-between gap-2 shadow-inner">
                <span className="flex items-center gap-2">
                  <span>👨‍🏫</span>
                  <span>Modo Espectador Docente: Supervisando duelo por equipos en pantalla / proyector.</span>
                </span>
                <span className="text-[10px] font-mono text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 shrink-0">
                  ESPECTADOR ACTIVO
                </span>
              </div>
            ) : !isMyTeamTurn ? (
              /* Disabled Student Answer Bar when it's the other team's turn */
              <div className="flex-1 bg-slate-950/90 border-2 border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 font-mono flex items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">⏳</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-300">
                        TURNO DE {matchState.activeTeam === 'A' ? matchState.teamAName : matchState.teamBName}
                      </span>
                      <span className="text-[10px] bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-400">
                        Tu Equipo: {myTeam === 'A' ? matchState.teamAName : matchState.teamBName}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {matchState.stealOpportunity
                        ? '¡Atentos! Si el rival falla, podrás robar los puntos del pozo.'
                        : 'Esperando respuesta del equipo rival. No tienes habilitada la opción de escribir durante su turno.'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 bg-slate-900 border border-slate-700 text-slate-400 text-[10px] uppercase font-bold tracking-wider rounded">
                    🔒 Entrada Bloqueada
                  </span>
                </div>
              </div>
            ) : (
              /* Student Player Answer Input Form (Only for the active team!) */
              <form onSubmit={handleGuessSubmit} className="flex-1 flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={guessInput}
                    onChange={(e) => setGuessInput(e.target.value)}
                    placeholder={`Escribe la respuesta de ${
                      matchState.activeTeam === 'A' ? matchState.teamAName : matchState.teamBName
                    } (⏱️ ${turnSecondsRemaining}s)...`}
                    className="w-full bg-slate-950 border-2 border-amber-500/50 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none pr-16"
                  />
                  <div className={cn(
                    "absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-black px-2 py-0.5 rounded-md",
                    turnSecondsRemaining <= 3 ? "text-red-400 bg-red-950/80 border border-red-500/50 animate-pulse" : "text-amber-400"
                  )}>
                    ⏱️ {turnSecondsRemaining}s
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!guessInput.trim()}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-sans font-black text-xs sm:text-sm rounded-xl cursor-pointer flex items-center gap-1.5 shrink-0 shadow-md"
                >
                  <Send size={15} />
                  <span>Enviar</span>
                </button>
              </form>
            )}

            {/* Teacher / Host Quick Board Controls */}
            {(isHost || isSoloPractice || isSpectatorMode) && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleHostSwitchTurn}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeftRight size={14} className="text-amber-400" />
                  <span>Cambiar Turno</span>
                </button>

                <button
                  type="button"
                  onClick={handleHostManualStrike}
                  className="px-3 py-2 bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <XCircle size={14} />
                  <span>Strike ❌</span>
                </button>

                <button
                  type="button"
                  onClick={handleRevealAllRemainingForReview}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <Eye size={14} />
                  <span>Revelar Todo</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Round Finished Bar -> Reveal Remaining or Advance to Next Round */
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
              <Trophy size={18} className="text-amber-400" />
              <span>
                {matchState.roundWinnerTeam
                  ? `¡Ronda ganada por ${
                      matchState.roundWinnerTeam === 'A'
                        ? matchState.teamAName
                        : matchState.teamBName
                    }!`
                  : '¡Ronda completada!'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {matchState.revealedIndices.length < (currentRound?.answers.length || 0) && (
                <button
                  type="button"
                  onClick={handleRevealAllRemainingForReview}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <Eye size={14} />
                  <span>Revelar Respuestas Faltantes</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNextRound}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-black text-xs sm:text-sm rounded-xl cursor-pointer flex items-center gap-2 shadow-lg"
              >
                <span>
                  {matchState.currentRoundIndex + 1 < matchState.rounds.length
                    ? `Siguiente Ronda (${matchState.currentRoundIndex + 2}/${matchState.rounds.length})`
                    : 'Ver Podio Final de Equipos'}
                </span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </footer>

      {/* FINAL MATCH VICTORY MODAL */}
      <AnimatePresence>
        {matchState.matchFinished && (
          <div className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-[#131d3b] border-2 border-amber-400 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center space-y-5 shadow-2xl"
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-4xl mx-auto">
                🏆
              </div>

              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-amber-300 font-bold">
                  ¡FIN DE LA PARTIDA · 100 LATINOS DICEN!
                </span>
                <h2 className="font-sans text-2xl sm:text-3xl font-black text-white mt-1">
                  {matchState.teamAScore > matchState.teamBScore
                    ? `¡Victoria para ${matchState.teamAName}!`
                    : matchState.teamBScore > matchState.teamAScore
                    ? `¡Victoria para ${matchState.teamBName}!`
                    : '¡Empate Épico entre Equipos!'}
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-950/40 border border-amber-500/40 p-4 rounded-2xl">
                  <span className="text-xs font-bold text-amber-300 block">
                    {matchState.teamAName}
                  </span>
                  <span className="font-mono text-3xl font-black text-white">
                    {matchState.teamAScore} pts
                  </span>
                </div>
                <div className="bg-sky-950/40 border border-sky-500/40 p-4 rounded-2xl">
                  <span className="text-xs font-bold text-sky-300 block">
                    {matchState.teamBName}
                  </span>
                  <span className="font-mono text-3xl font-black text-white">
                    {matchState.teamBScore} pts
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsLibraryOpen(true);
                  }}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-black text-xs sm:text-sm rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-lg"
                >
                  <Globe size={16} />
                  <span>Elegir Otro Pack en la Biblioteca Infinita</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartMatchFromLobby}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-sans font-bold text-xs sm:text-sm rounded-xl cursor-pointer flex items-center justify-center gap-2"
                >
                  <RotateCcw size={15} />
                  <span>Repetir este Pack</span>
                </button>

                <button
                  type="button"
                  onClick={handleReturnToLobby}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-sans font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
                >
                  Volver a la Sala de Espera (Lobby)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Infinite Library Modal */}
      <LatinosLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        selectedPackId={selectedPack.id}
        onSelectPack={handleSelectPackFromLibrary}
        defaultAuthorName={localStorage.getItem('po_player_name') || 'Docente AulaPlay'}
      />

      {/* Global Match History & Statistics Modal */}
      <MatchHistoryModal
        isOpen={isMatchHistoryOpen}
        onClose={() => setIsMatchHistoryOpen(false)}
        userRole={isTeacherSpectator ? 'teacher' : 'student'}
      />
    </div>
    );
  };

  if (effectiveIsTeacher) {
    return (
      <div className="relative w-full h-[100dvh]">
        {isCountdownActive && (
          <MatchStartCountdown
            onComplete={() => setIsCountdownActive(false)}
            subtitle="¡100 LATINOS DICEN · MONITOREO DOCENTE!"
          />
        )}
        <TeacherSpectatorDashboard
          gameType="cien_latinos"
          gameTitle={matchState.packTitle}
          room={room}
          players={players}
          roomCode={roomCode}
          totalInitialSeconds={activeTurnDuration || 60}
          timeRemainingSecs={turnSecondsRemaining}
          totalQuestions={matchState.rounds.length}
          currentQuestionText={currentRound?.prompt}
          latinosState={matchState}
          onGoLobby={handleReturnToLobby}
          onGoHome={onGoHome}
          customSpectatorStage={renderTvBoard(true)}
        />
      </div>
    );
  }

  return renderTvBoard(false);
};
