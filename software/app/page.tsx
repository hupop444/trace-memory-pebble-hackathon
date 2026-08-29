'use client';

import type { CSSProperties, FormEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BleCaptureAdapter } from '../lib/capture';
import { growMemory } from '../lib/grow-memory';
import { createRoadshowTraces } from '../lib/showcase';
import { loadTraces, saveTraces } from '../lib/storage';
import {
  TraceSoftwareAdapter,
  type TraceGatewayAck,
  type TraceGatewayDevice,
  type TraceGatewayMoment,
  type TraceGatewayTelemetry,
} from '../lib/trace-software-adapter';
import type { CaptureEvent, Trace } from '../lib/types';

type View = 'today' | 'garden' | 'mine';
type Layer = 'none' | 'claim' | 'growing' | 'detail' | 'ring' | 'day' | 'setting';
type FeelingTag = NonNullable<Trace['feelingTags']>[number];
type RelationTag = NonNullable<Trace['relationTags']>[number];
type DemoDailyDisk = { day: number; count: number; completed: number; times: string[]; hue: number };

const feelingOptions: Array<{ value: FeelingTag; label: string; tone: 'light' | 'heavy' | 'open' }> = [
  { value: 'warm', label: '温暖', tone: 'light' },
  { value: 'relaxed', label: '松弛', tone: 'light' },
  { value: 'fun', label: '有趣', tone: 'light' },
  { value: 'understood', label: '被理解', tone: 'light' },
  { value: 'offended', label: '被冒犯', tone: 'heavy' },
  { value: 'ignored', label: '被忽视', tone: 'heavy' },
  { value: 'wronged', label: '委屈', tone: 'heavy' },
  { value: 'irritated', label: '烦躁', tone: 'heavy' },
  { value: 'unclear', label: '说不清', tone: 'open' },
];

const relationOptions: Array<{ value: RelationTag; label: string }> = [
  { value: 'friend', label: '朋友' },
  { value: 'family', label: '家人' },
  { value: 'alone', label: '独处' },
  { value: 'small_win', label: '小成就' },
];

const demoDailyDisks: DemoDailyDisk[] = [
  { day: 20, count: 2, completed: 2, times: ['10:16', '20:42'], hue: 340 },
  { day: 21, count: 1, completed: 1, times: ['18:05'], hue: 194 },
  { day: 22, count: 3, completed: 2, times: ['09:20', '15:11', '22:03'], hue: 28 },
  { day: 23, count: 2, completed: 2, times: ['11:09', '19:36'], hue: 316 },
  { day: 24, count: 4, completed: 3, times: ['08:44', '12:18', '17:20', '21:15'], hue: 174 },
  { day: 25, count: 3, completed: 3, times: ['10:32', '14:28', '20:06'], hue: 350 },
  { day: 26, count: 1, completed: 1, times: ['16:47'], hue: 47 },
  { day: 27, count: 5, completed: 4, times: ['08:26', '11:50', '15:02', '19:12', '22:18'], hue: 21 },
  { day: 28, count: 6, completed: 4, times: ['09:12', '11:09', '13:43', '15:41', '18:20', '21:06'], hue: 24 },
];

const sleep = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

function daysTogether(value: string) {
  return Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000) + 1);
}

function isThisMonth(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function pebbleName(slot?: number, label?: string) {
  if (slot) return `${slot} 号 Pebble`;
  return label || 'Pebble';
}

function touchContext(trace?: Trace) {
  const duration = trace?.pressure?.durationMs;
  if (duration === undefined) return '一次真实捏压';
  if (duration < 360) return '轻轻一捏';
  if (duration < 1250) return '稳稳握住';
  return '停留片刻';
}

function lightContext(light?: number, lightRaw?: number) {
  if (lightRaw === 0) return '光线待检查';
  if (light === undefined) return '光线未记录';
  if (light < 0.16) return '微光中';
  if (light < 0.58) return '柔和光线';
  return '明亮光线';
}

function explicitRelations(trace: Trace): RelationTag[] {
  const explicit = new Set(trace.relationTags ?? []);
  const text = trace.originalText ?? '';
  if (/朋友|同学|同事/.test(text)) explicit.add('friend');
  if (/家人|妈妈|爸爸|父母|奶奶|爷爷|孩子/.test(text)) explicit.add('family');
  if (/一个人|独处|自己/.test(text)) explicit.add('alone');
  if (/完成|做完|终于|搞定/.test(text)) explicit.add('small_win');
  return [...explicit];
}

function orbStyle(trace?: Trace): CSSProperties {
  const hue = trace?.visualSeed?.hue ?? 26;
  const warmth = trace?.visualSeed?.warmth ?? 0.76;
  return { '--orb-hue': hue, '--orb-warmth': warmth } as CSSProperties;
}

function dailyDiskStyle(disk: DemoDailyDisk, index: number): CSSProperties {
  const layouts = [
    { x: 54, y: 89, rotate: -4, ratio: 0.37 },
    { x: 36, y: 79, rotate: 7, ratio: 0.34 },
    { x: 65, y: 69, rotate: -8, ratio: 0.42 },
    { x: 43, y: 59, rotate: 5, ratio: 0.36 },
    { x: 68, y: 49, rotate: 9, ratio: 0.39 },
    { x: 34, y: 39, rotate: -7, ratio: 0.35 },
    { x: 64, y: 29, rotate: 5, ratio: 0.4 },
    { x: 41, y: 19, rotate: -5, ratio: 0.36 },
    { x: 58, y: 9, rotate: 7, ratio: 0.39 },
  ];
  const layout = layouts[index] ?? layouts[layouts.length - 1];
  const width = 112 + Math.sqrt(disk.count) * 47;
  return {
    '--disk-x': `${layout.x}%`,
    '--disk-y': `${layout.y}%`,
    '--disk-width': `${width}px`,
    '--disk-height': `${width * layout.ratio}px`,
    '--disk-rotate': `${layout.rotate}deg`,
    '--disk-counter-rotate': `${-layout.rotate}deg`,
    '--disk-layer': index + 4,
    '--disk-hue': disk.hue,
    '--disk-delay': `${220 + index * 125}ms`,
  } as CSSProperties;
}

function MemoryVine() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    let animationFrame = 0;

    const draw = (progress = 1) => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(bounds.width * ratio);
      canvas.height = Math.round(bounds.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);

      const paintVine = (alpha: number) => {
        const stems = [
          () => {
            context.moveTo(bounds.width * 0.52, bounds.height * 0.97);
            context.bezierCurveTo(bounds.width * 0.47, bounds.height * 0.84, bounds.width * 0.62, bounds.height * 0.74, bounds.width * 0.43, bounds.height * 0.59);
            context.bezierCurveTo(bounds.width * 0.29, bounds.height * 0.49, bounds.width * 0.47, bounds.height * 0.28, bounds.width * 0.41, bounds.height * 0.18);
            context.bezierCurveTo(bounds.width * 0.38, bounds.height * 0.13, bounds.width * 0.48, bounds.height * 0.08, bounds.width * 0.58, bounds.height * 0.035);
          },
          () => {
            context.moveTo(bounds.width * 0.52, bounds.height * 0.97);
            context.bezierCurveTo(bounds.width * 0.64, bounds.height * 0.86, bounds.width * 0.56, bounds.height * 0.76, bounds.width * 0.65, bounds.height * 0.69);
            context.bezierCurveTo(bounds.width * 0.77, bounds.height * 0.59, bounds.width * 0.61, bounds.height * 0.53, bounds.width * 0.68, bounds.height * 0.49);
            context.bezierCurveTo(bounds.width * 0.74, bounds.height * 0.43, bounds.width * 0.56, bounds.height * 0.35, bounds.width * 0.64, bounds.height * 0.29);
            context.bezierCurveTo(bounds.width * 0.7, bounds.height * 0.22, bounds.width * 0.57, bounds.height * 0.14, bounds.width * 0.58, bounds.height * 0.035);
          },
          () => {
            context.moveTo(bounds.width * 0.52, bounds.height * 0.97);
            context.bezierCurveTo(bounds.width * 0.35, bounds.height * 0.87, bounds.width * 0.43, bounds.height * 0.82, bounds.width * 0.36, bounds.height * 0.79);
            context.bezierCurveTo(bounds.width * 0.25, bounds.height * 0.73, bounds.width * 0.37, bounds.height * 0.65, bounds.width * 0.43, bounds.height * 0.59);
            context.bezierCurveTo(bounds.width * 0.51, bounds.height * 0.51, bounds.width * 0.28, bounds.height * 0.45, bounds.width * 0.34, bounds.height * 0.39);
            context.bezierCurveTo(bounds.width * 0.41, bounds.height * 0.31, bounds.width * 0.35, bounds.height * 0.25, bounds.width * 0.41, bounds.height * 0.18);
          },
        ];

        stems.forEach((stem, stemIndex) => {
          context.beginPath();
          stem();
          context.lineCap = 'round';
          context.lineJoin = 'round';
          context.strokeStyle = `rgba(255,255,255,${(stemIndex === 0 ? 0.38 : 0.28) * alpha})`;
          context.lineWidth = stemIndex === 0 ? 5 : 4;
          context.stroke();
          context.strokeStyle = `rgba(151,82,88,${(stemIndex === 0 ? 0.56 : 0.42) * alpha})`;
          context.lineWidth = stemIndex === 0 ? 1.35 : 1;
          context.stroke();
        });
      };

      paintVine(0.16);
      context.save();
      context.beginPath();
      context.rect(0, bounds.height * (1 - progress), bounds.width, bounds.height * progress);
      context.clip();
      paintVine(1);
      context.restore();
    };

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startedAt = performance.now();
    const animate = (now: number) => {
      const elapsed = Math.min(1, (now - startedAt) / 1700);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      draw(reduceMotion ? 1 : eased);
      if (elapsed < 1 && !reduceMotion) animationFrame = window.requestAnimationFrame(animate);
    };
    animationFrame = window.requestAnimationFrame(animate);

    const resizeObserver = new ResizeObserver(() => draw(1));
    resizeObserver.observe(canvas);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="ecology-vine" aria-hidden="true" />;
}

function movePebbleGlow(event: ReactPointerEvent<HTMLDivElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  let x = (event.clientX - bounds.left) / bounds.width;
  let y = (event.clientY - bounds.top) / bounds.height;
  const radiusX = 0.34;
  const radiusY = 0.38;
  const normalizedX = (x - 0.5) / radiusX;
  const normalizedY = (y - 0.5) / radiusY;
  const distance = Math.hypot(normalizedX, normalizedY);
  if (distance > 1) {
    x = 0.5 + (normalizedX / distance) * radiusX;
    y = 0.5 + (normalizedY / distance) * radiusY;
  }
  event.currentTarget.style.setProperty('--pebble-glow-x', `${x * 100}%`);
  event.currentTarget.style.setProperty('--pebble-glow-y', `${y * 100}%`);
}

function resetPebbleGlow(event: ReactPointerEvent<HTMLDivElement>) {
  event.currentTarget.style.setProperty('--pebble-glow-x', '50%');
  event.currentTarget.style.setProperty('--pebble-glow-y', '62%');
  event.currentTarget.classList.remove('pebble--pressed');
}

function pressPebble(event: ReactPointerEvent<HTMLDivElement>) {
  event.currentTarget.classList.add('pebble--pressed');
}

function releasePebble(event: ReactPointerEvent<HTMLDivElement>) {
  event.currentTarget.classList.remove('pebble--pressed');
}

function Pebble({ awake = false, interactive = false }: { awake?: boolean; interactive?: boolean }) {
  return (
    <div className={`pebble ${awake ? 'pebble--awake' : ''} ${interactive ? 'pebble--interactive' : ''}`} onPointerMove={interactive ? movePebbleGlow : undefined} onPointerDown={interactive ? pressPebble : undefined} onPointerUp={interactive ? releasePebble : undefined} onPointerCancel={interactive ? releasePebble : undefined} onPointerLeave={interactive ? resetPebbleGlow : undefined} aria-hidden="true">
      <span className="pebble__shine" />
      <span className="pebble__glow" />
      <span className="pebble__word">TRACE</span>
    </div>
  );
}

function MemoryOrb({ trace, large = false }: { trace?: Trace; large?: boolean }) {
  return <span className={`memory-orb ${large ? 'memory-orb--large' : ''}`} style={orbStyle(trace)} aria-hidden="true"><i /></span>;
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>('today');
  const [layer, setLayer] = useState<Layer>('none');
  const [traces, setTraces] = useState<Trace[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [selectedDay, setSelectedDay] = useState<DemoDailyDisk>();
  const [claimText, setClaimText] = useState('');
  const [feelingTags, setFeelingTags] = useState<FeelingTag[]>([]);
  const [relationTags, setRelationTags] = useState<RelationTag[]>([]);
  const [laterText, setLaterText] = useState('');
  const [pulse, setPulse] = useState(false);
  const [notice, setNotice] = useState('');
  const [captureReceipt, setCaptureReceipt] = useState('');
  const [deviceState, setDeviceState] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');
  const [deviceSlot, setDeviceSlot] = useState<number | null>(null);
  const [assignedDevice, setAssignedDevice] = useState<TraceGatewayDevice>();
  const [telemetry, setTelemetry] = useState<TraceGatewayTelemetry>();
  const [replayState, setReplayState] = useState<'idle' | 'pending' | 'ok' | 'error'>('idle');
  const [calibrationState, setCalibrationState] = useState<'idle' | 'pending' | 'ok' | 'error'>('idle');
  const [settingKey, setSettingKey] = useState<'tonight' | 'reunion' | 'privacy' | 'export'>('tonight');
  const [tonightReminder, setTonightReminder] = useState(true);
  const [reunionReminder, setReunionReminder] = useState(true);
  const bleRef = useRef<BleCaptureAdapter>();
  const bleUnsubscribeRef = useRef<() => void>();
  const gatewayRef = useRef<TraceSoftwareAdapter>();
  const profileIdRef = useRef('trace-shared');
  const transportRef = useRef<'websocket' | 'ble'>('websocket');
  const captureTimerRef = useRef<number>();
  const replayTimerRef = useRef<number>();
  const calibrationTimerRef = useRef<number>();
  const pendingReplayRef = useRef<string>();
  const pendingCalibrationRef = useRef<string>();

  function receiveGatewayMoment(moment: TraceGatewayMoment) {
    setPulse(true);
    window.setTimeout(() => setPulse(false), 720);
    window.clearTimeout(captureTimerRef.current);
    setCaptureReceipt(`${pebbleName(moment.pebbleSlot, moment.pebbleLabel)} 已接住`);
    captureTimerRef.current = window.setTimeout(() => setCaptureReceipt(''), 3200);
    setTraces((current) => {
      if (current.some((trace) => trace.id === moment.hardwareEventId)) return current;
      const now = new Date().toISOString();
      const trace: Trace = {
        id: moment.hardwareEventId,
        hardwareEventId: moment.hardwareEventId,
        capturedAt: moment.capturedAt,
        source: 'websocket',
        pebbleId: moment.pebbleId,
        pebbleLabel: moment.pebbleLabel,
        pebbleSlot: moment.pebbleSlot,
        light: moment.light,
        lightRaw: moment.lightRaw,
        motion: moment.motion ?? 0,
        profileId: moment.profileId,
        pressure: { durationMs: moment.durationMs, peak: moment.pressure },
        state: 'unclaimed',
        createdAt: now,
        updatedAt: now,
      };
      return [trace, ...current];
    });
  }

  useEffect(() => {
    let mountedGateway: TraceSoftwareAdapter | undefined;
    let detachGatewayListeners = () => {};
    const hydrateTimer = window.setTimeout(() => {
      const query = new URLSearchParams(window.location.search);
      const gateway = TraceSoftwareAdapter.fromLocation();
      mountedGateway = gateway;
      gatewayRef.current = gateway;
      setDeviceSlot(gateway.deviceSlot);
      profileIdRef.current = gateway.profileId;
      transportRef.current = query.get('traceTransport') === 'ble' ? 'ble' : 'websocket';
      setTraces(createRoadshowTraces(loadTraces(gateway.profileId)));

      const onConnecting = () => setDeviceState('connecting');
      const onConnection = (event: Event) => {
        const detail = (event as CustomEvent<{ connected: boolean }>).detail;
        setDeviceState(detail.connected ? (gateway.deviceSlot ? 'connecting' : 'connected') : 'disconnected');
        setNotice(detail.connected ? `正在确认${pebbleName(gateway.deviceSlot ?? undefined)}…` : '连接已断开，正在自动重连…');
        window.setTimeout(() => setNotice(''), 3000);
      };
      const onDevices = (event: Event) => {
        const devices = (event as CustomEvent<TraceGatewayDevice[]>).detail;
        const selected = gateway.deviceSlot
          ? devices.find((device) => Number(device.device_slot) === gateway.deviceSlot)
          : devices.find((device) => device.connected);
        setAssignedDevice(selected);
        setDeviceState(selected?.connected ? 'connected' : 'disconnected');
      };
      const onDevice = (event: Event) => {
        const detail = (event as CustomEvent<TraceGatewayDevice & { status?: string }>).detail;
        if (gateway.deviceSlot && Number(detail.device_slot) !== gateway.deviceSlot) return;
        setAssignedDevice((current) => ({ ...current, ...detail, connected: detail.status === 'connected' }));
        setDeviceState(detail.status === 'connected' ? 'connected' : 'disconnected');
        setNotice(detail.status === 'connected' ? `${pebbleName(detail.device_slot, detail.device_label)} 已恢复连接` : `${pebbleName(detail.device_slot, detail.device_label)} 暂时离线，正在重连…`);
        window.setTimeout(() => setNotice(''), 3500);
      };
      const onBridge = (event: Event) => {
        const detail = (event as CustomEvent<{ status?: string }>).detail;
        if (detail.status === 'disconnected') setDeviceState('disconnected');
      };
      const onMoment = (event: Event) => receiveGatewayMoment((event as CustomEvent<TraceGatewayMoment>).detail);
      const onTelemetry = (event: Event) => {
        const detail = (event as CustomEvent<TraceGatewayTelemetry>).detail;
        setTelemetry(detail);
        setDeviceState('connected');
      };
      const onAck = (event: Event) => {
        const detail = (event as CustomEvent<TraceGatewayAck>).detail;
        if (detail.action === 'replay' && detail.status === 'ok' && detail.request_id === pendingReplayRef.current) {
          window.clearTimeout(replayTimerRef.current);
          pendingReplayRef.current = undefined;
          setReplayState('ok');
          setNotice(`${pebbleName(detail.device_slot, detail.device_label)} 已轻轻回应`);
          window.setTimeout(() => setReplayState('idle'), 2400);
          window.setTimeout(() => setNotice(''), 3000);
        }
        if (detail.action === 'calibrate' && detail.status === 'ok' && detail.request_id === pendingCalibrationRef.current) {
          window.clearTimeout(calibrationTimerRef.current);
          pendingCalibrationRef.current = undefined;
          setCalibrationState('ok');
          setNotice(`${pebbleName(detail.device_slot, detail.device_label)} 已完成压力校准`);
          window.setTimeout(() => setCalibrationState('idle'), 2400);
          window.setTimeout(() => setNotice(''), 3000);
        }
      };
      const onHardwareError = () => {
        if (pendingReplayRef.current) {
          pendingReplayRef.current = undefined;
          setReplayState('error');
        }
        if (pendingCalibrationRef.current) {
          pendingCalibrationRef.current = undefined;
          setCalibrationState('error');
        }
        setNotice('实体 Pebble 暂时没有回应，连接恢复后可再次尝试');
        window.setTimeout(() => setNotice(''), 4000);
      };
      gateway.addEventListener('connecting', onConnecting);
      gateway.addEventListener('connection', onConnection);
      gateway.addEventListener('devices', onDevices);
      gateway.addEventListener('device', onDevice);
      gateway.addEventListener('bridge', onBridge);
      gateway.addEventListener('moment', onMoment);
      gateway.addEventListener('telemetry', onTelemetry);
      gateway.addEventListener('ack', onAck);
      gateway.addEventListener('hardwareerror', onHardwareError);

      const debugWindow = window as Window & { __TRACE_MOCK_EVENT__?: (overrides?: Record<string, unknown>) => void };
      if (import.meta.env.DEV) debugWindow.__TRACE_MOCK_EVENT__ = (overrides) => gateway.injectMockEvent(overrides);
      if (query.has('traceDeviceSlot') && transportRef.current === 'websocket') gateway.connect();
      setReady(true);

      detachGatewayListeners = () => {
        gateway.removeEventListener('connecting', onConnecting);
        gateway.removeEventListener('connection', onConnection);
        gateway.removeEventListener('devices', onDevices);
        gateway.removeEventListener('device', onDevice);
        gateway.removeEventListener('bridge', onBridge);
        gateway.removeEventListener('moment', onMoment);
        gateway.removeEventListener('telemetry', onTelemetry);
        gateway.removeEventListener('ack', onAck);
        gateway.removeEventListener('hardwareerror', onHardwareError);
      };
    }, 0);
    return () => {
      window.clearTimeout(hydrateTimer);
      detachGatewayListeners();
      window.clearTimeout(captureTimerRef.current);
      window.clearTimeout(replayTimerRef.current);
      window.clearTimeout(calibrationTimerRef.current);
      bleUnsubscribeRef.current?.();
      mountedGateway?.disconnect();
      if (gatewayRef.current === mountedGateway) gatewayRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (ready) saveTraces(traces, profileIdRef.current);
  }, [ready, traces]);

  const activeTrace = useMemo(() => traces.find((trace) => trace.id === activeId), [activeId, traces]);
  // Keep the server HTML and the browser's first render identical. Localized
  // dates are filled only after hydration, when the user's timezone is known.
  const currentMonthLabel = ready ? new Intl.DateTimeFormat('zh-CN', { month: 'long' }).format(new Date()) : '本月';
  const currentYear = ready ? new Date().getFullYear() : '';
  const todayLabel = ready
    ? new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date()).replace('星期', ' · 星期')
    : '今天';
  const unclaimed = traces.filter((trace) => trace.state === 'unclaimed');
  const alive = traces.filter((trace) => trace.state === 'alive');
  const latestUnclaimed = unclaimed[0];
  const oldestDays = alive.length ? Math.max(...alive.map((trace) => daysTogether(trace.capturedAt))) : 0;
  const weekMemories = alive.filter((trace) => daysTogether(trace.capturedAt) <= 7);
  const monthMemories = alive.filter((trace) => isThisMonth(trace.capturedAt));
  const ringReady = alive.length >= 5 || oldestDays >= 7;
  const monthRingReady = oldestDays >= 21 && monthMemories.length >= 8;
  const ringMemories = monthRingReady ? monthMemories : weekMemories;
  const reunionTrace = alive.find((trace) => daysTogether(trace.capturedAt) >= 7);
  const monthReunion = alive.find((trace) => {
    const age = daysTogether(trace.capturedAt);
    return age >= 30 && age <= 90;
  });
  const yearReunion = alive.find((trace) => {
    const date = new Date(trace.capturedAt);
    const now = new Date();
    return date.getFullYear() < now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  });
  const ringRelationCounts = relationOptions.map((option) => ({
    ...option,
    count: ringMemories.filter((trace) => explicitRelations(trace).includes(option.value)).length,
  })).filter((item) => item.count > 0);
  const ecologyMemories = [...alive].sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  const deviceDisplayName = pebbleName(deviceSlot ?? assignedDevice?.device_slot, assignedDevice?.device_label);
  const deviceContext = telemetry
    ? `${lightContext(telemetry.light, telemetry.light_raw)} · 压力基线 ${telemetry.baseline ?? '—'}`
    : '等待第一组传感器状态';

  function receiveCapture(event: CaptureEvent) {
    setPulse(true);
    window.setTimeout(() => setPulse(false), 720);
    window.clearTimeout(captureTimerRef.current);
    setCaptureReceipt('Pebble 已接住');
    captureTimerRef.current = window.setTimeout(() => setCaptureReceipt(''), 3200);
    setTraces((current) => {
      if (current.some((trace) => trace.id === event.eventId)) return current;
      const now = new Date().toISOString();
      const trace: Trace = {
        id: event.eventId,
        capturedAt: event.capturedAt,
        source: event.source,
        pressure: { durationMs: event.durationMs, peak: event.pressurePeak },
        state: 'unclaimed',
        createdAt: now,
        updatedAt: now,
      };
      return [trace, ...current];
    });
  }

  async function connectPebble() {
    setDeviceState('connecting');
    setNotice('正在寻找 Pebble…');
    try {
      if (transportRef.current === 'websocket') {
        gatewayRef.current?.connect();
        return;
      }
      const adapter = bleRef.current ?? new BleCaptureAdapter();
      bleRef.current = adapter;
      bleUnsubscribeRef.current?.();
      bleUnsubscribeRef.current = adapter.subscribe(receiveCapture);
      await adapter.connect();
      setDeviceState('connected');
      setNotice('Pebble 已连接');
    } catch (error) {
      setDeviceState('idle');
      setNotice(error instanceof Error ? error.message : '暂时无法连接，Pebble 会在恢复连接后继续同步。');
    }
    window.setTimeout(() => setNotice(''), 4500);
  }

  function replayTrace(trace: Trace) {
    if (!trace.hardwareEventId) {
      setNotice('这是一条演示记忆，没有对应的实体 Pebble');
      window.setTimeout(() => setNotice(''), 3000);
      return;
    }
    try {
      const requestId = gatewayRef.current?.replay({
        hardwareEventId: trace.hardwareEventId,
        pebbleId: trace.pebbleId,
        pebbleLabel: trace.pebbleLabel,
        pebbleSlot: trace.pebbleSlot,
        capturedAt: trace.capturedAt,
        pressure: trace.pressure?.peak,
        durationMs: trace.pressure?.durationMs,
        light: trace.light,
        lightRaw: trace.lightRaw,
        motion: trace.motion,
        profileId: trace.profileId ?? profileIdRef.current,
      });
      if (!requestId) throw new Error('TRACE 网关尚未连接');
      window.clearTimeout(replayTimerRef.current);
      pendingReplayRef.current = requestId;
      setReplayState('pending');
      setNotice(`正在让${pebbleName(trace.pebbleSlot, trace.pebbleLabel)}回应…`);
      replayTimerRef.current = window.setTimeout(() => {
        if (pendingReplayRef.current !== requestId) return;
        pendingReplayRef.current = undefined;
        setReplayState('error');
        setNotice('没有收到同一回放请求的确认，请检查实体 Pebble');
      }, 6000);
    } catch (error) {
      setReplayState('error');
      setNotice(error instanceof Error ? error.message : 'Pebble 暂时没有回应');
    }
  }

  function calibratePebble() {
    try {
      const requestId = gatewayRef.current?.calibrate();
      if (!requestId) throw new Error('TRACE 网关尚未连接');
      window.clearTimeout(calibrationTimerRef.current);
      pendingCalibrationRef.current = requestId;
      setCalibrationState('pending');
      setNotice(`请松开${deviceDisplayName}，正在重新校准压力…`);
      calibrationTimerRef.current = window.setTimeout(() => {
        if (pendingCalibrationRef.current !== requestId) return;
        pendingCalibrationRef.current = undefined;
        setCalibrationState('error');
        setNotice('没有收到同一校准请求的确认，请松开传感器后重试');
      }, 6000);
    } catch (error) {
      setCalibrationState('error');
      setNotice(error instanceof Error ? error.message : '暂时无法校准');
    }
  }

  function openClaim(trace: Trace) {
    setActiveId(trace.id);
    setClaimText('');
    setFeelingTags([]);
    setRelationTags([]);
    setLayer('claim');
  }

  function openDetail(trace: Trace) {
    setActiveId(trace.id);
    setLaterText('');
    setLayer('detail');
  }

  function openDay(disk: DemoDailyDisk) {
    setSelectedDay(disk);
    setLayer('day');
  }

  async function submitClaim(event: FormEvent) {
    event.preventDefault();
    const text = claimText.trim();
    if (!activeTrace || !text) return;
    const traceId = activeTrace.id;
    const capturedAt = activeTrace.capturedAt;
    setTraces((current) => current.map((trace) => trace.id === traceId ? { ...trace, state: 'growing', originalText: text, feelingTags, relationTags, updatedAt: new Date().toISOString() } : trace));
    setLayer('growing');

    const [result] = await Promise.all([growMemory(text, capturedAt), sleep(2100)]);
    setTraces((current) => current.map((trace) => trace.id === traceId ? {
      ...trace,
      state: 'alive',
      originalText: text,
      title: result.title,
      echo: result.echo,
      generatedBy: result.generatedBy,
      visualSeed: result.visualSeed,
      feelingTags,
      relationTags,
      updatedAt: new Date().toISOString(),
    } : trace));
    setLayer('detail');
  }

  function toggleTag<T extends string>(value: T, current: T[], update: (next: T[]) => void) {
    update(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function addLaterNote(event: FormEvent) {
    event.preventDefault();
    const text = laterText.trim();
    if (!activeTrace || !text) return;
    setTraces((current) => current.map((trace) => trace.id === activeTrace.id ? {
      ...trace,
      laterNotes: [...(trace.laterNotes ?? []), { id: `note-${Date.now()}`, text, createdAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    } : trace));
    setLaterText('');
    setNotice('后来的话，已经放进这颗记忆里');
    window.setTimeout(() => setNotice(''), 3000);
  }

  function openSetting(key: typeof settingKey) {
    setSettingKey(key);
    setLayer('setting');
  }

  function exportMemories() {
    const blob = new Blob([JSON.stringify(alive, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'trace-memories.json';
    link.click();
    URL.revokeObjectURL(url);
    setLayer('none');
    setNotice(`已导出 ${alive.length} 条记忆`);
    window.setTimeout(() => setNotice(''), 3000);
  }

  return (
    <main className="app-shell">
      <div className="phone-status" aria-hidden="true">
        <span>9:41</span>
        <span className="phone-status__island" />
        <span className="phone-status__signals">▮▮▮ ᯤ ▰</span>
      </div>
      <div className="ambient ambient--peach" /><div className="ambient ambient--lilac" />
      <header className="topbar">
        <button className="brand brand-button" type="button" onClick={() => setView('today')} aria-label="TRACE 首页"><span className="brand__mark" /><span>TRACE</span></button>
        <nav className="nav-tabs" aria-label="主要页面">
          <button className={`nav-tab ${view === 'today' ? 'nav-tab--active' : ''}`} type="button" onClick={() => setView('today')}>今天</button>
          <button className={`nav-tab ${view === 'garden' ? 'nav-tab--active' : ''}`} type="button" onClick={() => setView('garden')}>花园 <span className="nav-count">{alive.length}</span></button>
          <button className={`nav-tab ${view === 'mine' ? 'nav-tab--active' : ''}`} type="button" onClick={() => setView('mine')}>我的</button>
        </nav>
        <button className="device-pill" type="button" onClick={connectPebble} disabled={deviceState === 'connecting'}>
          <span className={`device-pill__dot ${deviceState === 'connected' ? 'device-pill__dot--online' : ''}`} />
          {deviceState === 'connected' ? `${deviceDisplayName} 在线` : deviceState === 'connecting' ? `正在确认${deviceDisplayName}…` : deviceState === 'disconnected' ? `${deviceDisplayName} 离线` : deviceDisplayName}
        </button>
      </header>

      {view === 'today' ? (
        <>
          <section className="hero" id="top">
            <div className="hero__copy">
              <p className="eyebrow">{latestUnclaimed ? `来自 ${pebbleName(latestUnclaimed.pebbleSlot, latestUnclaimed.pebbleLabel).toUpperCase()} · ${formatTime(latestUnclaimed.capturedAt)}` : todayLabel}</p>
              <h1>{latestUnclaimed ? <>你在 {formatTime(latestUnclaimed.capturedAt)}，<br />留下了一个记号</> : alive.length ? <>今天的记忆，<br />已经在生长</> : <>Pebble 在身边，<br />替你守住当下</>}</h1>
              <p className="hero__lead">{latestUnclaimed ? '当时不用掏出手机。现在如果想起来了，可以补一句发生了什么；也可以晚一点再回来。' : alive.length ? `今天已有 ${alive.length} 颗记忆留在花园里。` : '想留下这一刻时，只需在现实里轻轻捏一下。'}</p>
              <div className="hero__actions">
                {latestUnclaimed ? <button className="primary-button" type="button" onClick={() => openClaim(latestUnclaimed)}>补充 {formatTime(latestUnclaimed.capturedAt)} 的那一刻 <span>→</span></button> : <button className="primary-button" type="button" onClick={() => setView('garden')}>看看花园 <span>→</span></button>}
                <button className="quiet-button" type="button" onClick={connectPebble}>{deviceState === 'connected' ? `${deviceDisplayName} 在线` : deviceState === 'disconnected' ? '重新连接' : '连接 Pebble'}</button>
              </div>
              <p className="hint">Pebble 只留下时间与触感，不会录音。</p>
            </div>
            <div className="hero__object"><div className={`halo ${pulse ? 'halo--pulse' : ''}`} /><Pebble awake={pulse || Boolean(latestUnclaimed)} interactive /><p className={`capture-toast ${captureReceipt ? 'capture-toast--show' : ''}`} role="status" aria-live="polite"><span>✓</span> {captureReceipt || '这一刻接住了'}</p></div>
          </section>

          {reunionTrace && (
            <section className="reunion-card">
              <MemoryOrb trace={reunionTrace} />
              <div><p className="eyebrow">{daysTogether(reunionTrace.capturedAt) - 1} DAYS AGO</p><h2>有一枚记忆，今天想回来看看你</h2><p>它已经和你一起走过 {daysTogether(reunionTrace.capturedAt)} 天。</p></div>
              <button type="button" className="claim-button" onClick={() => openDetail(reunionTrace)}>与它重逢 <span>→</span></button>
            </section>
          )}

          <section className="today-section" id="moments" aria-labelledby="today-title">
            <div className="section-heading"><div><p className="eyebrow">YOUR MOMENTS</p><h2 id="today-title">今天的痕迹</h2></div><p>{unclaimed.length ? `${unclaimed.length} 个瞬间等你补一句` : '都已安静地收好了'}</p></div>
            {unclaimed.length ? unclaimed.map((trace) => (
              <article className="trace-card trace-card--compact" key={trace.id}>
                <div className="trace-orb" aria-hidden="true"><span /></div>
                <div className="trace-card__body"><div className="trace-card__meta"><time>{formatTime(trace.capturedAt)}</time><b>· {pebbleName(trace.pebbleSlot, trace.pebbleLabel)}</b></div><h3>那时发生了什么？</h3><p className="trace-card__context">{touchContext(trace)} · {lightContext(trace.light, trace.lightRaw)}</p></div>
                <button className="trace-card__action" type="button" onClick={() => openClaim(trace)} aria-label={`补充 ${formatTime(trace.capturedAt)} 的那一刻`}><span className="pencil-icon" aria-hidden="true" /></button>
              </article>
            )) : (
              <div className="empty-state"><div className="empty-state__orb" /><p>{alive.length ? '今天的痕迹都已经长进花园了。' : '捏住 Pebble 后，新的一刻会安静地出现在这里。'}</p></div>
            )}
          </section>
        </>
      ) : view === 'garden' ? (
        <section className="garden-page">
          <div className="garden-heading"><div><p className="eyebrow">YOUR SEASON · {currentMonthLabel}</p><h1>你的记忆花园</h1><p>{alive.length ? '那些被你认真留下的小事，正在这里获得自己的时间。' : '第一颗记忆出现后，花园会慢慢长出自己的样子。'}</p></div></div>

          <button className={`ring-card ${ringReady ? 'ring-card--ready' : ''}`} type="button" onClick={() => setLayer('ring')}>
            <span className="ring-card__rings" aria-hidden="true"><i /><i /><i /></span>
            <span className="ring-card__copy"><small>{monthRingReady ? 'MONTHLY RING' : ringReady ? 'WEEKLY GLOW' : 'FORMING'}</small><strong>{monthRingReady ? '你的本月记忆切片' : ringReady ? '本周拾光已经长好了' : '这一周的拾光正在形成'}</strong><em>{monthRingReady ? `这个月留下了 ${monthMemories.length} 个瞬间` : ringReady ? `这一周留下了 ${weekMemories.length} 个瞬间` : `已经留下 ${alive.length} 颗，再多一点时间就会长出回望`}</em></span>
            <span className="ring-card__arrow">→</span>
          </button>

          <section className="ecology-section">
            <div className="ecology-heading">
              <div><p className="eyebrow">DAILY MEMORY GROWTH</p><h2>八月的记忆圆盘</h2></div>
              <p>一天长出一个圆盘。留下的瞬间越多，它就生长得越丰盛。</p>
            </div>

            <div className="ecology-atlas ecology-atlas--disks" aria-label="8月20日至8月28日的每日记忆圆盘">
              <MemoryVine />
              <span className="ecology-tip" aria-hidden="true"><i /></span>
              <span className="ecology-time ecology-time--now">8月28日 · 现在</span>
              <span className="ecology-time ecology-time--year">8月20日</span>

              {demoDailyDisks.map((disk, index) => (
                <button className="daily-disk" type="button" style={dailyDiskStyle(disk, index)} onClick={() => openDay(disk)} aria-label={`打开8月${disk.day}日的记忆`} key={disk.day}>
                  <span className="daily-disk__surface" aria-hidden="true"><i /><i /><i /></span>
                  <time>8月{disk.day}日</time>
                </button>
              ))}
            </div>

            <details className="memory-index">
              <summary><span>按时间查看全部记忆</span><em>{alive.length}</em></summary>
              <div className="memory-index__list">
                {ecologyMemories.map((trace) => <button type="button" onClick={() => openDetail(trace)} key={`index-${trace.id}`}><MemoryOrb trace={trace} /><span><b>{trace.title}</b><small>{new Intl.DateTimeFormat('zh-CN', { year:'numeric', month:'long', day:'numeric' }).format(new Date(trace.capturedAt))}</small></span><i>→</i></button>)}
              </div>
            </details>
          </section>

          <section className="time-letters">
            <div className="garden-section-title"><div><p className="eyebrow">TIME LETTERS</p><h2>时间来信</h2></div><span>最多每周一次</span></div>
            <div className="time-letter-row">
              <button type="button" className={reunionTrace ? 'is-ready' : ''} disabled={!reunionTrace} onClick={() => reunionTrace && openDetail(reunionTrace)}><small>一周以后</small><b>{reunionTrace ? '上周的这一刻，想回来看看你' : '时间到了，会有一颗记忆回来'}</b><span>{reunionTrace ? '打开重逢 →' : '安静等待'}</span></button>
              <button type="button" className={monthReunion ? 'is-ready' : ''} disabled={!monthReunion} onClick={() => monthReunion && openDetail(monthReunion)}><small>一个月以后</small><b>{monthReunion ? '有些小事，隔一段时间才开始发光' : '一枚月度记忆切片会在这里出现'}</b><span>{monthReunion ? '打开重逢 →' : '还没到时候'}</span></button>
              <button type="button" className={yearReunion ? 'is-ready' : ''} disabled={!yearReunion} onClick={() => yearReunion && openDetail(yearReunion)}><small>那年今日</small><b>{yearReunion ? '去年的今天，你曾留下这一刻' : '一年后的今天，它会带着时间回来'}</b><span>{yearReunion ? '打开重逢 →' : '未来来信'}</span></button>
            </div>
          </section>

        </section>
      ) : (
        <section className="mine-page">
          <div className="mine-heading"><p className="eyebrow">MY TRACE</p><h1>我的</h1><p>管理 Pebble、回忆节奏与只属于你的数据。</p></div>
          <section className="pebble-device-card">
            <div className="device-mini"><Pebble awake={deviceState === 'connected'} /></div>
            <div><span className="device-status"><i className={deviceState === 'connected' ? 'is-online' : ''} />{deviceState === 'connected' ? '实体设备在线' : deviceState === 'connecting' ? '正在确认实体设备' : deviceState === 'disconnected' ? '实体设备离线 · 自动重连中' : '等待连接'}</span><h2>{deviceDisplayName}</h2><p>{deviceState === 'connected' ? `${deviceContext}。有效捏压会短振确认并自动来到“今天”。` : '连接恢复后，未完成的记忆仍保留在当前用户空间。'}</p></div>
            <button type="button" className="quiet-button" disabled={calibrationState === 'pending'} onClick={deviceState === 'connected' ? calibratePebble : connectPebble}>{calibrationState === 'pending' ? '校准中…' : calibrationState === 'ok' ? '校准完成 ✓' : calibrationState === 'error' ? '再次校准' : deviceState === 'connected' ? '重新校准' : deviceState === 'disconnected' ? '重新连接' : '连接'}</button>
          </section>
          <section className="settings-group"><h2>温柔提醒</h2><button type="button" onClick={() => openSetting('tonight')}><span><b>今晚补一句</b><small>有待补充的瞬间时，晚上提醒一次</small></span><em>{tonightReminder ? '20:30' : '已关闭'}</em></button><button type="button" onClick={() => openSetting('reunion')}><span><b>旧日重逢</b><small>最多每周一次，不连续打扰</small></span><em>{reunionReminder ? '每周' : '已关闭'}</em></button></section>
          <section className="settings-group"><h2>记忆与隐私</h2><button type="button" onClick={() => openSetting('privacy')}><span><b>默认仅自己可见</b><small>原话、回声与年轮不会公开</small></span><em>仅自己</em></button><button type="button" onClick={() => openSetting('export')}><span><b>导出我的记忆</b><small>下载 JSON 文件，带走自己的内容</small></span><em>›</em></button></section>
          <p className="mine-note">TRACE 不统计连续天数，也不会为你的生活打分。</p>
        </section>
      )}

      <div className={`global-notice ${notice ? 'global-notice--show' : ''}`} role="status" aria-live="polite">{notice}</div>

      {layer !== 'none' && (
        <div className="layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && layer !== 'growing') setLayer('none'); }}>
          {layer === 'claim' && activeTrace && (
            <form className="claim-sheet" onSubmit={submitClaim}>
              <button className="sheet-close" type="button" onClick={() => setLayer('none')} aria-label="关闭">×</button>
              <MemoryOrb trace={activeTrace} />
              <p className="eyebrow">来自 {pebbleName(activeTrace.pebbleSlot, activeTrace.pebbleLabel).toUpperCase()} · {formatTime(activeTrace.capturedAt)}</p>
              <h2>那一刻，发生了什么？</h2>
              <p className="sheet-lead">不用完整，也不用写得好。一句话就够了。</p>
              <div className="hardware-context" aria-label="硬件捕获上下文"><span>{touchContext(activeTrace)}</span><span>{lightContext(activeTrace.light, activeTrace.lightRaw)}</span><span>已绑定原始事件</span></div>
              <label className="sr-only" htmlFor="claim-text">记下那一刻</label>
              <textarea id="claim-text" autoFocus maxLength={160} value={claimText} onChange={(event) => setClaimText(event.target.value)} placeholder="比如：风刚刚好。也可能是，那句话让我很不舒服。" />
              <div className="claim-tags"><span>这一刻更像</span><div>{feelingOptions.map((option) => <button type="button" className={`claim-tag--${option.tone} ${feelingTags.includes(option.value) ? 'is-selected' : ''}`} onClick={() => toggleTag(option.value, feelingTags, setFeelingTags)} key={option.value}>{option.label}</button>)}</div></div>
              <div className="claim-tags"><span>它和谁有关</span><div>{relationOptions.map((option) => <button type="button" className={relationTags.includes(option.value) ? 'is-selected' : ''} onClick={() => toggleTag(option.value, relationTags, setRelationTags)} key={option.value}>{option.label}</button>)}</div></div>
              <div className="claim-footer"><span>{claimText.length} / 160</span><button className="primary-button" type="submit" disabled={!claimText.trim()}>让它生长 <b>→</b></button></div>
            </form>
          )}
          {layer === 'growing' && (
            <div className="growing-sheet" role="status" aria-live="polite"><div className="growing-orb"><MemoryOrb trace={activeTrace} large /></div><p className="eyebrow">MEMORY IS GROWING</p><h2>正在让这一刻慢慢显形</h2><p>你的原话会被完整保留。</p></div>
          )}
          {layer === 'ring' && (
            <article className="ring-sheet">
              <button className="sheet-close" type="button" onClick={() => setLayer('none')} aria-label="关闭">×</button>
              <div className="ring-sheet__visual"><span className="year-rings" aria-hidden="true"><i /><i /><i /><i /></span><p>{monthRingReady ? `${currentYear} · ${currentMonthLabel}` : 'THIS WEEK'}</p></div>
              <div className="ring-sheet__copy">
                <p className="eyebrow">{monthRingReady ? '本月年轮' : ringReady ? '本周拾光' : '正在形成'}</p>
                <h2>{monthRingReady ? `这个${currentMonthLabel}留下的好日子` : ringReady ? '这一周，被你留下的光' : '时间正在把记忆放在一起'}</h2>
                {ringReady ? <p className="ring-summary">{monthRingReady ? '这个月' : '这一周'}留下了 {ringMemories.length} 个瞬间。{ringRelationCounts.length ? `其中 ${ringRelationCounts.map((item) => `${item.count} 个关于${item.label}`).join('，')}。` : '主题只会从你确认过的内容里慢慢显现。'}</p> : <p className="ring-summary">现在已经有 {alive.length} 颗记忆。使用满 7 天或留下 5 颗以后，本周拾光会自然长出来。</p>}
                {ringMemories.length > 0 && <div className="ring-memories">{ringMemories.slice(0,3).map((trace) => <button type="button" key={trace.id} onClick={() => openDetail(trace)}><MemoryOrb trace={trace} /><span><b>{trace.title}</b><small>{new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric'}).format(new Date(trace.capturedAt))}</small></span></button>)}</div>}
                <p className="ring-principle">这里只整理已经发生的生活，不评价你是否更快乐。</p>
                <button type="button" className="primary-button" onClick={() => setLayer('none')}>放回花园</button>
              </div>
            </article>
          )}
          {layer === 'day' && selectedDay && (
            <article className="day-sheet">
              <button className="sheet-close" type="button" onClick={() => setLayer('none')} aria-label="关闭">×</button>
              <div className="day-sheet__disk" style={dailyDiskStyle(selectedDay, selectedDay.day - 20)} aria-hidden="true"><span className="daily-disk__surface"><i /><i /><i /></span></div>
              <div className="day-sheet__copy">
                <p className="eyebrow">2026 · AUGUST</p>
                <h2>8月{selectedDay.day}日</h2>
                <p>这一天，你留下了 <strong>{selectedDay.count}</strong> 个瞬间。</p>
                <div className="day-sheet__summary"><span><b>{selectedDay.completed}</b><small>已经写下</small></span><span><b>{selectedDay.count - selectedDay.completed}</b><small>只留下触感</small></span></div>
                <div className="day-sheet__times"><span>出现的时间</span><div>{selectedDay.times.map((time) => <i key={time}>{time}</i>)}</div></div>
                <p className="ring-principle">这里只整理当天留下的痕迹，不评价这一天是否更好。</p>
                <button type="button" className="primary-button" onClick={() => setLayer('none')}>放回花园</button>
              </div>
            </article>
          )}
          {layer === 'setting' && (
            <article className="detail-sheet setting-sheet">
              <button className="sheet-close" type="button" onClick={() => setLayer('none')} aria-label="关闭">×</button>
              <div className="detail-copy">
                <p className="eyebrow">TRACE SETTINGS</p>
                {settingKey === 'tonight' && <><h2>今晚补一句</h2><p>有待补充的瞬间时，20:30 提醒一次。</p><button className="primary-button" type="button" onClick={() => { setTonightReminder((value) => !value); setLayer('none'); }}>{tonightReminder ? '关闭提醒' : '打开提醒'}</button></>}
                {settingKey === 'reunion' && <><h2>旧日重逢</h2><p>最多每周提醒一次，让过去的记忆安静回来。</p><button className="primary-button" type="button" onClick={() => { setReunionReminder((value) => !value); setLayer('none'); }}>{reunionReminder ? '关闭提醒' : '打开提醒'}</button></>}
                {settingKey === 'privacy' && <><h2>默认仅自己可见</h2><p>你的原话、回声与年轮只保存在本地演示账号中，不会公开。</p><button className="primary-button" type="button" onClick={() => setLayer('none')}>知道了</button></>}
                {settingKey === 'export' && <><h2>导出我的记忆</h2><p>将当前花园里的 {alive.length} 条记忆导出为 JSON 文件。</p><button className="primary-button" type="button" onClick={exportMemories}>下载记忆</button></>}
              </div>
            </article>
          )}
          {layer === 'detail' && activeTrace && (
            <article className="detail-sheet">
              <button className="sheet-close" type="button" onClick={() => setLayer('none')} aria-label="关闭">×</button>
              <div className="detail-visual"><MemoryOrb trace={activeTrace} large /><span>和你一起的第 {daysTogether(activeTrace.capturedAt)} 天</span></div>
              <div className="detail-copy">
                <p className="eyebrow">{new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(activeTrace.capturedAt))}</p>
                <h2>{activeTrace.title}</h2>
                <blockquote>“{activeTrace.originalText}”</blockquote>
                <div className="echo-box"><span>TRACE 的回声</span><p>{activeTrace.echo}</p></div>
                {activeTrace.hardwareEventId && <div className="hardware-context hardware-context--detail" aria-label="硬件来源"><span>{pebbleName(activeTrace.pebbleSlot, activeTrace.pebbleLabel)}</span><span>{touchContext(activeTrace)}</span><span>{lightContext(activeTrace.light, activeTrace.lightRaw)}</span></div>}
                {(activeTrace.feelingTags?.length || explicitRelations(activeTrace).length > 0) && <div className="detail-tags">{activeTrace.feelingTags?.map((tag) => <span key={tag}>{feelingOptions.find((item) => item.value === tag)?.label}</span>)}{explicitRelations(activeTrace).map((tag) => <span key={tag}>{relationOptions.find((item) => item.value === tag)?.label}</span>)}</div>}
                <p className="truth-note">原话由你写下 · {activeTrace.generatedBy === 'agent' ? '回声由 Memory Gardener 生成' : '当前使用本地温柔兜底'}</p>
                {activeTrace.hardwareEventId && <button className="quiet-button replay-button" type="button" disabled={replayState === 'pending'} onClick={() => replayTrace(activeTrace)}>{replayState === 'pending' ? '正在唤醒原来的 Pebble…' : replayState === 'ok' ? 'Pebble 已回应 ✓' : replayState === 'error' ? '再次唤醒 Pebble' : '让原来的 Pebble 回应一下'}</button>}
                <section className="later-notes"><div><p className="eyebrow">LATER WORDS</p><h3>后来的话</h3></div>{activeTrace.laterNotes?.map((note) => <blockquote key={note.id}>“{note.text}”<small>{new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric'}).format(new Date(note.createdAt))} 补上</small></blockquote>)}<form onSubmit={addLaterNote}><label className="sr-only" htmlFor="later-note">写下后来的话</label><textarea id="later-note" value={laterText} maxLength={120} onChange={(event) => setLaterText(event.target.value)} placeholder="如果今天再看它，你想补上一句什么？" /><button type="submit" disabled={!laterText.trim()}>放进这颗记忆里</button></form></section>
                <button className="primary-button" type="button" onClick={() => { setLayer('none'); setView('garden'); }}>放回花园</button>
              </div>
            </article>
          )}
        </div>
      )}
    </main>
  );
}
