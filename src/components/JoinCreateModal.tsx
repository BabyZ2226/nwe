import React, { useState, useEffect } from 'react';
import {
  Plus,
  LogIn,
  X,
  Shield,
  GraduationCap,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Mail,
} from 'lucide-react';
import { motion } from 'motion/react';
import { playBalatroSound } from '../lib/soundEffects';
import { cn } from '../lib/utils';
import { EducationalGameType } from '../types';
import {
  initAuth,
  signInWithGoogle,
  linkGoogleEmailDirectly,
  logoutGoogle,
  getCachedGoogleUser,
  getOrCreateDeviceUid,
  GoogleUserSession,
} from '../lib/firebaseAuth';
import {
  HeatGuardianLobbyShell,
  HeatGuardianMenuItem,
} from './HeatGuardianBackdrop';

interface JoinCreateModalProps {
  initialCode?: string;
  initialRoomName?: string;
  defaultMode?: 'create' | 'join';
  userRole?: 'teacher' | 'student' | null;
  currentGameType?: EducationalGameType;
  isLoading?: boolean;
  errorMessage?: string | null;
  onClearError?: () => void;
  onClose: () => void;
  onCreateRoom: (
    playerName: string,
    avatar: string,
    botCount: number,
    maxPlayers: number,
    roomName?: string,
    gameType?: EducationalGameType,
    googleEmail?: string,
    googleUid?: string
  ) => void;
  onJoinRoom: (
    roomCode: string,
    playerName: string,
    avatar: string,
    googleEmail?: string,
    googleUid?: string
  ) => void;
}

export function JoinCreateModal({
  initialCode = '',
  initialRoomName = '',
  defaultMode = 'create',
  userRole = null,
  currentGameType = 'escape_room',
  isLoading = false,
  errorMessage = null,
  onClearError,
  onClose,
  onCreateRoom,
  onJoinRoom,
}: JoinCreateModalProps) {
  const [mode, setMode] = useState<'create' | 'join'>(
    userRole === 'teacher' ? 'create' : userRole === 'student' ? 'join' : defaultMode
  );
  const [selectedGame, setSelectedGame] = useState<EducationalGameType>(currentGameType);
  const [roomName, setRoomName] = useState(
    initialRoomName ||
      (currentGameType === 'cien_latinos'
        ? '100 Latinos Dicen: Duelo por Equipos'
        : currentGameType === 'escape_room'
        ? 'Escape Room Educativo de la Clase'
        : currentGameType === 'el_impostor'
        ? 'Debate: El Impostor en Clase'
        : currentGameType === 'geografia_3d'
        ? 'Atlas 3D: Geografía en Clase'
        : 'Sala de Póker del Octeto')
  );
  const [joinCode, setJoinCode] = useState(initialCode);
  const [playerName, setPlayerName] = useState(
    () =>
      localStorage.getItem('po_player_name') ||
      (userRole === 'teacher' ? 'Profesor' : 'Estudiante')
  );
  const [avatar] = useState(
    () =>
      localStorage.getItem('po_player_avatar') ||
      (userRole === 'teacher' ? '👨‍🏫' : '🧑‍🎓')
  );

  const [googleUser, setGoogleUser] = useState<GoogleUserSession | null>(() =>
    getCachedGoogleUser()
  );
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showDirectEmailInput, setShowDirectEmailInput] = useState(false);
  const [directEmail, setDirectEmail] = useState('');
  const [emailInputError, setEmailInputError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = initAuth((user) => {
      setGoogleUser(user);
      if (
        user.displayName &&
        (!playerName || playerName === 'Marie Curie' || playerName === 'Profesor')
      ) {
        setPlayerName(user.displayName);
      }
    });
    return () => unsub();
  }, []);

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    setEmailInputError(null);
    try {
      const user = await signInWithGoogle();
      setGoogleUser(user);
      setShowDirectEmailInput(false);
      if (user.displayName) setPlayerName(user.displayName);
      playBalatroSound('select');
    } catch {
      setShowDirectEmailInput(true);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDirectEmailSubmit = () => {
    const trimmed = directEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setEmailInputError('Ingresa un correo válido (ej. usuario@gmail.com)');
      return;
    }
    setEmailInputError(null);
    const session = linkGoogleEmailDirectly(trimmed, playerName);
    setGoogleUser(session);
    setShowDirectEmailInput(false);
    playBalatroSound('select');
  };

  const handleLogoutGoogle = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setDirectEmail('');
  };

  const handleModeChange = (newMode: 'create' | 'join') => {
    playBalatroSound('deal');
    setMode(newMode);
  };

  const resolveActiveGoogleSession = (): GoogleUserSession | null => {
    if (googleUser) return googleUser;
    if (directEmail.trim().includes('@')) {
      const session = linkGoogleEmailDirectly(directEmail.trim(), playerName);
      setGoogleUser(session);
      return session;
    }
    return null;
  };

  const handleCreate = () => {
    const currentGUser = resolveActiveGoogleSession();
    const finalName =
      playerName.trim() || (userRole === 'teacher' ? 'Profesor' : 'Científico');
    playBalatroSound('play');
    localStorage.setItem('po_player_name', finalName);
    localStorage.setItem('po_player_avatar', avatar);
    onCreateRoom(
      finalName,
      avatar,
      0,
      16,
      roomName,
      selectedGame,
      currentGUser?.email || undefined,
      currentGUser?.uid || getOrCreateDeviceUid()
    );
  };

  const handleJoin = () => {
    if (!joinCode.trim()) return;

    const currentGUser = resolveActiveGoogleSession();
    const finalName = playerName.trim() || 'Estudiante';

    playBalatroSound('play');
    localStorage.setItem('po_player_name', finalName);
    localStorage.setItem('po_player_avatar', avatar);
    onJoinRoom(
      joinCode.trim(),
      finalName,
      avatar,
      currentGUser?.email || undefined,
      currentGUser?.uid || getOrCreateDeviceUid()
    );
  };

  const renderGoogleAuthSection = (roleLabel: string) => {
    if (googleUser) {
      return (
        <div className="p-3 bg-[#121c21] border border-emerald-500/50 text-emerald-200 font-mono text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <CheckCircle2 size={16} className="text-[#22e584] shrink-0" />
            <span className="truncate">
              {roleLabel}: <strong className="text-white">{googleUser.email}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogoutGoogle}
            className="text-[10px] text-amber-300 hover:text-white underline font-bold uppercase tracking-wider shrink-0 ml-2 cursor-pointer"
          >
            Cambiar
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {!showDirectEmailInput ? (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isSigningIn}
              className="w-full py-2.5 bg-[#121c21] hover:bg-[#18262d] border border-[#2a3b44] text-slate-100 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 cursor-pointer transition-all"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isSigningIn ? 'Conectando...' : 'Vincular Cuenta de Google'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowDirectEmailInput(true)}
              className="text-[10px] font-mono text-slate-400 hover:text-amber-300 underline text-center cursor-pointer"
            >
              ¿No abre la ventana emergente? Ingresa tu correo Gmail aquí
            </button>
          </div>
        ) : (
          <div className="p-3 bg-[#121c21] border border-amber-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Mail size={13} className="text-amber-400" />
                <span>Correo de Google / Institucional:</span>
              </label>
              <button
                type="button"
                onClick={() => setShowDirectEmailInput(false)}
                className="text-[10px] font-mono text-slate-400 hover:text-white underline cursor-pointer"
              >
                Cancelar
              </button>
            </div>
            <div className="flex gap-1.5">
              <input
                type="email"
                value={directEmail}
                onChange={(e) => {
                  setDirectEmail(e.target.value);
                  setEmailInputError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleDirectEmailSubmit();
                  }
                }}
                placeholder="tu.correo@gmail.com"
                className="flex-1 bg-[#0b1114] border border-[#26353d] px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={handleDirectEmailSubmit}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-wider text-xs cursor-pointer shrink-0"
              >
                Vincular
              </button>
            </div>
            {emailInputError && (
              <span className="text-[10px] font-mono text-rose-400 block">
                {emailInputError}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const atmosphereVariant =
    selectedGame === 'cien_latinos'
      ? 'golden_ember'
      : selectedGame === 'geografia_3d'
      ? 'arctic_cyan'
      : selectedGame === 'escape_room' || selectedGame === 'el_impostor'
      ? 'crimson_mist'
      : 'frost_amber';

  const menuItems: HeatGuardianMenuItem[] = [
    {
      id: 'primary_action',
      label: mode === 'create' ? 'ABRIR SALA' : 'CONECTAR',
      isPrimary: true,
      disabled: mode === 'join' && (isLoading || !joinCode.trim()),
      onClick: () => {
        if (mode === 'create') {
          handleCreate();
        } else {
          handleJoin();
        }
      },
    },
    {
      id: 'mode_create',
      label: 'CREAR SALA',
      active: mode === 'create',
      badge: 'DOCENTE',
      onClick: () => handleModeChange('create'),
    },
    ...(userRole !== 'teacher'
      ? [
          {
            id: 'mode_join',
            label: 'UNIRSE CON PIN',
            active: mode === 'join',
            badge: 'ALUMNO',
            onClick: () => handleModeChange('join'),
          },
        ]
      : []),
    {
      id: 'close_modal',
      label: 'SALIR',
      isDanger: true,
      onClick: onClose,
    },
  ];

  const GAME_OPTIONS: {
    id: EducationalGameType;
    icon: string;
    title: string;
    subtitle: string;
    defaultRoom: string;
  }[] = [
    {
      id: 'cien_latinos',
      icon: '🎤',
      title: '100 Latinos Dicen',
      subtitle: 'Duelo por Equipos + Biblioteca IA',
      defaultRoom: '100 Latinos Dicen: Duelo por Equipos',
    },
    {
      id: 'escape_room',
      icon: '🔐',
      title: 'Escape Room Educativo',
      subtitle: '10 Cámaras · Cualquier Asignatura',
      defaultRoom: 'Escape Room Educativo de la Clase',
    },
    {
      id: 'el_impostor',
      icon: '🕵️',
      title: 'El Impostor',
      subtitle: 'Individual · Verdades y Mentira',
      defaultRoom: 'Debate: El Impostor en Clase',
    },
    {
      id: 'geografia_3d',
      icon: '🌍',
      title: 'Globo Terráqueo 3D',
      subtitle: 'Adivina el País y Localiza en 3D',
      defaultRoom: 'Atlas 3D: Geografía en Clase',
    },
    {
      id: 'poker_quimico',
      icon: '🧪',
      title: 'Póker del Octeto',
      subtitle: 'Química · Enlaces y Valencia',
      defaultRoom: 'Sala de Póker del Octeto',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto select-none">
      <HeatGuardianLobbyShell
        titleLine1={mode === 'create' ? 'CREAR' : 'UNIRSE'}
        titleLine2="SALA"
        subtitleBadge={
          mode === 'create'
            ? 'SALA DOCENTE · PIN & QR EN VIVO'
            : 'ACCESO ESTUDIANTE · PIN DE CLASE'
        }
        menuItems={menuItems}
        footerCredit="AULAPLAY · SALAS EN VIVO"
        variant={atmosphereVariant}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl bg-[#0b1114]/92 border-2 border-[#26353d] shadow-[0_24px_60px_rgba(0,0,0,0.88)] backdrop-blur-md text-slate-100 max-h-[85vh] flex flex-col overflow-hidden my-auto"
        >
          {/* Top Monolith Header with Mode Switcher & Close Button */}
          <div className="px-5 py-3.5 bg-[#121c21] border-b border-[#26353d] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleModeChange('create')}
                className={cn(
                  'px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.16em] border flex items-center gap-1.5 cursor-pointer transition-all',
                  mode === 'create'
                    ? 'bg-amber-500 text-slate-950 border-amber-300'
                    : 'bg-[#0b1114] text-slate-300 border-[#26353d] hover:text-white'
                )}
              >
                <GraduationCap size={14} />
                <span>Crear Sala</span>
              </button>

              {userRole !== 'teacher' && (
                <button
                  type="button"
                  onClick={() => handleModeChange('join')}
                  className={cn(
                    'px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.16em] border flex items-center gap-1.5 cursor-pointer transition-all',
                    mode === 'join'
                      ? 'bg-amber-500 text-slate-950 border-amber-300'
                      : 'bg-[#0b1114] text-slate-300 border-[#26353d] hover:text-white'
                  )}
                >
                  <UserCheck size={14} />
                  <span>Unirse con PIN</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                playBalatroSound('click');
                onClose();
              }}
              title="Cerrar menú de sala"
              className="px-2.5 py-1 bg-[#0b1114] hover:bg-rose-950/80 border border-[#26353d] hover:border-rose-500/60 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
            >
              <X size={15} />
              <span>Cerrar</span>
            </button>
          </div>

          {/* Main Body */}
          {mode === 'create' ? (
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 max-h-[calc(85vh-60px)]">
              <div className="flex items-center justify-between border-b border-[#223038] pb-3">
                <div>
                  <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white">
                    Crear Sala de Clase
                  </h2>
                  <p className="text-xs text-slate-400">
                    Proyecta el código PIN o QR para que tus estudiantes se unan al instante.
                  </p>
                </div>
              </div>

              {/* Google Account Linking */}
              {renderGoogleAuthSection('Docente')}

              {/* Game Type Selector Grid */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">
                  Juego Didáctico:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {GAME_OPTIONS.map((g, idx) => {
                    const isSelected = selectedGame === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setSelectedGame(g.id);
                          if (!initialRoomName) {
                            setRoomName(g.defaultRoom);
                          }
                          playBalatroSound('select');
                        }}
                        className={cn(
                          'p-2.5 text-left border transition-all cursor-pointer flex items-center justify-between gap-2',
                          idx === GAME_OPTIONS.length - 1 && 'sm:col-span-2',
                          isSelected
                            ? 'bg-[#17262e] border-amber-400 text-white shadow-[inset_0_0_0_1px_rgba(251,191,36,0.35)]'
                            : 'bg-[#121c21] border-[#26353d] text-slate-300 hover:border-slate-500 hover:text-white'
                        )}
                      >
                        <div className="min-w-0">
                          <div className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                            <span>{g.icon}</span>
                            <span className="truncate">{g.title}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 block truncate">
                            {g.subtitle}
                          </span>
                        </div>
                        <span
                          className={cn(
                            'text-xs shrink-0',
                            isSelected ? 'text-amber-400' : 'opacity-25'
                          )}
                        >
                          ▶
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Room Title & Host Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1">
                    Título de la Sala:
                  </label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Nombre de la sala..."
                    className="w-full bg-[#121c21] border border-[#26353d] focus:border-amber-400 px-3 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1">
                    Tu Nombre (Docente):
                  </label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    maxLength={22}
                    placeholder="Ej: Prof. García"
                    className="w-full bg-[#121c21] border border-[#26353d] focus:border-amber-400 px-3 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Primary CTA */}
              <button
                type="button"
                onClick={handleCreate}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Plus size={16} />
                <span>Crear Sala de Clase ▶</span>
              </button>
            </div>
          ) : (
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 max-h-[calc(85vh-60px)]">
              <div className="border-b border-[#223038] pb-3">
                <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white">
                  Unirse a una Sala
                </h2>
                <p className="text-xs text-slate-400">
                  Ingresa el código PIN proyectado por tu docente.
                </p>
              </div>

              {/* Google Account Linking for Student */}
              {renderGoogleAuthSection('Estudiante')}

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Tu Nombre:
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={22}
                  placeholder="Tu nombre y apellido..."
                  className="w-full bg-[#121c21] border border-[#26353d] focus:border-amber-400 px-3 py-2 text-sm font-bold text-white focus:outline-none"
                />
              </div>

              <div className="p-4 bg-[#121c21] border border-[#26353d] text-center space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                  Código PIN de la Sala:
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(e.target.value.toUpperCase());
                    if (errorMessage && onClearError) onClearError();
                  }}
                  placeholder="123456"
                  maxLength={10}
                  className="w-full max-w-[220px] text-center font-mono text-2xl font-black tracking-widest bg-[#0b1114] border-2 border-[#2a3b44] focus:border-amber-400 px-3 py-2 text-white focus:outline-none"
                />
              </div>

              {errorMessage && (
                <div className="p-2.5 bg-rose-950/90 border border-rose-500 text-rose-200 font-mono text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleJoin}
                disabled={isLoading || !joinCode.trim()}
                className={cn(
                  'w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md',
                  isLoading && 'opacity-75 cursor-wait'
                )}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <LogIn size={16} />
                )}
                <span>
                  {isLoading ? 'Conectando...' : 'Unirse a la Partida ▶'}
                </span>
              </button>
            </div>
          )}
        </motion.div>
      </HeatGuardianLobbyShell>
    </div>
  );
}
