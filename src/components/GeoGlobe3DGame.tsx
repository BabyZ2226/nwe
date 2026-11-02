import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Globe, { GlobeInstance } from 'globe.gl';
import {
  Globe as GlobeIcon,
  Compass,
  MapPin,
  Trophy,
  Flame,
  SkipForward,
  CheckCircle2,
  XCircle,
  Send,
  RotateCcw,
  Home,
  QrCode,
  Users,
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
  ChevronDown,
  ChevronUp,
  Heart,
  Keyboard,
  ListChecks,
  Settings,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { GamePlayer, RoomState } from '../types';
import {
  ParsedCountry,
  GeoCountryFeature,
  parseGeoJsonCountries,
  generateSameContinentOptions,
  isCountryAnswerCorrect,
} from '../lib/geoGlobeEngine';
import { MatchStartCountdown } from './MatchStartCountdown';
import { QRCodeModal } from './QRCodeModal';
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

export type GlobePlayMode = 'menu' | 'guess_country' | 'locate_country';
export type GuessInputMethod = 'multiple_choice' | 'free_text';

interface GeoGlobe3DGameProps {
  players: GamePlayer[];
  currentUserId: string;
  isTeacherSpectator?: boolean;
  isSoloPractice?: boolean;
  room?: RoomState | null;
  onGoHome: () => void;
}

/**
 * Generates a high-resolution procedural ocean & bathymetry grid texture in a 2D Canvas
 * so the 3D globe never relies on fragile external image URLs.
 */
function createProceduralOceanDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#071426');
  grad.addColorStop(0.25, '#0b223e');
  grad.addColorStop(0.5, '#0e2d52');
  grad.addColorStop(0.75, '#0b223e');
  grad.addColorStop(1, '#071426');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle cartographic meridians & parallels
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.10)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Equator highlight
  ctx.strokeStyle = 'rgba(34, 229, 132, 0.18)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

export const GeoGlobe3DGame: React.FC<GeoGlobe3DGameProps> = ({
  players,
  currentUserId,
  isTeacherSpectator = false,
  isSoloPractice = false,
  room,
  onGoHome,
}) => {
  // Pre-game Waiting Room / Lobby vs Active 3D Globe
  const [gamePhase, setGamePhase] = useState<'lobby' | 'playing'>(() =>
    isSoloPractice && !room ? 'playing' : 'lobby'
  );
  const [isCountdownActive, setIsCountdownActive] = useState<boolean>(false);

  // Lobby UI State
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isTeacherConfigOpen, setIsTeacherConfigOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(isSfxMuted());
  const [currentTheme, setCurrentTheme] = useState<'neon' | 'dungeon' | 'cyber'>('cyber');
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  // Teacher Pre-game Configuration State for 3D Geography Globe
  const [continentFilter, setContinentFilter] = useState<
    'ALL' | 'Americas' | 'Europe' | 'Asia' | 'Africa' | 'Oceania'
  >('ALL');
  const [defaultStartMode, setDefaultStartMode] = useState<GlobePlayMode>('menu');
  const [allowedInputMode, setAllowedInputMode] = useState<'both' | 'multiple_choice' | 'free_text'>('both');
  const [configuredMaxAttempts, setConfiguredMaxAttempts] = useState<number>(3);
  const [countryTimeLimitSecs, setCountryTimeLimitSecs] = useState<number>(0); // 0 = Sin límite
  const [countrySecondsLeft, setCountrySecondsLeft] = useState<number>(0);
  const [allowSkipButton, setAllowSkipButton] = useState<boolean>(true);
  const [showContinentHint, setShowContinentHint] = useState<boolean>(true);

  // GeoJSON Countries Dataset State
  const [countries, setCountries] = useState<ParsedCountry[]>([]);
  const [isLoadingGeo, setIsLoadingGeo] = useState<boolean>(true);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Game Mode & Difficulty State
  const [playMode, setPlayMode] = useState<GlobePlayMode>('menu');
  const [inputMethod, setInputMethod] = useState<GuessInputMethod>('multiple_choice');
  const [isHudCollapsed, setIsHudCollapsed] = useState<boolean>(false);

  // Active Round State
  const [targetCountry, setTargetCountry] = useState<ParsedCountry | null>(null);
  const [multipleChoiceOptions, setMultipleChoiceOptions] = useState<ParsedCountry[]>([]);
  const [freeTextInput, setFreeTextInput] = useState<string>('');
  const [attemptsLeft, setAttemptsLeft] = useState<number>(3);
  const [roundResolved, setRoundResolved] = useState<boolean>(false);

  // Polygon visual states
  const [hoveredFeature, setHoveredFeature] = useState<GeoCountryFeature | null>(null);
  const [correctCountryId, setCorrectCountryId] = useState<string | null>(null);
  const [wrongCountryIds, setWrongCountryIds] = useState<string[]>([]);

  // Scoreboard & Feedback State
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem('po_geoglobe_high_score');
    return saved ? parseInt(saved, 10) || 0 : 0;
  });
  const [bestStreak, setBestStreak] = useState<number>(() => {
    const saved = localStorage.getItem('po_geoglobe_best_streak');
    return saved ? parseInt(saved, 10) || 0 : 0;
  });
  const [roundsPlayed, setRoundsPlayed] = useState<number>(0);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'correct' | 'wrong' | 'skipped';
    title: string;
    subtitle: string;
  } | null>(null);

  // WebGL Globe Ref
  const globeContainerRef = useRef<HTMLDivElement | null>(null);
  const globeInstanceRef = useRef<GlobeInstance | null>(null);

  // Keep latest mutable refs for Globe callbacks so WebGL canvas never re-initializes
  const playModeRef = useRef<GlobePlayMode>(playMode);
  playModeRef.current = playMode;
  const targetCountryRef = useRef<ParsedCountry | null>(targetCountry);
  targetCountryRef.current = targetCountry;
  const roundResolvedRef = useRef<boolean>(roundResolved);
  roundResolvedRef.current = roundResolved;
  const countriesMapRef = useRef<Map<GeoCountryFeature, ParsedCountry>>(new Map());

  const isHost = room ? room.hostId === currentUserId : true;
  const effectiveIsTeacher = Boolean(
    isTeacherSpectator ||
      (room && room.hostIsSpectator && room.hostId === currentUserId) ||
      (typeof window !== 'undefined' && localStorage.getItem('po_user_role') === 'teacher')
  );
  const roomCode = room?.code || (isSoloPractice ? 'SOLO' : 'GEO360');

  // Strictly filter out teacher spectators from student list
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
        25,
        'Atlas 3D: Geografía Mundial',
        isTeacherSpectator,
        'geografia_3d'
      );
    }
  }, [room, isTeacherSpectator, isSoloPractice]);

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

  // Load GeoJSON Countries Dataset
  useEffect(() => {
    let cancelled = false;
    async function loadGeoData() {
      setIsLoadingGeo(true);
      setGeoError(null);
      try {
        let res = await fetch('/datasets/countries.geojson');
        if (!res.ok) {
          res = await fetch(
            'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson'
          );
        }
        const data = await res.json();
        if (cancelled) return;
        const parsed = parseGeoJsonCountries(data.features || []);
        const map = new Map<GeoCountryFeature, ParsedCountry>();
        parsed.forEach((c) => map.set(c.feature, c));
        countriesMapRef.current = map;
        setCountries(parsed);
      } catch {
        if (!cancelled) {
          setGeoError('No se pudo cargar el archivo GeoJSON de países.');
        }
      } finally {
        if (!cancelled) setIsLoadingGeo(false);
      }
    }
    loadGeoData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Update High Score & Best Streak in localStorage
  const registerPointsAndStreak = useCallback(
    (pointsEarned: number, newStreak: number) => {
      setCurrentScore((prev) => {
        const updated = prev + pointsEarned;
        if (updated > highScore) {
          setHighScore(updated);
          localStorage.setItem('po_geoglobe_high_score', String(updated));
        }
        return updated;
      });
      setCurrentStreak(newStreak);
      if (newStreak > bestStreak) {
        setBestStreak(newStreak);
        localStorage.setItem('po_geoglobe_best_streak', String(newStreak));
      }
    },
    [highScore, bestStreak]
  );

  // Filtered Country Pool according to Teacher's Continent Filter
  const filteredCountriesPool = useMemo(() => {
    if (continentFilter === 'ALL') return countries;
    if (continentFilter === 'Americas') {
      return countries.filter(
        (c) => c.continentEn === 'North America' || c.continentEn === 'South America'
      );
    }
    return countries.filter((c) => c.continentEn === continentFilter);
  }, [countries, continentFilter]);

  // Sync inputMethod when teacher restricts allowedInputMode
  useEffect(() => {
    if (allowedInputMode === 'multiple_choice') {
      setInputMethod('multiple_choice');
    } else if (allowedInputMode === 'free_text') {
      setInputMethod('free_text');
    }
  }, [allowedInputMode]);

  // Pick a random country and configure the round
  const startNextCountryRound = useCallback(
    (modeOverride?: GlobePlayMode, customPool?: ParsedCountry[]) => {
      const basePool = customPool || (filteredCountriesPool.length > 0 ? filteredCountriesPool : countries);
      if (basePool.length === 0) return;

      const activeMode = modeOverride || playModeRef.current;
      const randomCountry = basePool[Math.floor(Math.random() * basePool.length)];

      setTargetCountry(randomCountry);
      setMultipleChoiceOptions(generateSameContinentOptions(randomCountry, countries.length > 0 ? countries : basePool));
      setFreeTextInput('');
      setAttemptsLeft(configuredMaxAttempts);
      setCountrySecondsLeft(countryTimeLimitSecs);
      setRoundResolved(false);
      setCorrectCountryId(null);
      setWrongCountryIds([]);
      setFeedbackBanner(null);

      // Camera choreography depending on mode
      if (globeInstanceRef.current) {
        const controls = globeInstanceRef.current.controls();
        if (controls) {
          controls.autoRotate = false;
        }
        if (activeMode === 'guess_country') {
          // Mode 1: Fly smoothly & zoom to the mystery country
          globeInstanceRef.current.pointOfView(
            {
              lat: randomCountry.lat,
              lng: randomCountry.lng,
              altitude: randomCountry.cameraAltitude,
            },
            1350
          );
        } else if (activeMode === 'locate_country') {
          // Mode 2: Keep a comfortable global altitude so player can rotate & search
          const currentPov = globeInstanceRef.current.pointOfView();
          globeInstanceRef.current.pointOfView(
            {
              lat: currentPov.lat || 15,
              lng: currentPov.lng || 0,
              altitude: 1.85,
            },
            900
          );
        }
      }
    },
    [countries, filteredCountriesPool, configuredMaxAttempts, countryTimeLimitSecs]
  );

  // Per-country countdown timer if teacher configured countryTimeLimitSecs > 0
  useEffect(() => {
    if (
      gamePhase !== 'playing' ||
      isCountdownActive ||
      playMode === 'menu' ||
      roundResolved ||
      !targetCountry ||
      countryTimeLimitSecs <= 0
    ) {
      return;
    }

    const interval = setInterval(() => {
      setCountrySecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          playBalatroSound('hover');
          setCurrentStreak(0);
          setCorrectCountryId(targetCountry.id);
          setRoundResolved(true);
          setRoundsPlayed((r) => r + 1);
          setFeedbackBanner({
            type: 'wrong',
            title: `⏱️ ¡Tiempo agotado! Era ${targetCountry.nameEs}`,
            subtitle: `Continente: ${targetCountry.continentEs} · Pulsa «Siguiente» para continuar.`,
          });
          globeInstanceRef.current?.pointOfView(
            {
              lat: targetCountry.lat,
              lng: targetCountry.lng,
              altitude: targetCountry.cameraAltitude,
            },
            1100
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gamePhase, isCountdownActive, playMode, roundResolved, targetCountry, countryTimeLimitSecs]);

  // Handle polygon click in Mode 2 ("LOCALIZA EL PAÍS")
  const handlePolygonClickRef = useRef<(feature: GeoCountryFeature) => void>(() => {});
  handlePolygonClickRef.current = (feature: GeoCountryFeature) => {
    const clickedCountry = countriesMapRef.current.get(feature);
    if (!clickedCountry) return;

    // If in menu, fly to clicked country and show its name
    if (playModeRef.current === 'menu') {
      playBalatroSound('select');
      globeInstanceRef.current?.pointOfView(
        {
          lat: clickedCountry.lat,
          lng: clickedCountry.lng,
          altitude: clickedCountry.cameraAltitude,
        },
        1000
      );
      setFeedbackBanner({
        type: 'correct',
        title: `${clickedCountry.nameEs}`,
        subtitle: `Continente: ${clickedCountry.continentEs}`,
      });
      return;
    }

    // In Mode 1 ("Adivina el País"), clicking the highlighted country re-centers camera
    if (playModeRef.current === 'guess_country') {
      if (targetCountryRef.current) {
        globeInstanceRef.current?.pointOfView(
          {
            lat: targetCountryRef.current.lat,
            lng: targetCountryRef.current.lng,
            altitude: targetCountryRef.current.cameraAltitude,
          },
          900
        );
      }
      return;
    }

    // In Mode 2 ("Localiza el País")
    if (playModeRef.current === 'locate_country') {
      const target = targetCountryRef.current;
      if (!target || roundResolvedRef.current) return;

      if (clickedCountry.id === target.id) {
        // CORRECT LOCATION! Paint green
        playBalatroSound('play');
        setCorrectCountryId(target.id);
        setRoundResolved(true);
        setRoundsPlayed((r) => r + 1);

        const bonus = attemptsLeft * 50;
        const pointsEarned = 100 + bonus;
        const nextStreak = currentStreak + 1;
        registerPointsAndStreak(pointsEarned, nextStreak);

        setFeedbackBanner({
          type: 'correct',
          title: `¡Correcto! Encontraste ${target.nameEs}`,
          subtitle: `+${pointsEarned} pts · Continente: ${target.continentEs} · Racha: ${nextStreak}`,
        });

        globeInstanceRef.current?.pointOfView(
          {
            lat: target.lat,
            lng: target.lng,
            altitude: target.cameraAltitude,
          },
          1100
        );

        if (nextStreak % 3 === 0) {
          confetti({ particleCount: 70, spread: 65, origin: { y: 0.65 } });
        }
      } else {
        // WRONG COUNTRY CLICKED! Paint red & deduct attempt
        playBalatroSound('hover');
        setWrongCountryIds((prev) =>
          prev.includes(clickedCountry.id) ? prev : [...prev, clickedCountry.id]
        );

        const remaining = attemptsLeft - 1;
        setAttemptsLeft(remaining);
        setCurrentStreak(0);

        if (remaining <= 0) {
          // Out of attempts: reveal where the target country was
          setRoundResolved(true);
          setCorrectCountryId(target.id);
          setRoundsPlayed((r) => r + 1);
          setFeedbackBanner({
            type: 'wrong',
            title: `Incorrecto, tocaste ${clickedCountry.nameEs}`,
            subtitle: `Sin intentos restantes. Aquí se ubica ${target.nameEs} (${target.continentEs}).`,
          });
          globeInstanceRef.current?.pointOfView(
            {
              lat: target.lat,
              lng: target.lng,
              altitude: target.cameraAltitude,
            },
            1350
          );
        } else {
          setFeedbackBanner({
            type: 'wrong',
            title: `Incorrecto, ese país era ${clickedCountry.nameEs}`,
            subtitle: `Sigue buscando ${target.nameEs} (${target.continentEs}) · Te quedan ${remaining} ${
              remaining === 1 ? 'intento' : 'intentos'
            }.`,
          });
        }
      }
    }
  };

  // Initialize 3D Globe once when entering 'playing' phase
  useEffect(() => {
    if (gamePhase !== 'playing' || isLoadingGeo || countries.length === 0) return;
    const container = globeContainerRef.current;
    if (!container) return;

    const oceanTextureUrl = createProceduralOceanDataUrl();
    const globe = new Globe(container)
      .globeImageUrl(oceanTextureUrl)
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor('#38bdf8')
      .atmosphereAltitude(0.18)
      .polygonsData(countries.map((c) => c.feature))
      .polygonStrokeColor(() => '#0f172a')
      .polygonSideColor(() => 'rgba(15, 23, 42, 0.65)')
      .polygonLabel((feat: object) => {
        const f = feat as GeoCountryFeature;
        const c = countriesMapRef.current.get(f);
        if (!c) return '';
        // In "guess_country" or "locate_country", DO NOT leak the country name on hover before round is resolved!
        if (playModeRef.current !== 'menu' && !roundResolvedRef.current) {
          return `<div style="background: rgba(15,23,42,0.92); border: 1px solid rgba(56,189,248,0.4); padding: 4px 8px; border-radius: 6px; font-family: sans-serif; font-size: 11px; color: #e2e8f0;">
            ${
              playModeRef.current === 'locate_country'
                ? 'Haz clic para seleccionar este país'
                : '¿Qué país es?'
            }
          </div>`;
        }
        return `<div style="background: rgba(15,23,42,0.94); border: 1px solid rgba(34,229,132,0.5); padding: 6px 10px; border-radius: 8px; font-family: sans-serif; font-size: 12px; color: #f8fafc; font-weight: 700;">
          🌍 ${c.nameEs} <span style="font-weight: 400; color: #94a3b8; font-size: 11px;">(${c.continentEs})</span>
        </div>`;
      })
      .onPolygonHover((hoverObj: object | null) => {
        const feat = (hoverObj as GeoCountryFeature) || null;
        setHoveredFeature(feat);
        if (container) {
          container.style.cursor = feat ? 'pointer' : 'grab';
        }
      })
      .onPolygonClick((clickedObj: object) => {
        if (clickedObj) {
          handlePolygonClickRef.current(clickedObj as GeoCountryFeature);
        }
      });

    // Enable smooth OrbitControls rotation & zoom
    const controls = globe.controls();
    if (controls) {
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.rotateSpeed = 0.75;
      controls.zoomSpeed = 0.9;
      controls.minDistance = 125;
      controls.maxDistance = 420;
      controls.autoRotate = playModeRef.current === 'menu';
      controls.autoRotateSpeed = 0.45;
    }

    globe.pointOfView({ lat: 18, lng: -25, altitude: 2.0 });
    globeInstanceRef.current = globe;

    const handleResize = () => {
      if (globeContainerRef.current && globeInstanceRef.current) {
        globeInstanceRef.current
          .width(globeContainerRef.current.clientWidth)
          .height(globeContainerRef.current.clientHeight);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (globeInstanceRef.current) {
        globeInstanceRef.current._destructor?.();
        globeInstanceRef.current = null;
      }
    };
  }, [gamePhase, isLoadingGeo, countries]);

  // Dynamically update polygon colors and altitudes when state changes
  useEffect(() => {
    const globe = globeInstanceRef.current;
    if (!globe) return;

    globe
      .polygonAltitude((feat: object) => {
        const f = feat as GeoCountryFeature;
        const c = countriesMapRef.current.get(f);
        if (!c) return 0.01;
        if (correctCountryId === c.id) return 0.06;
        if (playMode === 'guess_country' && targetCountry?.id === c.id) return 0.055;
        if (wrongCountryIds.includes(c.id)) return 0.03;
        if (hoveredFeature === f) return 0.028;
        return 0.012;
      })
      .polygonCapColor((feat: object) => {
        const f = feat as GeoCountryFeature;
        const c = countriesMapRef.current.get(f);
        if (!c) return '#1e293b';

        // 1. Confirmed Correct Country (Vibrant Emerald Green)
        if (correctCountryId === c.id) {
          return '#10b981';
        }

        // 2. Wrongly clicked or guessed Country (Vibrant Crimson Red)
        if (wrongCountryIds.includes(c.id)) {
          return '#ef4444';
        }

        // 3. Mode 1 ("Adivina el País"): Highlight the mystery country in bright Gold/Amber
        if (playMode === 'guess_country' && targetCountry?.id === c.id) {
          return hoveredFeature === f ? '#fde047' : '#f59e0b';
        }

        // 4. Subtle Hover Illumination
        if (hoveredFeature === f) {
          return '#38bdf8';
        }

        // 5. Default Continent-Tinted Cartographic Palette
        switch (c.continentEn) {
          case 'South America':
            return '#1e3a5f';
          case 'North America':
            return '#1e3f66';
          case 'Europe':
            return '#233858';
          case 'Asia':
            return '#1b3554';
          case 'Africa':
            return '#243b55';
          case 'Oceania':
            return '#1a365d';
          default:
            return '#1e293b';
        }
      })
      .polygonStrokeColor((feat: object) => {
        const f = feat as GeoCountryFeature;
        const c = countriesMapRef.current.get(f);
        if (c && (correctCountryId === c.id || (playMode === 'guess_country' && targetCountry?.id === c.id))) {
          return '#ffffff';
        }
        if (hoveredFeature === f) {
          return '#7dd3fc';
        }
        return 'rgba(148, 163, 184, 0.45)';
      });
  }, [playMode, targetCountry, hoveredFeature, correctCountryId, wrongCountryIds, roundResolved]);

  // Start chosen game mode
  const handleSelectMode = (mode: 'guess_country' | 'locate_country') => {
    playBalatroSound('play');
    setPlayMode(mode);
    playModeRef.current = mode;
    startNextCountryRound(mode);
  };

  // Mode 1: Handle Multiple Choice Selection
  const handleMultipleChoiceAnswer = (chosen: ParsedCountry) => {
    if (!targetCountry || roundResolved) return;

    if (chosen.id === targetCountry.id) {
      playBalatroSound('play');
      setCorrectCountryId(targetCountry.id);
      setRoundResolved(true);
      setRoundsPlayed((r) => r + 1);

      const pointsEarned = 120 + currentStreak * 20;
      const nextStreak = currentStreak + 1;
      registerPointsAndStreak(pointsEarned, nextStreak);

      setFeedbackBanner({
        type: 'correct',
        title: `¡Correcto! Es ${targetCountry.nameEs}`,
        subtitle: `+${pointsEarned} pts · Continente: ${targetCountry.continentEs} · Racha: ${nextStreak}`,
      });

      if (nextStreak % 3 === 0) {
        confetti({ particleCount: 70, spread: 65, origin: { y: 0.65 } });
      }
    } else {
      playBalatroSound('hover');
      setWrongCountryIds((prev) => [...prev, chosen.id]);
      setCurrentStreak(0);
      setCorrectCountryId(targetCountry.id);
      setRoundResolved(true);
      setRoundsPlayed((r) => r + 1);

      setFeedbackBanner({
        type: 'wrong',
        title: `Incorrecto, elegiste ${chosen.nameEs}`,
        subtitle: `El país resaltado en el globo era ${targetCountry.nameEs} (${targetCountry.continentEs}).`,
      });
    }
  };

  // Mode 1: Handle Free-Text Submission (Case & Accent Insensitive)
  const handleFreeTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCountry || roundResolved || !freeTextInput.trim()) return;

    if (isCountryAnswerCorrect(freeTextInput, targetCountry)) {
      playBalatroSound('play');
      setCorrectCountryId(targetCountry.id);
      setRoundResolved(true);
      setRoundsPlayed((r) => r + 1);

      // Extra bonus for Free-Text mode!
      const pointsEarned = 180 + currentStreak * 30;
      const nextStreak = currentStreak + 1;
      registerPointsAndStreak(pointsEarned, nextStreak);

      setFeedbackBanner({
        type: 'correct',
        title: `¡Excelente! Es ${targetCountry.nameEs}`,
        subtitle: `+${pointsEarned} pts (Escritura Libre) · Continente: ${targetCountry.continentEs}`,
      });

      if (nextStreak % 3 === 0) {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.65 } });
      }
    } else {
      playBalatroSound('hover');
      const remaining = attemptsLeft - 1;
      setAttemptsLeft(remaining);
      setCurrentStreak(0);

      if (remaining <= 0) {
        setCorrectCountryId(targetCountry.id);
        setRoundResolved(true);
        setRoundsPlayed((r) => r + 1);
        setFeedbackBanner({
          type: 'wrong',
          title: `Incorrecto («${freeTextInput.trim()}»)`,
          subtitle: `El país resaltado era ${targetCountry.nameEs} (${targetCountry.continentEs}).`,
        });
      } else {
        setFeedbackBanner({
          type: 'wrong',
          title: `No es «${freeTextInput.trim()}»`,
          subtitle: `Pista: Está en ${targetCountry.continentEs} y empieza con «${targetCountry.nameEs.charAt(
            0
          )}». Te quedan ${remaining} ${remaining === 1 ? 'intento' : 'intentos'}.`,
        });
      }
    }
  };

  // Handle "Saltar" (Skip Country)
  const handleSkipCountry = () => {
    if (!targetCountry) return;
    playBalatroSound('select');
    if (!roundResolved) {
      setCurrentStreak(0);
      setCorrectCountryId(targetCountry.id);
      setRoundResolved(true);
      setFeedbackBanner({
        type: 'skipped',
        title: `País revelado: ${targetCountry.nameEs}`,
        subtitle: `Continente: ${targetCountry.continentEs} · Pulsa «Siguiente País» para continuar.`,
      });
      globeInstanceRef.current?.pointOfView(
        {
          lat: targetCountry.lat,
          lng: targetCountry.lng,
          altitude: targetCountry.cameraAltitude,
        },
        1100
      );
    } else {
      startNextCountryRound();
    }
  };

  // Save session record when leaving if rounds were played
  const handleExitWithSave = () => {
    if (roundsPlayed > 0) {
      const calculatedGrade = Math.min(100, Math.max(65, Math.round(60 + Math.min(40, currentScore / 15))));
      saveMatchRecord({
        gameType: 'geografia_3d',
        gameTitle: 'Globo Terráqueo 3D: Geografía Mundial',
        roomCode,
        role: isTeacherSpectator ? 'teacher' : 'student',
        playerName: localStorage.getItem('po_player_name') || 'Explorador',
        playerAvatar: localStorage.getItem('po_player_avatar') || '🌍',
        grade: calculatedGrade,
        score: currentScore,
        isVictory: currentScore >= 200,
        statusText: `Puntaje: ${currentScore} pts · Mejor Racha: ${bestStreak}`,
        detailsText: `Exploración Geográfica 3D (${roundsPlayed} países jugados)`,
      });
    }
    onGoHome();
  };

  // Lobby helpers
  const hostDisplay = typeof window !== 'undefined' ? window.location.host : 'aulaplay.edu';
  const joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${roomCode}&game=geografia_3d`
      : `https://aulaplay.edu?room=${roomCode}&game=geografia_3d`;

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

  const handleStartMatchFromLobby = () => {
    if (room && !isSoloPractice) {
      socketClient.startGame();
    }
    setIsCountdownActive(true);
    setGamePhase('playing');
    if (defaultStartMode !== 'menu') {
      setTimeout(() => {
        setPlayMode(defaultStartMode);
        playModeRef.current = defaultStartMode;
        startNextCountryRound(defaultStartMode);
      }, 400);
    }
  };

  const handleReturnToLobby = () => {
    setIsCountdownActive(false);
    setGamePhase('lobby');
    if (room && !isSoloPractice) {
      socketClient.returnToLobby();
    }
    playBalatroSound('click');
  };

  const themeStyles = {
    neon: {
      leftDoor1: '#38bdf8',
      leftDoor2: '#22e584',
      rightDoor1: '#f59e0b',
      rightDoor2: '#06b6d4',
      bgGradient: 'from-[#071824] via-[#041019] to-[#02080d]',
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
  // A. UNIFIED PRE-GAME WAITING ROOM / LOBBY VIEW (HEAT GUARDIAN MONOLITH STYLE)
  // ============================================================================
  if (gamePhase === 'lobby') {
    const canControlLobby = isHost || effectiveIsTeacher || isSoloPractice;
    const globeMenuItems: HeatGuardianMenuItem[] = [
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
              badge:
                continentFilter === 'ALL'
                  ? 'MUNDO'
                  : continentFilter.toUpperCase(),
              onClick: () => {
                playBalatroSound('select');
                setIsTeacherConfigOpen(true);
              },
            },
          ]
        : []),
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
        titleLine1="ATLAS"
        titleLine2="GUARDIAN 3D"
        subtitleBadge="CARTOGRAFÍA MUNDIAL · VUELO Y LOCALIZACIÓN"
        creditText={`EXPEDICIÓN PIN · ${roomCode}`}
        variant="arctic_cyan"
        menuItems={globeMenuItems}
        topRightSlot={
          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              onClick={toggleSound}
              className="p-2 bg-[#0b1114]/90 hover:bg-[#162127] border border-white/15 rounded-none text-slate-300 hover:text-white transition-colors cursor-pointer"
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
              className="p-2 bg-[#0b1114]/90 hover:bg-[#162127] border border-white/15 rounded-none text-slate-300 hover:text-white transition-colors cursor-pointer"
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

            {/* Top Row: Step 1 & 2 on Left, QR on Right */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
              <div className="md:col-span-2 flex flex-col justify-between space-y-3">
                <div className="bg-[#121c21]/90 border border-[#283842] p-3 sm:p-3.5 flex items-center gap-3">
                  <div className="w-7 h-7 bg-[#0b1114] text-amber-400 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/40">
                    01
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block leading-tight">
                      Enlace de acceso a la expedición:
                    </span>
                    <div
                      onClick={handleCopyUrl}
                      className="text-xs sm:text-sm font-mono text-slate-100 font-bold truncate block cursor-pointer hover:text-amber-300"
                    >
                      {hostDisplay}
                    </div>
                  </div>
                  <button
                    onClick={handleCopyUrl}
                    className="p-2 bg-[#1a2830] hover:bg-[#243742] text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer shrink-0"
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
                      PIN de acceso a la sala:
                    </span>
                    <div
                      onClick={handleCopyCode}
                      className="text-3xl sm:text-4xl font-black font-mono tracking-[0.2em] text-white drop-shadow-[0_2px_10px_rgba(245,158,11,0.3)] cursor-pointer hover:text-amber-300 transition-colors"
                    >
                      {roomCode}
                    </div>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="p-2.5 bg-[#1a2830] hover:bg-[#243742] text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer shrink-0"
                  >
                    {copiedCode ? <Check size={17} className="text-amber-400" /> : <Copy size={17} />}
                  </button>
                </div>
              </div>

              {/* QR Panel */}
              <div className="bg-[#121c21]/90 border border-[#283842] p-3.5 flex flex-col items-center justify-between text-center">
                <div
                  onClick={() => setIsQrModalOpen(true)}
                  className="w-24 h-24 sm:w-28 sm:h-28 bg-white p-2 shadow-lg cursor-pointer hover:scale-105 transition-transform flex items-center justify-center border-2 border-amber-500/40"
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
                    >
                      <Share2 size={13} />
                    </button>
                    <button
                      onClick={() => setIsQrModalOpen(true)}
                      className="p-1.5 bg-[#1a2830] hover:bg-[#243742] text-slate-200 border border-white/10 text-xs cursor-pointer"
                    >
                      <QrCode size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Mode Banner */}
            <div className="bg-[#121c21]/95 border border-amber-500/35 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-lg shrink-0">
                  🌍
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 block">
                    Cartografía GeoJSON Interactiva · {countries.length || 170}+ Países
                  </span>
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    Modos incluidos: «Adivina el País» (Vuelo 3D) y «Localiza el País» (Búsqueda en Globo)
                  </h4>
                </div>
              </div>
            </div>

            {/* Bottom Row: Teacher Config, JUGAR Button & Connected Students */}
            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-[#121c21] border border-[#283842] text-slate-200 text-xs">
                  <GlobeIcon size={15} className="text-amber-400 shrink-0" />
                  <span className="font-mono font-bold text-white">
                    {continentFilter === 'ALL'
                      ? 'Todo el Mundo'
                      : continentFilter === 'Americas'
                      ? 'Solo América'
                      : continentFilter === 'Europe'
                      ? 'Solo Europa'
                      : continentFilter === 'Asia'
                      ? 'Solo Asia'
                      : continentFilter === 'Africa'
                      ? 'Solo África'
                      : 'Solo Oceanía'}{' '}
                    ({filteredCountriesPool.length || 170})
                  </span>
                </div>

                {canControlLobby && (
                  <button
                    type="button"
                    onClick={() => {
                      playBalatroSound('select');
                      setIsTeacherConfigOpen(true);
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-[#121c21] hover:bg-[#1a2830] border border-amber-500/40 hover:border-amber-400 text-slate-100 text-xs font-bold transition-all cursor-pointer"
                    title="Configurar continente, modo inicial, intentos, reloj y pistas"
                  >
                    <Settings size={15} className="text-amber-400" />
                    <div className="text-left leading-tight">
                      <span className="text-[10px] text-slate-400 block font-normal uppercase tracking-wider">
                        Ajustes Docente
                      </span>
                      <span className="text-amber-300 font-mono font-bold">
                        ❤️ {configuredMaxAttempts} int. ·{' '}
                        {countryTimeLimitSecs > 0 ? `⏱️ ${countryTimeLimitSecs}s` : '⏱️ Libre'}
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
                  <div className="w-full sm:w-auto px-5 py-2.5 bg-[#121c21] border border-amber-500/30 text-amber-300 font-bold text-xs font-mono flex items-center justify-center gap-2">
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

          {/* CONNECTED STUDENTS ROSTER */}
          <div className="w-full bg-[#0b1114]/85 border border-[#26353d] p-3.5 backdrop-blur-sm space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-300">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Cartógrafos conectados en la frecuencia ({studentPlayers.length})</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pt-1">
              {studentPlayers.length === 0 ? (
                <div className="w-full text-center py-3 bg-[#121c21]/70 border border-dashed border-[#283842] text-xs font-mono text-slate-400">
                  Sin exploradores en sala. Comparte el código{' '}
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
                    <span className="font-bold text-white">{p.name}</span>
                    <span className="text-[10px] text-amber-400 font-bold">✓ LISTO</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* QR MODAL */}
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
                  Código QR · Atlas 3D
                </h3>
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

        {/* TEACHER PRE-GAME CONFIGURATION MODAL (GLOBO 3D - LOBBY) */}
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
                      Configuraciones del Docente · Globo Terráqueo 3D
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

                {/* 1. Filtro de Continente / Región */}
                <div className="bg-[#121c21] p-3 border border-[#26353d] space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                    🌍 Región o Continente a Evaluar
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { v: 'ALL', label: 'Todo el Mundo' },
                      { v: 'Americas', label: 'Solo América' },
                      { v: 'Europe', label: 'Solo Europa' },
                      { v: 'Asia', label: 'Solo Asia' },
                      { v: 'Africa', label: 'Solo África' },
                      { v: 'Oceania', label: 'Solo Oceanía' },
                    ].map((reg) => (
                      <button
                        key={reg.v}
                        type="button"
                        onClick={() => {
                          playBalatroSound('select');
                          setContinentFilter(reg.v as any);
                        }}
                        className={`py-2 px-2 border text-[11px] font-bold cursor-pointer transition-colors ${
                          continentFilter === reg.v
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300 hover:text-white'
                        }`}
                      >
                        {reg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Modo de Juego Predeterminado */}
                <div className="bg-[#121c21] p-3 border border-[#26353d] space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-200 block">
                    🎮 Modo de Juego al Empezar la Partida
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { v: 'menu', label: 'Menú Libre (Ambos)' },
                      { v: 'guess_country', label: '1. Adivina el País' },
                      { v: 'locate_country', label: '2. Localiza el País' },
                    ].map((m) => (
                      <button
                        key={m.v}
                        type="button"
                        onClick={() => setDefaultStartMode(m.v as GlobePlayMode)}
                        className={`py-2 px-2 border text-[10px] font-bold cursor-pointer ${
                          defaultStartMode === m.v
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Método de Entrada en Adivina el País & Intentos por País */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="bg-[#121c21] p-3 border border-[#26353d] space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                      ⌨️ Método en «Adivina el País»
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { v: 'both', label: 'Ambos' },
                        { v: 'multiple_choice', label: '4 Botones' },
                        { v: 'free_text', label: 'Escritura' },
                      ].map((im) => (
                        <button
                          key={im.v}
                          type="button"
                          onClick={() => setAllowedInputMode(im.v as any)}
                          className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                            allowedInputMode === im.v
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                          }`}
                        >
                          {im.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#121c21] p-3 border border-[#26353d] space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-rose-300 block">
                      ❤️ Intentos por País
                    </label>
                    <div className="grid grid-cols-4 gap-1">
                      {[1, 2, 3, 5].map((att) => (
                        <button
                          key={att}
                          type="button"
                          onClick={() => {
                            setConfiguredMaxAttempts(att);
                            setAttemptsLeft(att);
                          }}
                          className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                            configuredMaxAttempts === att
                              ? 'bg-rose-600 text-white border-rose-400'
                              : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                          }`}
                        >
                          {att} Int.
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Tiempo Límite por País */}
                <div className="bg-[#121c21] p-3 border border-[#26353d] space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                    ⏱️ Tiempo Límite por País
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { v: 0, label: 'Sin reloj' },
                      { v: 15, label: '15 seg' },
                      { v: 30, label: '30 seg' },
                      { v: 45, label: '45 seg' },
                      { v: 60, label: '60 seg' },
                    ].map((t) => (
                      <button
                        key={t.v}
                        type="button"
                        onClick={() => setCountryTimeLimitSecs(t.v)}
                        className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                          countryTimeLimitSecs === t.v
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Botón Saltar & Pista de Continente */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="bg-[#121c21] p-3 border border-[#26353d] space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-200 block">
                      ⏭️ Botón «Saltar País»
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAllowSkipButton(true)}
                        className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                          allowSkipButton
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                        }`}
                      >
                        Permitido
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllowSkipButton(false)}
                        className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                          !allowSkipButton
                            ? 'bg-rose-600 text-white border-rose-400'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                        }`}
                      >
                        Bloqueado (Examen)
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#121c21] p-3 border border-[#26353d] space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                      🧭 Mostrar Pista de Continente
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowContinentHint(true)}
                        className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                          showContinentHint
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                        }`}
                      >
                        Visible
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowContinentHint(false)}
                        className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                          !showContinentHint
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                        }`}
                      >
                        Oculta (Difícil)
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    playBalatroSound('play');
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
  // B. ACTIVE 3D GLOBE VIEWPORT & GAMIFIED GEOGRAPHY HUD
  // ============================================================================
  if (effectiveIsTeacher) {
    return (
      <div className="relative w-full h-[100dvh]">
        {isCountdownActive && (
          <MatchStartCountdown
            onComplete={() => setIsCountdownActive(false)}
            subtitle="¡GLOBO TERRÁQUEO 3D · MONITOREO DOCENTE!"
          />
        )}
        <TeacherSpectatorDashboard
          gameType="geografia_3d"
          gameTitle="Globo Terráqueo 3D · Geografía Mundial"
          room={room || null}
          players={players}
          roomCode={roomCode}
          totalInitialSeconds={countryTimeLimitSecs || 180}
          timeRemainingSecs={countrySecondsLeft || 120}
          totalQuestions={10}
          geoTargetCountry={targetCountry?.nameEs || 'Tailandia / Brasil / Egipto'}
          geoPlayMode={playMode}
          onGoLobby={handleReturnToLobby}
          onGoHome={onGoHome}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen bg-[#090f12] text-slate-100 overflow-hidden select-none font-sans">
      {/* Fluid 3-2-1 Countdown Overlay */}
      {isCountdownActive && (
        <MatchStartCountdown
          onComplete={() => setIsCountdownActive(false)}
          subtitle="¡GLOBO TERRÁQUEO 3D · EXPLORACIÓN MUNDIAL!"
        />
      )}

      {/* Heat Guardian Atmospheric Backdrop behind WebGL Canvas */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <HeatGuardianAtmosphere
          variant="arctic_cyan"
          showGuardianScene={false}
          sceneOpacity={0.38}
        />
      </div>

      {/* =====================================================================
          1. DEDICATED 3D WEBGL GLOBE CONTAINER (100% FULL VIEWPORT)
      ===================================================================== */}
      <div
        ref={globeContainerRef}
        className="absolute inset-0 w-full h-full z-0"
      />

      {/* Loading / Error State Overlay */}
      {(isLoadingGeo || geoError) && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#090f12]/90 p-4">
          <div className="bg-[#0b1114] border-2 border-[#26353d] p-6 max-w-md text-center space-y-3 shadow-2xl">
            <GlobeIcon size={36} className="text-amber-400 mx-auto animate-spin" />
            <h3 className="text-base font-black uppercase tracking-wider text-white">
              {geoError ? 'Error de Cartografía' : 'Cargando Polígonos GeoJSON del Mundo...'}
            </h3>
            <p className="text-xs text-slate-400">
              {geoError || 'Preparando fronteras continentales y coordenadas 3D...'}
            </p>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. TOP FLOATING BAR (MODE SWITCHER + SCOREBOARD + ROOM CONTROLS)
      ===================================================================== */}
      <header className="relative z-20 w-full px-3 sm:px-6 py-2.5 bg-[#0b1114]/95 border-b-2 border-[#26353d] flex flex-wrap items-center justify-between gap-2.5 shadow-2xl">
        {/* Left: Brand & Mode Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              playBalatroSound('select');
              setPlayMode('menu');
              setTargetCountry(null);
              setCorrectCountryId(null);
              setWrongCountryIds([]);
              setFeedbackBanner(null);
              if (globeInstanceRef.current) {
                const ctrl = globeInstanceRef.current.controls();
                if (ctrl) ctrl.autoRotate = true;
                globeInstanceRef.current.pointOfView({ lat: 18, lng: -25, altitude: 2.0 }, 1000);
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#121c21] hover:bg-[#18262d] border border-[#26353d] cursor-pointer transition-colors"
            title="Ir al menú de modos del Globo 3D"
          >
            <GlobeIcon size={17} className="text-amber-400 shrink-0" />
            <span className="text-xs sm:text-sm font-black tracking-[0.16em] text-white uppercase whitespace-nowrap">
              ATLAS GUARDIAN 3D
            </span>
          </button>

          {/* Segmented Mode Tabs */}
          <div className="hidden md:flex items-center gap-1 p-1 bg-[#121c21] border border-[#26353d]">
            <button
              type="button"
              onClick={() => handleSelectMode('guess_country')}
              className={cn(
                'px-3 py-1 text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap',
                playMode === 'guess_country'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              )}
            >
              <Compass size={13} />
              <span>1. Adivina el País</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectMode('locate_country')}
              className={cn(
                'px-3 py-1 text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap',
                playMode === 'locate_country'
                  ? 'bg-[#22e584] text-slate-950'
                  : 'text-slate-300 hover:text-white'
              )}
            >
              <MapPin size={13} />
              <span>2. Localiza el País</span>
            </button>
          </div>
        </div>

        {/* Center: Visible Scoreboard (Current Streak + High Score + Current Score) */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 text-xs tabular-nums">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121c21] border border-[#26353d]">
            <Flame size={15} className="text-amber-400 shrink-0" />
            <span className="text-slate-400 hidden sm:inline uppercase tracking-wider text-[10px] font-bold">
              Racha:
            </span>
            <span className="font-mono font-black text-amber-300 text-sm">{currentStreak}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121c21] border border-[#26353d]">
            <Trophy size={15} className="text-[#22e584] shrink-0" />
            <span className="text-slate-400 hidden sm:inline uppercase tracking-wider text-[10px] font-bold">
              Récord:
            </span>
            <span className="font-mono font-black text-[#22e584] text-sm">{highScore}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#121c21] border border-[#26353d]">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">
              Puntos:
            </span>
            <span className="font-mono font-black text-white text-sm">{currentScore}</span>
          </div>

          {playMode !== 'menu' && !roundResolved && countryTimeLimitSecs > 0 && (
            <div
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 border font-mono text-xs font-black',
                countrySecondsLeft <= 7
                  ? 'bg-red-950 border-red-500 text-red-300 animate-pulse'
                  : 'bg-[#121c21] border-amber-500/40 text-amber-300'
              )}
            >
              <Clock size={14} />
              <span>{countrySecondsLeft}s</span>
            </div>
          )}
        </div>

        {/* Right: Essential Match Controls Only (Fullscreen & Exit, No mid-game settings) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMatchFullscreen}
            className="px-2.5 py-1.5 bg-[#121c21] hover:bg-[#18262d] border border-amber-500/40 text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Alternar pantalla completa"
          >
            <Maximize size={14} />
            <span className="hidden sm:inline">Pantalla Completa</span>
          </button>

          <button
            type="button"
            onClick={handleExitWithSave}
            className="px-3 py-1.5 bg-[#1b0e12] hover:bg-red-950 border border-red-500/40 text-xs font-bold uppercase tracking-wider text-red-200 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Home size={14} />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* =====================================================================
          3. TOP PROMPT BANNER FOR MODE 2 ("LOCALIZA EL PAÍS") OR FEEDBACK
      ===================================================================== */}
      <div className="relative z-20 pointer-events-none flex flex-col items-center px-4 pt-3 space-y-2">
        {/* Mode 2 Giant Target Country Banner */}
        {playMode === 'locate_country' && targetCountry && (
          <motion.div
            key={targetCountry.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-auto bg-[#0b1114]/95 border-2 border-[#26353d] px-5 py-3 shadow-2xl flex flex-wrap items-center justify-between gap-4 max-w-xl w-full"
          >
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#22e584] flex items-center gap-1.5">
                <MapPin size={13} />
                <span>
                  MODO LOCALIZA EL PAÍS
                  {showContinentHint ? ` · ${targetCountry.continentEs}` : ''}
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5 uppercase">
                Encuentra: <span className="text-amber-300">{targetCountry.nameEs}</span>
              </div>
            </div>

            {/* Remaining Attempts Hearts */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1" title="Intentos restantes">
                {Array.from({ length: configuredMaxAttempts }, (_, i) => i + 1).map((idx) => (
                  <Heart
                    key={idx}
                    size={18}
                    className={cn(
                      'transition-transform',
                      idx <= attemptsLeft
                        ? 'text-red-500 fill-red-500'
                        : 'text-slate-700 fill-slate-800 scale-90'
                    )}
                  />
                ))}
              </div>

              {(allowSkipButton || roundResolved) && (
                <button
                  type="button"
                  onClick={handleSkipCountry}
                  className="px-3 py-1.5 bg-[#121c21] hover:bg-[#18262d] border border-[#26353d] text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <SkipForward size={14} />
                  <span>{roundResolved ? 'Siguiente País' : 'Saltar'}</span>
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Visual & Textual Feedback Toast Banner */}
        <AnimatePresence mode="wait">
          {feedbackBanner && (
            <motion.div
              key={feedbackBanner.title + feedbackBanner.subtitle}
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              className={cn(
                'pointer-events-auto px-4 py-2.5 border-2 shadow-2xl max-w-xl w-full flex items-center justify-between gap-3',
                feedbackBanner.type === 'correct'
                  ? 'bg-[#0b1114]/95 border-[#22e584] text-emerald-100'
                  : feedbackBanner.type === 'wrong'
                  ? 'bg-[#0b1114]/95 border-red-500 text-red-100'
                  : 'bg-[#0b1114]/95 border-amber-500 text-amber-100'
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {feedbackBanner.type === 'correct' ? (
                  <CheckCircle2 size={20} className="text-[#22e584] shrink-0" />
                ) : (
                  <XCircle
                    size={20}
                    className={
                      feedbackBanner.type === 'wrong'
                        ? 'text-red-400 shrink-0'
                        : 'text-amber-400 shrink-0'
                    }
                  />
                )}
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-black uppercase tracking-wider truncate">
                    {feedbackBanner.title}
                  </div>
                  <div className="text-[11px] opacity-90 truncate">
                    {feedbackBanner.subtitle}
                  </div>
                </div>
              </div>

              {roundResolved && playMode !== 'menu' && (
                <button
                  type="button"
                  onClick={() => startNextCountryRound()}
                  className="px-3.5 py-1.5 bg-white text-slate-950 hover:bg-slate-200 font-black text-xs uppercase tracking-wider shrink-0 cursor-pointer shadow-md"
                >
                  Siguiente ▶
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* =====================================================================
          4. INITIAL MODE SELECTION MENU OVERLAY (WHEN playMode === 'menu')
      ===================================================================== */}
      {playMode === 'menu' && (
        <div className="absolute inset-x-0 bottom-6 z-20 flex justify-center px-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-auto bg-[#0b1114]/95 border-2 border-[#26353d] p-5 sm:p-6 max-w-3xl w-full shadow-2xl space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#26353d] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-400">
                  ATLAS GUARDIAN EN 3D · ROTA EL GLOBO CON EL MOUSE O DEDO
                </span>
                <h2 className="text-lg sm:text-xl font-black uppercase tracking-wider text-white">
                  Elige un Modo de Juego Geográfico
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {countries.length} países disponibles
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Mode 1 Card: Adivina el País */}
              <div className="bg-[#121c21] border border-amber-500/40 hover:border-amber-400 p-4 flex flex-col justify-between space-y-3 transition-all">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Compass size={15} />
                      <span>MODO 1: ADIVINA EL PAÍS</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    La cámara del globo 3D vuela y hace zoom hacia un país al azar resaltándolo en dorado. Adivina cuál es mediante <strong>Opción Múltiple</strong> (mismo continente) o <strong>Escritura Libre</strong>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectMode('guess_country')}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-[0.16em] cursor-pointer transition-colors flex items-center justify-center gap-2"
                >
                  <Play size={14} fill="currentColor" />
                  <span>Jugar «Adivina el País» ▶</span>
                </button>
              </div>

              {/* Mode 2 Card: Localiza el País */}
              <div className="bg-[#121c21] border border-[#22e584]/40 hover:border-[#22e584] p-4 flex flex-col justify-between space-y-3 transition-all">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-[#22e584] flex items-center gap-1.5">
                      <MapPin size={15} />
                      <span>MODO 2: LOCALIZA EL PAÍS</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    El sistema te da el nombre de un país (ej. <em>«Encuentra: Tailandia»</em>). Rota el globo terráqueo manualmente, búscalo y haz clic sobre su polígono.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectMode('locate_country')}
                  className="w-full py-2.5 bg-[#22e584] hover:bg-[#1bc971] text-slate-950 font-black text-xs uppercase tracking-[0.16em] cursor-pointer transition-colors flex items-center justify-center gap-2"
                >
                  <Play size={14} fill="currentColor" />
                  <span>Jugar «Localiza el País» ▶</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* =====================================================================
          5. COLLAPSIBLE BOTTOM CONTROL DOCK FOR MODE 1 ("ADIVINA EL PAÍS")
             & QUICK CONTROLS FOR MODE 2
      ===================================================================== */}
      {playMode !== 'menu' && (
        <div className="absolute inset-x-0 bottom-3 z-20 flex flex-col items-center px-3 pointer-events-none">
          {/* Collapse / Expand Toggle Tab */}
          <button
            type="button"
            onClick={() => setIsHudCollapsed((prev) => !prev)}
            className="pointer-events-auto mb-1 px-3.5 py-1 bg-[#0b1114]/95 border-2 border-b-0 border-[#26353d] text-[11px] font-bold uppercase tracking-wider text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            {isHudCollapsed ? (
              <>
                <ChevronUp size={13} />
                <span>Mostrar Controles</span>
              </>
            ) : (
              <>
                <ChevronDown size={13} />
                <span>Ocultar Panel para Inspeccionar Globo</span>
              </>
            )}
          </button>

          {!isHudCollapsed && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="pointer-events-auto w-full max-w-3xl bg-[#0b1114]/95 border-2 border-[#26353d] p-4 shadow-2xl space-y-3"
            >
              {playMode === 'guess_country' && targetCountry ? (
                <>
                  {/* Header: Prompt + Input Method Toggle + Skip / Recenter */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#26353d] pb-2.5">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400 block">
                        ¿QUÉ PAÍS ESTÁ RESALTADO EN DORADO?
                        {showContinentHint ? ` · PISTA: ${targetCountry.continentEs}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Input Method Selector: Opción Múltiple vs Escritura Libre */}
                      {allowedInputMode === 'both' && (
                        <div className="flex items-center gap-1 bg-[#121c21] p-1 border border-[#26353d]">
                          <button
                            type="button"
                            onClick={() => {
                              playBalatroSound('select');
                              setInputMethod('multiple_choice');
                            }}
                            className={cn(
                              'px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors',
                              inputMethod === 'multiple_choice'
                                ? 'bg-amber-500 text-slate-950'
                                : 'text-slate-400 hover:text-white'
                            )}
                          >
                            <ListChecks size={13} />
                            <span>Opción Múltiple</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              playBalatroSound('select');
                              setInputMethod('free_text');
                            }}
                            className={cn(
                              'px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors',
                              inputMethod === 'free_text'
                                ? 'bg-amber-500 text-slate-950'
                                : 'text-slate-400 hover:text-white'
                            )}
                          >
                            <Keyboard size={13} />
                            <span>Escritura Libre</span>
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          globeInstanceRef.current?.pointOfView(
                            {
                              lat: targetCountry.lat,
                              lng: targetCountry.lng,
                              altitude: targetCountry.cameraAltitude,
                            },
                            800
                          );
                        }}
                        className="px-2.5 py-1.5 bg-[#121c21] hover:bg-[#18262d] border border-[#26353d] text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                        title="Volver a enfocar el país resaltado"
                      >
                        <RotateCcw size={13} />
                        <span className="hidden sm:inline">Enfocar</span>
                      </button>

                      {(allowSkipButton || roundResolved) && (
                        <button
                          type="button"
                          onClick={handleSkipCountry}
                          className="px-3 py-1.5 bg-[#121c21] hover:bg-[#18262d] border border-[#26353d] text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1 cursor-pointer"
                        >
                          <SkipForward size={13} />
                          <span>{roundResolved ? 'Siguiente' : 'Saltar'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Input Area: 4 Same-Continent Buttons OR Free-Text Form */}
                  {inputMethod === 'multiple_choice' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {multipleChoiceOptions.map((option, idx) => {
                        const isCorrectOption = roundResolved && option.id === targetCountry.id;
                        const isWrongOption = wrongCountryIds.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            disabled={roundResolved}
                            onClick={() => handleMultipleChoiceAnswer(option)}
                            className={cn(
                              'px-4 py-2.5 border text-left font-bold text-xs sm:text-sm flex items-center justify-between transition-all cursor-pointer',
                              isCorrectOption
                                ? 'bg-emerald-600 border-emerald-400 text-white'
                                : isWrongOption
                                ? 'bg-red-950/90 border-red-500 text-red-200'
                                : 'bg-[#121c21] hover:bg-[#18262d] border-[#26353d] text-slate-100'
                            )}
                          >
                            <span className="truncate">
                              <span className="font-mono text-amber-400 mr-2">
                                {String.fromCharCode(65 + idx)}.
                              </span>
                              {option.nameEs}
                            </span>
                            {isCorrectOption && <CheckCircle2 size={16} className="shrink-0" />}
                            {isWrongOption && <XCircle size={16} className="shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <form onSubmit={handleFreeTextSubmit} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={freeTextInput}
                        disabled={roundResolved}
                        onChange={(e) => setFreeTextInput(e.target.value)}
                        placeholder="Escribe el nombre del país (sin importar mayúsculas o tildes)..."
                        className="flex-1 bg-[#121c21] border border-[#26353d] focus:border-amber-400 px-4 py-2.5 text-sm text-white focus:outline-none"
                      />
                      {!roundResolved ? (
                        <button
                          type="submit"
                          disabled={!freeTextInput.trim()}
                          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <Send size={14} />
                          <span>Comprobar</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startNextCountryRound()}
                          className="px-5 py-2.5 bg-[#22e584] hover:bg-[#1bc971] text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shrink-0"
                        >
                          Siguiente País ▶
                        </button>
                      )}
                    </form>
                  )}
                </>
              ) : (
                /* Mode 2 Bottom Helper Bar */
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Compass size={16} className="text-[#22e584] shrink-0" />
                    <span>
                      Arrastra el globo 3D para rotarlo, usa la rueda o pellizca para hacer zoom y haz clic sobre{' '}
                      <strong className="text-amber-300">{targetCountry?.nameEs}</strong>.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectMode('guess_country')}
                      className="px-3 py-1.5 bg-[#121c21] hover:bg-[#18262d] border border-[#26353d] text-amber-300 font-bold text-xs uppercase tracking-wider cursor-pointer"
                    >
                      Cambiar a «Adivina el País»
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}

      {isQrOpen && room?.code && (
        <QRCodeModal roomCode={room.code} onClose={() => setIsQrOpen(false)} />
      )}

      {/* TEACHER CONFIGURATION MODAL IN ACTIVE GLOBE VIEW */}
      <AnimatePresence>
        {isTeacherConfigOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="bg-[#0b1114] border-2 border-[#2a3b44] p-5 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl text-xs font-sans text-slate-200 max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-[#24323a] pb-3">
                <div className="flex items-center gap-2">
                  <Settings size={18} className="text-amber-400" />
                  <h3 className="font-sans text-sm sm:text-base font-black uppercase tracking-[0.14em] text-white">
                    Configuraciones del Docente · Globo 3D
                  </h3>
                </div>
                <button
                  onClick={() => setIsTeacherConfigOpen(false)}
                  aria-label="Cerrar configuración"
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* 1. Filtro de Continente / Región */}
              <div className="bg-[#121c21] p-3 border border-[#24323a] space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                  🌍 Región o Continente a Evaluar ({filteredCountriesPool.length} países)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { v: 'ALL', label: 'Todo el Mundo' },
                    { v: 'Americas', label: 'Solo América' },
                    { v: 'Europe', label: 'Solo Europa' },
                    { v: 'Asia', label: 'Solo Asia' },
                    { v: 'Africa', label: 'Solo África' },
                    { v: 'Oceania', label: 'Solo Oceanía' },
                  ].map((reg) => (
                    <button
                      key={reg.v}
                      type="button"
                      onClick={() => {
                        playBalatroSound('select');
                        setContinentFilter(reg.v as any);
                      }}
                      className={`py-2 px-2 border text-[11px] font-bold cursor-pointer transition-colors ${
                        continentFilter === reg.v
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-[#0b1114] border-[#26353d] text-slate-300 hover:text-white'
                      }`}
                    >
                      {reg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Método de Entrada & Intentos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="bg-[#121c21] p-3 border border-[#24323a] space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                    ⌨️ Método en «Adivina el País»
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { v: 'both', label: 'Ambos' },
                      { v: 'multiple_choice', label: '4 Botones' },
                      { v: 'free_text', label: 'Escritura' },
                    ].map((im) => (
                      <button
                        key={im.v}
                        type="button"
                        onClick={() => setAllowedInputMode(im.v as any)}
                        className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                          allowedInputMode === im.v
                            ? 'bg-amber-500 text-slate-950 border-amber-300'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                        }`}
                      >
                        {im.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#121c21] p-3 border border-[#24323a] space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                    ❤️ Intentos por País
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {[1, 2, 3, 5].map((att) => (
                      <button
                        key={att}
                        type="button"
                        onClick={() => {
                          setConfiguredMaxAttempts(att);
                          setAttemptsLeft(att);
                        }}
                        className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                          configuredMaxAttempts === att
                            ? 'bg-amber-500 text-slate-950 border-amber-300'
                            : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                        }`}
                      >
                        {att} Int.
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Tiempo Límite por País */}
              <div className="bg-[#121c21] p-3 border border-[#24323a] space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                  ⏱️ Tiempo Límite por País
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { v: 0, label: 'Sin reloj' },
                    { v: 15, label: '15 seg' },
                    { v: 30, label: '30 seg' },
                    { v: 45, label: '45 seg' },
                    { v: 60, label: '60 seg' },
                  ].map((t) => (
                    <button
                      key={t.v}
                      type="button"
                      onClick={() => setCountryTimeLimitSecs(t.v)}
                      className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                        countryTimeLimitSecs === t.v
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Botón Saltar & Pista de Continente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="bg-[#121c21] p-3 border border-[#24323a] space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                    ⏭️ Botón «Saltar País»
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAllowSkipButton(true)}
                      className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                        allowSkipButton
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                      }`}
                    >
                      Permitido
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllowSkipButton(false)}
                      className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                        !allowSkipButton
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                      }`}
                    >
                      Bloqueado
                    </button>
                  </div>
                </div>

                <div className="bg-[#121c21] p-3 border border-[#24323a] space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                    🧭 Mostrar Pista de Continente
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowContinentHint(true)}
                      className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                        showContinentHint
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                      }`}
                    >
                      Visible
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowContinentHint(false)}
                      className={`py-1.5 border text-[10px] font-bold cursor-pointer ${
                        !showContinentHint
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-[#0b1114] border-[#26353d] text-slate-300'
                      }`}
                    >
                      Oculta
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  playBalatroSound('play');
                  setIsTeacherConfigOpen(false);
                  if (playMode !== 'menu') {
                    startNextCountryRound(playMode);
                  }
                }}
                className="w-full py-2.5 bg-white hover:bg-slate-200 text-slate-950 font-black uppercase tracking-[0.2em] text-xs cursor-pointer shadow-lg transition-colors"
              >
                Guardar y Aplicar ▶
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
