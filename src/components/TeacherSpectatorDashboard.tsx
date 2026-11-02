import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Award,
  Clock,
  Search,
  CheckCircle2,
  BarChart2,
  BookOpen,
  Video,
  Table2,
  Maximize2,
  Minimize2,
  ShieldAlert,
  Eye,
  Monitor,
  Home,
  RotateCcw,
} from 'lucide-react';
import {
  EducationalGameType,
  ElementCard,
  GamePlayer,
  ImpostorMatchState,
  LatinosMatchState,
  RoomState,
} from '../types';
import { playBalatroSound } from '../lib/soundEffects';
import { AulaPlayLogo, EscapeBunkerGate } from './AulaPlayLogo';
import { HeatGuardianAtmosphere } from './HeatGuardianBackdrop';
import { cn } from '../lib/utils';

export interface TeacherSpectatorDashboardProps {
  gameType?: EducationalGameType;
  gameTitle?: string;
  room: RoomState | null;
  players: GamePlayer[];
  roomCode: string;
  totalInitialSeconds?: number;
  timeRemainingSecs?: number;
  totalQuestions?: number;
  currentQuestionText?: string;
  currentOptions?: string[];
  correctOptionIndex?: number;
  latinosState?: LatinosMatchState;
  impostorState?: ImpostorMatchState;
  geoTargetCountry?: string;
  geoPlayMode?: string;
  pokerPhase?: string;
  pokerCommunityCards?: ElementCard[];
  pokerPot?: number;
  onOpenGradeSummary?: () => void;
  onGoLobby: () => void;
  onGoHome?: () => void;
  /** Optional live non-interactive main board view (e.g., 3D Globe or Poker Table) */
  customSpectatorStage?: React.ReactNode;
}

interface UnifiedStudentMonitorRecord {
  id: string;
  camNumber: string;
  name: string;
  avatar: string;
  email: string;
  questionIndex: number;
  totalQuestions: number;
  isVictory: boolean;
  isGameOver: boolean;
  wrongAttempts: number;
  score: number;
  grade: number;
  statusText: string;
  team?: 'A' | 'B';
  selectedOptionLabel?: string;
  streak?: number;
  compoundName?: string;
  holeCardsText?: string;
  isSimulatedDemo?: boolean;
}

const DEMO_CLASSROOM_STUDENTS = [
  { id: 'sim-1', name: 'Sofía Ramírez', avatar: '👩‍🎓', email: 'sofia.ramirez@colegio.edu', speed: 1.15, acc: 0.92, team: 'A' as const, compound: 'H₂O (Agua Pura)', cards: 'H · H · O' },
  { id: 'sim-2', name: 'Mateo Morales', avatar: '🧑‍🎓', email: 'mateo.morales@colegio.edu', speed: 0.95, acc: 0.84, team: 'B' as const, compound: 'CO₂ (Dióxido de Carbono)', cards: 'C · O · O' },
  { id: 'sim-3', name: 'Valentina Gómez', avatar: '🔬', email: 'valentina.gomez@colegio.edu', speed: 1.25, acc: 0.96, team: 'A' as const, compound: 'NaCl (Cloruro de Sodio)', cards: 'Na · Cl' },
  { id: 'sim-4', name: 'Santiago Torres', avatar: '🚀', email: 'santiago.torres@colegio.edu', speed: 0.78, acc: 0.74, team: 'B' as const, compound: 'CH₄ (Metano)', cards: 'C · H₄' },
  { id: 'sim-5', name: 'Camila Herrera', avatar: '🧬', email: 'camila.herrera@colegio.edu', speed: 1.05, acc: 0.88, team: 'A' as const, compound: 'NH₃ (Amoníaco)', cards: 'N · H₃' },
  { id: 'sim-6', name: 'Sebastián Rojas', avatar: '⚡', email: 'sebastian.rojas@colegio.edu', speed: 0.65, acc: 0.68, team: 'B' as const, compound: 'Fe₂O₃ (Óxido Férrico)', cards: 'Fe · O' },
];

export const TeacherSpectatorDashboard: React.FC<TeacherSpectatorDashboardProps> = ({
  gameType = 'escape_room',
  gameTitle,
  room,
  players,
  roomCode,
  totalInitialSeconds = 300,
  timeRemainingSecs = 240,
  totalQuestions = 10,
  currentQuestionText,
  currentOptions,
  latinosState,
  impostorState,
  geoTargetCountry,
  pokerPhase,
  pokerCommunityCards,
  pokerPot,
  onOpenGradeSummary,
  onGoLobby,
  onGoHome,
  customSpectatorStage,
}) => {
  // Primary Teacher View Mode: 'cameras' (CCTV Live Student Feeds) vs 'table' (Live Leaderboard & Grades) vs 'stage' (Partida en Vivo / Pantalla General)
  const [viewMode, setViewMode] = useState<'cameras' | 'table' | 'stage'>(
    gameType === 'cien_latinos' ? 'stage' : 'cameras'
  );
  const [focusedStudentId, setFocusedStudentId] = useState<string | null>(null);
  const [isGridMaximized, setIsGridMaximized] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'escaped' | 'playing' | 'failed'>('all');
  const [animTick, setAnimTick] = useState(0);

  // Toggle fullscreen mode (both CSS full-viewport and HTML5 native fullscreen)
  const handleToggleFullscreen = () => {
    playBalatroSound('select');
    setIsGridMaximized((prev) => {
      const next = !prev;
      if (next) {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  };

  // Exit maximized on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (focusedStudentId) {
          setFocusedStudentId(null);
        } else if (isGridMaximized) {
          setIsGridMaximized(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedStudentId, isGridMaximized]);

  // Continuous animation tick for student camera feeds (running stride & live telemetry)
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimTick((prev) => prev + 1);
    }, 180);
    return () => clearInterval(interval);
  }, []);

  const elapsedSeconds = Math.max(0, totalInitialSeconds - timeRemainingSecs);

  // Build unified live student records across all 5 games
  const liveStudentRecords: UnifiedStudentMonitorRecord[] = useMemo(() => {
    const rawConnected = room?.players || players || [];
    const realStudents = rawConnected.filter(
      (p) =>
        !p.isSpectator &&
        p.role !== 'teacher' &&
        !p.name.toLowerCase().includes('profesor') &&
        !p.name.toLowerCase().includes('docente') &&
        !(room && p.id === room.hostId && room.hostIsSpectator)
    );

    const activeTotalQ = Math.max(
      1,
      totalQuestions ||
        (gameType === 'cien_latinos' && latinosState ? latinosState.rounds.length : 0) ||
        (gameType === 'el_impostor' && impostorState ? impostorState.rounds.length : 0) ||
        10
    );

    // If real students or bots are in the room, map their live state
    if (realStudents.length > 0) {
      return realStudents.map((p, idx) => {
        const prog = p.escapeProgress;
        const impostorScore = impostorState?.playerScores?.[p.id] ?? 0;
        const impostorVote = impostorState?.votes?.[p.id];
        const team = room?.playerTeams?.[p.id] || (idx % 2 === 0 ? 'A' : 'B');

        let qAnswered = prog ? prog.questionIndex : 0;
        if (gameType === 'el_impostor' && impostorState) {
          qAnswered = impostorState.currentRoundIndex + (impostorVote ? 1 : 0);
        } else if (gameType === 'cien_latinos' && latinosState) {
          qAnswered = latinosState.currentRoundIndex + (latinosState.roundFinished ? 1 : 0);
        } else if (gameType === 'geografia_3d' && !prog) {
          qAnswered = Math.min(activeTotalQ, Math.floor((p.score || 0) / 100));
        } else if (gameType === 'poker_quimico' && !prog) {
          qAnswered = p.isReady ? 3 : 2;
        }

        const totQ = prog ? prog.totalQuestions : activeTotalQ;
        const isVic = prog ? prog.isVictory : Boolean(impostorState?.matchFinished || latinosState?.matchFinished);
        const isOver = prog ? prog.isGameOver : Boolean(p.hasFolded);
        const wrong = prog ? prog.wrongAttempts : 0;

        let pScore = p.score || (prog ? prog.score : 0) || impostorScore;
        if (gameType === 'cien_latinos' && latinosState) {
          pScore = team === 'A' ? latinosState.teamAScore : latinosState.teamBScore;
        } else if (gameType === 'poker_quimico') {
          pScore = p.chips || 1000;
        }

        let grade = 0;
        if (prog && prog.grade) {
          grade = prog.grade;
        } else if (isVic) {
          grade = Math.min(100, Math.max(85, 95 - wrong * 3));
        } else if (gameType === 'poker_quimico') {
          grade = Math.min(100, Math.max(60, Math.round(((p.chips || 1000) / 1500) * 90)));
        } else {
          const ratio = Math.min(1, Math.max(0.15, qAnswered / Math.max(1, totQ)));
          grade = Math.min(98, Math.max(55, Math.round(50 + ratio * 48 - wrong * 3)));
        }

        const holeCardsText =
          p.hand && p.hand.length > 0
            ? p.hand.map((c) => c.symbol).join(' · ')
            : DEMO_CLASSROOM_STUDENTS[idx % DEMO_CLASSROOM_STUDENTS.length].cards;

        let statusText = p.statusText || '';
        if (!statusText) {
          if (gameType === 'escape_room') {
            statusText = isVic
              ? '¡Escapó del Búnker! 🏆'
              : isOver
              ? 'Atrapado por la Sombra 💀'
              : `Corriendo · Cámara ${Math.min(totQ, qAnswered + 1)}/${totQ}`;
          } else if (gameType === 'cien_latinos') {
            statusText = `Equipo ${team === 'A' ? 'Sol ☀️' : 'Rayo ⚡'} · Ronda ${(latinosState?.currentRoundIndex ?? 0) + 1}`;
          } else if (gameType === 'el_impostor') {
            statusText = impostorVote
              ? `Votó opción ${String.fromCharCode(65 + impostorVote.statementIndex)} ${impostorVote.isCorrect ? '✓' : '✕'}`
              : 'Analizando afirmaciones... 🕵️';
          } else if (gameType === 'geografia_3d') {
            statusText = `Explorando Globo 3D · ${qAnswered} países acertados 🌍`;
          } else {
            statusText = p.hasFolded
              ? 'Se retiró de la mano'
              : `En mano activa · ${p.chips || 1000} fichas 🧪`;
          }
        }

        return {
          id: p.id,
          camNumber: `CAM 0${idx + 1}`,
          name: p.name,
          avatar: p.avatar || '🧑‍🎓',
          email: p.googleEmail || `${p.name.toLowerCase().replace(/\s+/g, '.')}@aula.edu`,
          questionIndex: qAnswered,
          totalQuestions: totQ,
          isVictory: isVic,
          isGameOver: isOver,
          wrongAttempts: wrong,
          score: pScore,
          grade,
          statusText,
          team,
          selectedOptionLabel: impostorVote
            ? `Opción ${String.fromCharCode(65 + impostorVote.statementIndex)}`
            : `Opción ${['A', 'B', 'C', 'D'][(idx + qAnswered) % 4]}`,
          streak: Math.max(1, qAnswered),
          compoundName: DEMO_CLASSROOM_STUDENTS[idx % DEMO_CLASSROOM_STUDENTS.length].compound,
          holeCardsText,
        };
      });
    }

    // Fallback: Live Classroom Simulation Feeds when the teacher is testing/monitoring before students join
    const stepTime = Math.max(1, Math.floor(elapsedSeconds / 8) + Math.floor(animTick / 35));
    return DEMO_CLASSROOM_STUDENTS.map((demo, idx) => {
      const qAnswered = Math.min(
        activeTotalQ,
        Math.max(1, Math.floor(((stepTime + idx * 2) * demo.speed) % (activeTotalQ + 1)))
      );
      const isVic = qAnswered >= activeTotalQ;
      const wrong = idx % 3 === 0 ? 1 : 0;
      const score = qAnswered * 120 + (isVic ? 250 : 0);
      const grade = Math.min(100, Math.max(62, Math.round(58 + (qAnswered / activeTotalQ) * 42 - wrong * 4)));
      const optLetter = ['A', 'B', 'C', 'D'][(idx + stepTime) % 4];

      let statusText = '';
      if (gameType === 'escape_room') {
        statusText = isVic
          ? '¡Escapó del Búnker! 🏆'
          : `Corriendo · Cámara ${Math.min(activeTotalQ, qAnswered)}/${activeTotalQ}`;
      } else if (gameType === 'cien_latinos') {
        statusText = `Equipo ${demo.team === 'A' ? 'Sol ☀️' : 'Rayo ⚡'} · Turno activo`;
      } else if (gameType === 'el_impostor') {
        statusText = stepTime % 2 === 0 ? `Votó Sospechoso ${optLetter} 🗳️` : 'Inspeccionando pistas 🕵️';
      } else if (gameType === 'geografia_3d') {
        statusText = `Racha 🔥 ${qAnswered} · Localizando en Globo 3D`;
      } else {
        statusText = `Sintetizando ${demo.compound}`;
      }

      return {
        id: demo.id,
        camNumber: `CAM 0${idx + 1}`,
        name: demo.name,
        avatar: demo.avatar,
        email: demo.email,
        questionIndex: qAnswered,
        totalQuestions: activeTotalQ,
        isVictory: isVic,
        isGameOver: false,
        wrongAttempts: wrong,
        score,
        grade,
        statusText,
        team: demo.team,
        selectedOptionLabel: `Opción ${optLetter}`,
        streak: qAnswered,
        compoundName: demo.compound,
        holeCardsText: demo.cards,
        isSimulatedDemo: true,
      };
    });
  }, [
    room,
    players,
    totalQuestions,
    gameType,
    latinosState,
    impostorState,
    elapsedSeconds,
    animTick,
  ]);

  // Filtered and sorted student list for the Leaderboard Table
  const filteredStudents = useMemo(() => {
    return liveStudentRecords
      .filter((s) => {
        const matchesSearch =
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.email.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
        if (filterStatus === 'escaped') return s.isVictory;
        if (filterStatus === 'failed') return s.isGameOver;
        if (filterStatus === 'playing') return !s.isVictory && !s.isGameOver;
        return true;
      })
      .sort((a, b) => b.score - a.score || b.grade - a.grade);
  }, [liveStudentRecords, searchTerm, filterStatus]);

  const focusedStudent = useMemo(
    () => liveStudentRecords.find((s) => s.id === focusedStudentId) || null,
    [liveStudentRecords, focusedStudentId]
  );

  // Class Summary Metrics
  const totalStudents = liveStudentRecords.length;
  const escapedCount = liveStudentRecords.filter((s) => s.isVictory).length;
  const inProgressCount = liveStudentRecords.filter((s) => !s.isVictory && !s.isGameOver).length;
  const averageGrade = useMemo(() => {
    if (totalStudents === 0) return 0;
    const sum = liveStudentRecords.reduce((acc, s) => acc + s.grade, 0);
    return Math.round(sum / totalStudents);
  }, [liveStudentRecords, totalStudents]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(Math.max(0, secs) / 60);
    const s = Math.max(0, secs) % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getBadgeInfo = (grade: number) => {
    if (grade >= 90)
      return {
        label: 'Sobresaliente 🌟',
        color: 'bg-emerald-950/90 text-[#22e584] border-[#22e584]/50',
      };
    if (grade >= 75)
      return {
        label: 'Aprobado 👍',
        color: 'bg-sky-950/90 text-sky-300 border-sky-500/50',
      };
    if (grade >= 60)
      return {
        label: 'En Progreso ⚡',
        color: 'bg-amber-950/90 text-amber-300 border-amber-500/50',
      };
    return {
      label: 'Refuerzo 📚',
      color: 'bg-red-950/90 text-red-300 border-red-500/50',
    };
  };

  const resolvedGameTitle = useMemo(() => {
    if (gameTitle) return gameTitle;
    switch (gameType) {
      case 'escape_room':
        return 'Escape Room Educativo · Persecución Invernal';
      case 'cien_latinos':
        return '100 Latinos Dicen · Duelo por Equipos';
      case 'el_impostor':
        return 'El Impostor · Investigación Individual';
      case 'geografia_3d':
        return 'Globo Terráqueo 3D · Atlas Mundial';
      case 'poker_quimico':
        return 'Póker del Octeto · Estrategia Molecular';
      default:
        return 'Partida en Vivo';
    }
  }, [gameTitle, gameType]);

  /**
   * Renders the game-specific live camera screen inside each student's CCTV monitor.
   */
  const renderStudentCameraFeed = (student: UnifiedStudentMonitorRecord, isExpanded = false) => {
    const progressRatio = Math.min(
      1,
      Math.max(0, student.questionIndex / Math.max(1, student.totalQuestions))
    );
    const stride = (animTick + student.name.length) % 2;

    // 1. ESCAPE ROOM CAMERA FEED (Live Snowy Forest Chase + Monster + Guardian + Bunker Gate)
    if (gameType === 'escape_room') {
      const guardianLeft = 64 + Math.min(10, progressRatio * 8);
      const monsterLeft = guardianLeft - (7 + progressRatio * 4);
      const isGateOpen = student.isVictory || student.questionIndex >= student.totalQuestions - 1;

      return (
        <div
          className={cn(
            'relative w-full overflow-hidden bg-gradient-to-b from-[#2d373c] via-[#575e63] to-[#12191d] select-none',
            isExpanded ? 'h-[360px] sm:h-[430px]' : 'h-44 sm:h-48'
          )}
        >
          {/* Moving Parallax Forest Strip inside Student Camera */}
          <div className="absolute inset-0 w-[200%] flex animate-[infinite-corridor_6s_linear_infinite] opacity-65">
            {[0, 1].map((t) => (
              <svg
                key={t}
                className="w-1/2 h-full object-cover shrink-0"
                viewBox="0 0 800 300"
                preserveAspectRatio="none"
              >
                <g fill="#334155">
                  {[50, 130, 210, 290, 370, 450, 530, 610, 690, 760].map((x, i) => {
                    const h = 70 + ((i * 29) % 50);
                    return (
                      <polygon
                        key={x}
                        points={`${x},${245 - h} ${x - 24},245 ${x + 24},245`}
                      />
                    );
                  })}
                </g>
                <path
                  d="M 0 300 L 0 238 Q 200 225 400 238 T 800 238 L 800 300 Z"
                  fill="#cbd5e1"
                  opacity="0.88"
                />
                <path
                  d="M 0 300 L 0 262 Q 200 250 400 262 T 800 262 L 800 300 Z"
                  fill="#0b1114"
                  opacity="0.92"
                />
              </svg>
            ))}
          </div>

          {/* Mini Monolith Question Preview on Left of Student Screen */}
          <div className="absolute left-2 top-7 bottom-2 w-[36%] bg-[#0b1114]/92 border border-[#26353d] p-2 flex flex-col justify-between z-10">
            <div>
              <div className="text-[8px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                CÁMARA {Math.min(student.totalQuestions, student.questionIndex + 1)}/{student.totalQuestions}
              </div>
              <div className="text-[9px] sm:text-[10px] font-bold text-slate-100 line-clamp-2 mt-0.5 leading-tight">
                {currentQuestionText || 'Resolviendo enigma de la cámara activa...'}
              </div>
            </div>
            <div className="space-y-0.5">
              {['A', 'B', 'C', 'D'].map((opt) => {
                const isSelected = student.selectedOptionLabel?.includes(opt);
                return (
                  <div
                    key={opt}
                    className={cn(
                      'px-1.5 py-0.5 text-[8px] font-mono flex items-center justify-between border',
                      isSelected
                        ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-bold'
                        : 'bg-[#121c21]/80 border-[#26353d] text-slate-400'
                    )}
                  >
                    <span>OPCIÓN {opt}</span>
                    {isSelected && <span>▶</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sky Counter inside Student Feed */}
          <div className="absolute top-7 left-[40%] right-2 flex flex-col items-center z-10">
            <div className="font-sans font-black text-xl sm:text-2xl text-white tracking-wider drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] leading-none">
              {formatTime(timeRemainingSecs)}
            </div>
            <span className="text-[8px] font-mono uppercase tracking-widest text-amber-300">
              {student.statusText}
            </span>
          </div>

          {/* Close-Proximity Monster & Student Guardian Running */}
          <div
            style={{ left: `${monsterLeft}%`, bottom: '16%' }}
            className="absolute -translate-x-1/2 z-15 flex flex-col items-center transition-all duration-300"
          >
            <img
              src="/assets/aistudio/monster_clean.png"
              alt="Sombra"
              className={cn(
                'w-auto object-contain filter drop-shadow-[0_0_10px_rgba(239,68,68,0.9)]',
                isExpanded ? 'h-16' : 'h-10'
              )}
            />
          </div>

          <div
            style={{ left: `${guardianLeft}%`, bottom: '15%' }}
            className="absolute -translate-x-1/2 z-20 flex flex-col items-center transition-all duration-300"
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute w-6 h-6 rounded-full bg-amber-400/70 blur-sm animate-pulse" />
              <img
                src={
                  stride === 0
                    ? '/assets/aistudio/player_run_1.png'
                    : '/assets/aistudio/player_run_2.png'
                }
                alt={student.name}
                className={cn(
                  'relative z-10 w-auto object-contain pixel-art',
                  isExpanded ? 'h-14' : 'h-9'
                )}
              />
            </div>
          </div>

          {/* Cool Bunker Exit Gate on Far Right of Student Camera */}
          <div className="absolute right-2 bottom-[13%] z-20">
            <EscapeBunkerGate
              isOpen={isGateOpen}
              currentChamber={Math.min(student.totalQuestions, student.questionIndex + 1)}
              totalChambers={student.totalQuestions}
              compact={!isExpanded}
            />
          </div>
        </div>
      );
    }

    // 2. 100 LATINOS DICEN CAMERA FEED
    if (gameType === 'cien_latinos') {
      const currentRound = latinosState?.rounds?.[latinosState.currentRoundIndex];
      return (
        <div
          className={cn(
            'relative w-full overflow-hidden bg-[#0b1114] p-3 flex flex-col justify-between select-none',
            isExpanded ? 'h-[360px]' : 'h-44 sm:h-48'
          )}
        >
          <div className="mt-5 flex items-center justify-between border-b border-[#26353d] pb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
              {student.team === 'A' ? '☀️ EQUIPO SOL' : '⚡ EQUIPO RAYO'}
            </span>
            <span className="text-[10px] font-mono text-slate-300">
              Strikes: {'✕ '.repeat(latinosState?.strikes || 0) || '0'}
            </span>
          </div>

          <div className="my-auto bg-[#121c21] border border-amber-500/40 p-2.5 text-center">
            <div className="text-[9px] font-mono uppercase text-slate-400">
              Pregunta en Pantalla del Estudiante:
            </div>
            <div className="text-xs font-bold text-white line-clamp-2 mt-0.5">
              {currentRound?.question || '¿Qué elemento químico es indispensable para la vida?'}
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono bg-[#142026] px-2.5 py-1.5 border border-[#26353d]">
            <span className="text-slate-300">{student.statusText}</span>
            <span className="text-amber-300 font-bold">{student.score} PTS</span>
          </div>
        </div>
      );
    }

    // 3. EL IMPOSTOR CAMERA FEED
    if (gameType === 'el_impostor') {
      const round = impostorState?.rounds?.[impostorState.currentRoundIndex];
      const statements = round?.statements || [
        { id: '1', text: 'Afirmación científica A verificada en clase' },
        { id: '2', text: 'Afirmación científica B con posible error sutil' },
        { id: '3', text: 'Afirmación científica C correcta' },
        { id: '4', text: 'Afirmación científica D correcta' },
      ];
      return (
        <div
          className={cn(
            'relative w-full overflow-hidden bg-[#0b1114] p-3 flex flex-col justify-between select-none',
            isExpanded ? 'h-[360px]' : 'h-44 sm:h-48'
          )}
        >
          <div className="mt-5 flex items-center justify-between text-[9px] font-mono text-amber-400 uppercase tracking-wider">
            <span>🕵️ EXPEDIENTE DE SOSPECHOSOS</span>
            <span>{student.selectedOptionLabel}</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 my-auto">
            {statements.slice(0, 4).map((st, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isPicked = student.selectedOptionLabel?.includes(letter);
              return (
                <div
                  key={st.id || idx}
                  className={cn(
                    'p-1.5 border text-[9px] leading-tight flex flex-col justify-between',
                    isPicked
                      ? 'bg-amber-500/20 border-amber-400 text-white font-bold'
                      : 'bg-[#121c21] border-[#26353d] text-slate-400'
                  )}
                >
                  <div className="flex items-center justify-between font-mono text-[8px] text-amber-300">
                    <span>SOSPECHOSO {letter}</span>
                    {isPicked && <span>🗳️ VOTO</span>}
                  </div>
                  <div className="line-clamp-2 mt-0.5">{st.text}</div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 border-t border-[#26353d] pt-1">
            <span>{student.statusText}</span>
            <span className="text-[#22e584] font-bold">{student.score} PTS</span>
          </div>
        </div>
      );
    }

    // 4. GLOBO TERRÁQUEO 3D CAMERA FEED
    if (gameType === 'geografia_3d') {
      return (
        <div
          className={cn(
            'relative w-full overflow-hidden bg-[#071426] p-3 flex flex-col justify-between select-none',
            isExpanded ? 'h-[360px]' : 'h-44 sm:h-48'
          )}
        >
          {/* Animated 3D Radar Globe Representation */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-45">
            <div className="w-28 h-28 rounded-full border-2 border-sky-400/60 bg-radial from-sky-500/25 via-sky-900/40 to-transparent relative flex items-center justify-center">
              <div className="w-full h-[1px] bg-sky-400/40" />
              <div className="h-full w-[1px] bg-sky-400/40 absolute" />
              <div className="w-16 h-28 rounded-full border border-sky-400/35 absolute" />
              <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
            </div>
          </div>

          <div className="relative z-10 mt-5 flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-sky-300">
            <span>🌍 CÁMARA DE NAVEGACIÓN 3D</span>
            <span className="text-amber-300 font-bold">🔥 RACHA: {student.streak || 1}</span>
          </div>

          <div className="relative z-10 my-auto text-center">
            <span className="text-[9px] font-mono uppercase tracking-widest text-slate-300 block">
              Objetivo Activo en el Globo:
            </span>
            <strong className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
              {geoTargetCountry || 'Exploración Continental'}
            </strong>
          </div>

          <div className="relative z-10 flex items-center justify-between text-[10px] font-mono bg-[#0b1114]/90 px-2.5 py-1 border border-[#26353d]">
            <span className="text-slate-300 truncate">{student.statusText}</span>
            <span className="text-[#22e584] font-bold shrink-0">{student.score} PTS</span>
          </div>
        </div>
      );
    }

    // 5. PÓKER QUÍMICO CAMERA FEED
    return (
      <div
        className={cn(
          'relative w-full overflow-hidden bg-[#052310] p-3 flex flex-col justify-between select-none',
          isExpanded ? 'h-[360px]' : 'h-44 sm:h-48'
        )}
      >
        <div className="mt-5 flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-emerald-300">
          <span>🧪 MESA DE SÍNTESIS ({pokerPhase || 'FLOP'})</span>
          <span className="text-amber-300 font-bold">POZO: {pokerPot || 240}</span>
        </div>

        <div className="my-auto flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5">
            {(student.holeCardsText || 'H · O').split('·').map((sym, i) => (
              <div
                key={i}
                className="w-9 h-12 bg-amber-50 border-2 border-amber-400 text-slate-950 font-black text-xs flex flex-col items-center justify-center rounded shadow"
              >
                <span>{sym.trim()}</span>
                <span className="text-[7px] font-mono text-slate-600">VAL</span>
              </div>
            ))}
          </div>
          <span className="text-[10px] font-mono text-amber-300 font-bold">
            {student.compoundName}
          </span>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono bg-black/50 px-2.5 py-1 border border-emerald-500/30">
          <span className="text-slate-200 truncate">{student.statusText}</span>
          <span className="text-amber-300 font-bold">{student.score} FICHAS</span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-[100dvh] bg-[#0b1114] text-slate-100 font-sans flex flex-col justify-between p-3 sm:p-5 overflow-hidden select-none relative">
      {/* Heat Guardian Snowy Pine Background */}
      <HeatGuardianAtmosphere
        variant="arctic_cyan"
        showGuardianScene={false}
        sceneOpacity={0.55}
      />

      {/* =====================================================================
          1. TOP COMMAND BAR (STRICT TEACHER SPECTATOR MODE + VIEW SWITCHER)
      ===================================================================== */}
      <header className="relative z-20 bg-[#0b1114]/95 border-2 border-[#26353d] px-4 py-3 shadow-2xl flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Left: AulaPlay Logo + Teacher Spectator Title */}
        <div className="flex items-center gap-3">
          <div className="px-2.5 py-1.5 bg-[#121c21] border border-amber-500/50 flex flex-col items-center justify-center">
            <AulaPlayLogo size="xs" theme="light" />
            <span className="text-[7px] font-mono uppercase tracking-[0.2em] text-amber-400">
              DOCENTE
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-[#22e584] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22e584] animate-ping" />
                SALA {roomCode}
              </span>
            </div>
            <h1 className="font-sans text-sm sm:text-base font-black uppercase tracking-wider text-white">
              {resolvedGameTitle}
            </h1>
          </div>
        </div>

        {/* Center: Switcher between LIVE CAMERAS vs LEADERBOARD TABLE */}
        <div className="flex items-center bg-[#121c21] p-1 border border-[#26353d]">
          {gameType === 'cien_latinos' ? (
            <button
              type="button"
              onClick={() => {
                playBalatroSound('select');
                setViewMode('stage');
              }}
              className={cn(
                'px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] flex items-center gap-2 transition-all cursor-pointer',
                viewMode === 'stage'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              )}
            >
              <Monitor size={15} />
              <span>🎮 Partida (Pantalla General)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                playBalatroSound('select');
                setViewMode('cameras');
              }}
              className={cn(
                'px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] flex items-center gap-2 transition-all cursor-pointer',
                viewMode === 'cameras'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              )}
            >
              <Video size={15} />
              <span>📹 Cámaras de Estudiantes ({totalStudents})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              playBalatroSound('select');
              setViewMode('table');
            }}
            className={cn(
              'px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] flex items-center gap-2 transition-all cursor-pointer',
              viewMode === 'table'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white'
            )}
          >
            <Table2 size={15} />
            <span>📊 Tabla de {gameType === 'cien_latinos' ? 'Equipos y Alumnos' : 'Posiciones'}</span>
          </button>

          {customSpectatorStage && gameType !== 'cien_latinos' && (
            <button
              type="button"
              onClick={() => {
                playBalatroSound('select');
                setViewMode('stage');
              }}
              className={cn(
                'px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] flex items-center gap-2 transition-all cursor-pointer',
                viewMode === 'stage'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              )}
            >
              <Monitor size={15} />
              <span>🖥️ Vista General</span>
            </button>
          )}
        </div>

        {/* Right: Clock + Grade Summary + Return to Lobby */}
        <div className="flex items-center gap-2">
          {timeRemainingSecs > 0 && (
            <div className="px-3 py-1.5 bg-[#121c21] border border-amber-500/40 flex items-center gap-2 font-mono">
              <Clock size={15} className="text-amber-400" />
              <div>
                <span className="text-[8px] text-slate-400 uppercase block leading-none">
                  Reloj
                </span>
                <strong className="text-sm text-amber-300 font-bold">
                  {formatTime(timeRemainingSecs)}
                </strong>
              </div>
            </div>
          )}

          {onOpenGradeSummary && (
            <button
              type="button"
              onClick={() => {
                playBalatroSound('play');
                onOpenGradeSummary();
              }}
              className="px-3.5 py-2 bg-[#142026] hover:bg-[#1c2d36] border border-amber-400/60 text-amber-300 font-bold text-xs uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <BarChart2 size={15} />
              <span className="hidden sm:inline">Notas (0-100)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleFullscreen}
            className={cn(
              "px-3 py-2 font-bold text-xs uppercase tracking-wider border cursor-pointer flex items-center gap-1.5 transition-colors",
              isGridMaximized
                ? "bg-amber-500 text-slate-950 border-amber-400"
                : "bg-[#142026] hover:bg-[#1e3038] text-amber-300 border-amber-500/40"
            )}
            title={isGridMaximized ? 'Salir de pantalla completa (ESC)' : 'Ver cámaras en pantalla completa'}
          >
            {isGridMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span className="hidden md:inline">{isGridMaximized ? 'Ventana' : 'Pantalla Completa'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playBalatroSound('click');
              onGoLobby();
            }}
            className="px-3 py-2 bg-[#142026] hover:bg-[#1e3038] text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider border border-[#26353d] cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw size={13} />
            <span>Sala</span>
          </button>

          {onGoHome && (
            <button
              type="button"
              onClick={() => {
                playBalatroSound('click');
                onGoHome();
              }}
              className="px-3 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-200 font-bold text-xs uppercase tracking-wider border border-rose-500/40 cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <Home size={13} />
              <span className="hidden md:inline">Menú</span>
            </button>
          )}
        </div>
      </header>

      {/* =====================================================================
          2. CLASS TELEMETRY SUMMARY STRIP (HIDDEN IN STAGE / PARTIDA GENERAL MODE)
      ===================================================================== */}
      {viewMode !== 'stage' && (
        <div className="relative z-20 grid grid-cols-2 md:grid-cols-4 gap-2.5 my-2.5 shrink-0">
          <div className="bg-[#0b1114]/90 border border-[#26353d] p-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-[#121c21] text-sky-400 flex items-center justify-center border border-[#26353d]">
              <Users size={18} />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 block uppercase tracking-wider">
                Estudiantes Monitoreados
              </span>
              <strong className="text-lg font-black text-white">{totalStudents}</strong>
            </div>
          </div>

          <div className="bg-[#0b1114]/90 border border-[#26353d] p-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-[#121c21] text-amber-400 flex items-center justify-center border border-[#26353d]">
              <Award size={18} />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 block uppercase tracking-wider">
                Promedio en Vivo
              </span>
              <strong className="text-lg font-black text-amber-300">{averageGrade} / 100 PTS</strong>
            </div>
          </div>

          <div className="bg-[#0b1114]/90 border border-[#26353d] p-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-[#121c21] text-[#22e584] flex items-center justify-center border border-[#26353d]">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 block uppercase tracking-wider">
                Meta Completada
              </span>
              <strong className="text-lg font-black text-[#22e584]">{escapedCount}</strong>
            </div>
          </div>

          <div className="bg-[#0b1114]/90 border border-[#26353d] p-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-[#121c21] text-amber-300 flex items-center justify-center border border-[#26353d]">
              <BookOpen size={18} />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 block uppercase tracking-wider">
                En Desarrollo Activo
              </span>
              <strong className="text-lg font-black text-slate-100">{inProgressCount}</strong>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          3. MAIN WORKSPACE: EITHER LIVE STUDENT CCTV CAMERAS OR LEADERBOARD TABLE
      ===================================================================== */}
      <main className="relative z-20 flex-1 bg-[#0b1114]/95 border-2 border-[#26353d] p-3.5 sm:p-4 shadow-2xl flex flex-col min-h-0 overflow-hidden">
        {/* -----------------------------------------------------------------
            MODE A: LIVE STUDENT CCTV CAMERAS ("COMO SI FUERAN CÁMARAS")
        ----------------------------------------------------------------- */}
        {viewMode === 'cameras' && (
          <div
            className={cn(
              "flex flex-col min-h-0 transition-all",
              (isGridMaximized || Boolean(focusedStudent))
                ? "fixed inset-0 z-[120] w-screen h-screen bg-[#07050e] p-3 sm:p-5"
                : "flex-1"
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-[#26353d] shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-white font-bold">
                  CIRCUITO CERRADO DE CÁMARAS ESTUDIANTILES · TIEMPO REAL
                </span>
                {isGridMaximized && (
                  <span className="px-2 py-0.5 bg-red-600/30 border border-red-500/50 text-red-200 text-[10px] font-mono font-bold">
                    PANTALLA COMPLETA
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {focusedStudent && (
                  <button
                    type="button"
                    onClick={() => setFocusedStudentId(null)}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <Minimize2 size={13} />
                    <span>Volver a Cuadrícula de {totalStudents} Cámaras</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className={cn(
                    "px-3 py-1 font-black text-[11px] uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-colors border",
                    isGridMaximized
                      ? "bg-amber-500 text-slate-950 border-amber-400"
                      : "bg-[#142026] hover:bg-[#1e3038] text-amber-300 border-amber-500/40"
                  )}
                  title={isGridMaximized ? "Salir de pantalla completa (ESC)" : "Expandir cuadrícula a toda la pantalla"}
                >
                  {isGridMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  <span>{isGridMaximized ? 'Reducir Pantalla (ESC)' : 'Toda la Pantalla'}</span>
                </button>
                {!isGridMaximized && (
                  <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                    Haz clic en cualquier cámara para ampliarla
                  </span>
                )}
              </div>
            </div>

            {/* Focused Single-Camera View OR Multi-Camera Grid */}
            {focusedStudent ? (
              <div className="flex-1 overflow-y-auto flex flex-col justify-between bg-[#121c21] border-2 border-amber-400 p-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#26353d]">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-red-600 text-white font-mono text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                      {focusedStudent.camNumber} · EN VIVO
                    </span>
                    <span className="text-2xl">{focusedStudent.avatar}</span>
                    <div>
                      <h3 className="font-sans text-lg font-black text-white uppercase tracking-wider">
                        {focusedStudent.name}
                      </h3>
                      <span className="text-xs font-mono text-slate-400">
                        {focusedStudent.email}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right font-mono">
                      <span className="text-[10px] text-slate-400 uppercase block">
                        Puntaje / Nota
                      </span>
                      <strong className="text-lg font-black text-amber-300">
                        {focusedStudent.score} PTS · Nota {focusedStudent.grade}/100
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFocusedStudentId(null)}
                      className="px-3 py-1.5 bg-[#0b1114] hover:bg-slate-800 border border-slate-600 text-xs font-mono uppercase text-white cursor-pointer"
                    >
                      Cerrar Zoom ✕
                    </button>
                  </div>
                </div>

                <div className="my-3 flex-1 flex flex-col justify-center">
                  {renderStudentCameraFeed(focusedStudent, true)}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#26353d] text-xs font-mono">
                  <span className="text-slate-300">
                    Estado actual: <strong className="text-amber-300">{focusedStudent.statusText}</strong>
                  </span>
                  <span className="text-slate-400">
                    Avance: {focusedStudent.questionIndex} / {focusedStudent.totalQuestions} · Errores: {focusedStudent.wrongAttempts}
                  </span>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "flex-1 overflow-y-auto grid gap-3.5 pr-1",
                  isGridMaximized
                    ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4"
                    : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                )}
              >
                {liveStudentRecords.map((student) => {
                  const progressPct = Math.min(
                    100,
                    Math.round((student.questionIndex / Math.max(1, student.totalQuestions)) * 100)
                  );
                  return (
                    <motion.div
                      key={student.id}
                      layout
                      onClick={() => {
                        playBalatroSound('select');
                        setFocusedStudentId(student.id);
                      }}
                      className="group relative bg-[#121c21] border-2 border-[#26353d] hover:border-amber-400 transition-all flex flex-col justify-between overflow-hidden cursor-pointer shadow-lg"
                    >
                      {/* Top Camera HUD Overlay Bar */}
                      <div className="absolute top-0 inset-x-0 z-30 bg-[#0b1114]/90 border-b border-[#26353d] px-2.5 py-1 flex items-center justify-between text-[10px] font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                          <span className="font-black text-white tracking-wider">
                            {student.camNumber}
                          </span>
                          <span className="text-slate-500">|</span>
                          <span className="text-amber-300 font-bold truncate max-w-[130px]">
                            {student.avatar} {student.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#22e584] font-bold">
                            {student.grade}/100
                          </span>
                          <Maximize2
                            size={11}
                            className="text-slate-400 group-hover:text-amber-300 transition-colors"
                          />
                        </div>
                      </div>

                      {/* Live Visual Viewport of that Student's Game */}
                      {renderStudentCameraFeed(student, false)}

                      {/* Bottom Telemetry Footer of the Camera */}
                      <div className="p-2.5 bg-[#0b1114] border-t border-[#26353d] space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-slate-300 truncate max-w-[70%]">
                            {student.statusText}
                          </span>
                          <span className="text-amber-400 font-black">
                            {student.score} PTS
                          </span>
                        </div>

                        {/* Mini Progress Bar */}
                        <div className="w-full h-1.5 bg-[#121c21] overflow-hidden">
                          <div
                            className={cn(
                              'h-full transition-all duration-500',
                              student.isVictory
                                ? 'bg-[#22e584]'
                                : student.isGameOver
                                ? 'bg-red-500'
                                : 'bg-amber-400'
                            )}
                            style={{ width: `${Math.max(8, progressPct)}%` }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* -----------------------------------------------------------------
            MODE B: LIVE LEADERBOARD & PROGRESS TABLE ("VER LA TABLA DE CÓMO VAN")
        ----------------------------------------------------------------- */}
        {viewMode === 'table' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search & Status Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#26353d] shrink-0">
              <div className="flex items-center gap-2 bg-[#121c21] border border-[#26353d] px-3 py-1.5 w-full sm:w-72 text-xs">
                <Search size={14} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar estudiante o correo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent text-white font-mono text-xs focus:outline-none w-full"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs font-mono">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'escaped', label: 'Completados 🏆' },
                  { id: 'playing', label: 'En Partida ⚡' },
                  { id: 'failed', label: 'Sin Completar 💀' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setFilterStatus(st.id as any);
                      playBalatroSound('click');
                    }}
                    className={cn(
                      'px-3 py-1.5 font-bold uppercase tracking-wider transition-all cursor-pointer border',
                      filterStatus === st.id
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-[#121c21] text-slate-300 border-[#26353d] hover:text-white'
                    )}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Leaderboard Rows */}
            <div className="flex-1 overflow-y-auto my-2.5 pr-1 space-y-2">
              {filteredStudents.map((student, rankIdx) => {
                const badge = getBadgeInfo(student.grade);
                const progressPct = Math.min(
                  100,
                  Math.round((student.questionIndex / Math.max(1, student.totalQuestions)) * 100)
                );

                return (
                  <motion.div
                    key={student.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#121c21] hover:bg-[#17242b] border border-[#26353d] p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono transition-colors"
                  >
                    {/* Rank + Student Identity */}
                    <div className="flex items-center gap-3 min-w-[220px] flex-1">
                      <div
                        className={cn(
                          'w-8 h-8 flex items-center justify-center font-black text-xs border shrink-0',
                          rankIdx === 0
                            ? 'bg-amber-500 text-slate-950 border-amber-300'
                            : rankIdx === 1
                            ? 'bg-slate-300 text-slate-950 border-white'
                            : rankIdx === 2
                            ? 'bg-amber-700 text-white border-amber-500'
                            : 'bg-[#0b1114] text-slate-400 border-[#26353d]'
                        )}
                      >
                        #{rankIdx + 1}
                      </div>

                      <span className="text-2xl p-1 bg-[#0b1114] border border-[#26353d] shrink-0">
                        {student.avatar}
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm truncate">
                            {student.name}
                          </span>
                          <span className="text-[10px] text-amber-400 font-bold">
                            [{student.camNumber}]
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {student.email}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full sm:w-52 flex flex-col gap-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400">Avance de Partida:</span>
                        <span className="text-amber-300 font-bold">
                          {student.questionIndex} / {student.totalQuestions} ({progressPct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#0b1114] overflow-hidden p-0.5 border border-[#26353d]">
                        <div
                          className={cn(
                            'h-full transition-all duration-500',
                            student.isVictory
                              ? 'bg-[#22e584]'
                              : student.isGameOver
                              ? 'bg-red-500'
                              : 'bg-amber-400'
                          )}
                          style={{ width: `${Math.max(6, progressPct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Current Status & Quick Camera Jump */}
                    <div className="flex items-center gap-2 min-w-[180px]">
                      <span className="px-2.5 py-1 bg-[#0b1114] border border-[#26353d] text-slate-200 text-[11px] font-bold">
                        {student.statusText}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          playBalatroSound('select');
                          setFocusedStudentId(student.id);
                          setViewMode('cameras');
                        }}
                        className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 text-[10px] font-bold uppercase cursor-pointer flex items-center gap-1"
                        title="Ver cámara individual del estudiante"
                      >
                        <Video size={12} />
                        <span>Ver Cam</span>
                      </button>
                    </div>

                    {/* Live Grade (0-100) */}
                    <div className="flex items-center gap-3 min-w-[175px] justify-end">
                      <span className={cn('px-2 py-0.5 border text-[10px] font-bold', badge.color)}>
                        {badge.label}
                      </span>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 block leading-none">
                          NOTA
                        </span>
                        <strong className="text-base font-black text-amber-300">
                          {student.grade}
                          <span className="text-[10px] text-slate-500">/100</span>
                        </strong>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* -----------------------------------------------------------------
            MODE C: GENERAL MATCH BOARD STAGE ("PARTIDA")
        ----------------------------------------------------------------- */}
        {viewMode === 'stage' && customSpectatorStage && (
          <div className="flex-1 w-full h-full relative overflow-hidden bg-[#070c0f] flex flex-col">
            {customSpectatorStage}
          </div>
        )}

        {/* Bottom Strict Non-Participation Notice Footer */}
        <div className="pt-2.5 border-t border-[#26353d] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-amber-400" />
            <span>
              Rol Docente Activo: Vista exclusiva de supervisión por cámaras y tabla de calificaciones (sin botones de respuesta).
            </span>
          </span>
          <AulaPlayLogo size="xs" theme="amber" />
        </div>
      </main>
    </div>
  );
};
