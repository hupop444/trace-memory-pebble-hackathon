export type TraceGatewayMoment = {
  hardwareEventId: string;
  pebbleId?: string;
  pebbleLabel?: string;
  pebbleSlot?: number;
  capturedAt: string;
  pressure?: number;
  durationMs?: number;
  light?: number;
  lightRaw?: number;
  motion?: number;
  profileId: string;
};

export type TraceGatewayConnection = {
  connected: boolean;
  endpoint: string;
};

export type TraceGatewayDevice = {
  device_id?: string;
  device_label?: string;
  device_slot?: number;
  device_kind?: string;
  kind?: string;
  endpoint?: string;
  connected?: boolean;
};

export type TraceGatewayTelemetry = {
  status?: string;
  action?: string;
  request_id?: string;
  device_id?: string;
  device_label?: string;
  device_slot?: number;
  raw?: number;
  baseline?: number;
  light?: number;
  light_raw?: number;
  motion?: number;
  imu?: boolean;
};

export type TraceGatewayAck = TraceGatewayTelemetry & {
  action?: 'replay' | 'calibrate';
  status?: string;
};

type GatewayMessage = {
  type?: string;
  trigger?: string;
  status?: string;
  action?: string;
  request_id?: string;
  event_id?: string;
  captured_at?: string;
  device_id?: string;
  device_label?: string;
  device_slot?: number;
  pressure?: number;
  duration?: number;
  light?: number;
  light_raw?: number;
  motion?: number;
  raw?: number;
  baseline?: number;
  imu?: boolean;
  connected?: boolean;
  device_kind?: string;
  kind?: string;
  endpoint?: string;
  devices?: TraceGatewayDevice[];
};

type AdapterOptions = {
  reconnectMs?: number;
  deviceSlot?: number | null;
  profileId?: string;
};

function configuredEndpoint() {
  const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> };
  return meta.env?.VITE_TRACE_WS_URL;
}

export class TraceSoftwareAdapter extends EventTarget {
  readonly endpoint: string;
  readonly deviceSlot: number | null;
  readonly profileId: string;
  private readonly reconnectMs: number;
  private socket: WebSocket | null = null;
  private retryTimer?: number;
  private closedByUser = false;
  private seenEventIds = new Set<string>();
  private seenEventOrder: string[] = [];

  constructor(endpoint: string, options: AdapterOptions = {}) {
    super();
    this.endpoint = endpoint;
    this.reconnectMs = options.reconnectMs ?? 1200;
    this.deviceSlot = Number(options.deviceSlot) || null;
    this.profileId = options.profileId || (this.deviceSlot ? `trace-user-${String(this.deviceSlot).padStart(2, '0')}` : 'trace-shared');
  }

  static fromLocation(options: AdapterOptions & { endpoint?: string } = {}) {
    const query = new URLSearchParams(window.location.search);
    const deviceSlot = Number(query.get('traceDeviceSlot')) || options.deviceSlot || null;
    const profileId = query.get('traceProfile') || options.profileId;
    const endpoint = query.get('traceGateway') || options.endpoint || configuredEndpoint() || 'ws://127.0.0.1:8797/trace';
    return new TraceSoftwareAdapter(endpoint, { ...options, deviceSlot, profileId });
  }

  connect() {
    this.closedByUser = false;
    window.clearTimeout(this.retryTimer);
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    this.dispatchEvent(new CustomEvent('connecting'));
    const socket = new WebSocket(this.endpoint);
    this.socket = socket;
    socket.addEventListener('open', () => {
      const detail: TraceGatewayConnection = { connected: true, endpoint: this.endpoint };
      this.dispatchEvent(new CustomEvent('connection', { detail }));
    });
    socket.addEventListener('message', ({ data }) => this.handleMessage(data));
    socket.addEventListener('close', () => {
      if (this.socket === socket) this.socket = null;
      const detail: TraceGatewayConnection = { connected: false, endpoint: this.endpoint };
      this.dispatchEvent(new CustomEvent('connection', { detail }));
      if (!this.closedByUser) this.retryTimer = window.setTimeout(() => this.connect(), this.reconnectMs);
    });
    socket.addEventListener('error', () => socket.close());
  }

  disconnect() {
    this.closedByUser = true;
    window.clearTimeout(this.retryTimer);
    this.socket?.close();
    this.socket = null;
  }

  storageKey(name: string) {
    return `${name}:${this.profileId}`;
  }

  replay(target: TraceGatewayMoment) {
    return this.send('replay', target.hardwareEventId ? { event_id: target.hardwareEventId } : this.slotTarget());
  }

  calibrate() {
    return this.send('calibrate', this.slotTarget());
  }

  /** Development-only injection point for testing without hardware. */
  injectMockEvent(overrides: Partial<GatewayMessage> = {}) {
    const now = Date.now();
    this.handleMessage(JSON.stringify({
      type: 'trace_event',
      trigger: 'squeeze',
      pressure: 0.72,
      duration: 640,
      light: 0.24,
      motion: 0,
      device_id: `mock-pebble-${this.deviceSlot ?? 1}`,
      device_label: 'Mock Pebble',
      device_slot: this.deviceSlot ?? 1,
      event_id: `mock-${this.deviceSlot ?? 1}-${now}`,
      captured_at: new Date(now).toISOString(),
      ...overrides,
    }));
  }

  private handleMessage(data: unknown) {
    if (typeof data !== 'string') return;
    let message: GatewayMessage;
    try {
      message = JSON.parse(data) as GatewayMessage;
    } catch {
      return;
    }
    this.dispatchEvent(new CustomEvent('message', { detail: message }));
    if (message.type === 'trace_devices') {
      this.dispatchEvent(new CustomEvent('devices', { detail: message.devices ?? [] }));
    } else if (message.type === 'trace_device_connection' && this.accepts(message)) {
      this.dispatchEvent(new CustomEvent('device', { detail: message as TraceGatewayDevice & { status?: string } }));
    } else if (message.type === 'bridge_status') {
      this.dispatchEvent(new CustomEvent('bridge', { detail: message }));
    } else if (message.type === 'trace_event' && message.trigger === 'squeeze' && this.accepts(message) && this.rememberEvent(message.event_id)) {
      const detail: TraceGatewayMoment = {
        hardwareEventId: message.event_id!,
        pebbleId: message.device_id,
        pebbleLabel: message.device_label,
        pebbleSlot: message.device_slot,
        capturedAt: message.captured_at || new Date().toISOString(),
        pressure: message.pressure,
        durationMs: message.duration,
        light: message.light,
        lightRaw: message.light_raw,
        motion: message.motion ?? 0,
        profileId: this.profileId,
      };
      this.dispatchEvent(new CustomEvent('moment', { detail }));
    } else if (message.type === 'trace_status' && this.accepts(message)) {
      this.dispatchEvent(new CustomEvent('telemetry', { detail: message }));
      if (message.status === 'calibrated') {
        this.dispatchEvent(new CustomEvent('ack', {
          detail: { ...message, action: 'calibrate', status: 'ok' } satisfies TraceGatewayAck,
        }));
      }
    } else if (message.type === 'trace_ack' && this.accepts(message)) {
      this.dispatchEvent(new CustomEvent('ack', { detail: message }));
    } else if (message.type === 'trace_command_routed' && this.accepts(message)) {
      this.dispatchEvent(new CustomEvent('command', { detail: message }));
    } else if (message.type === 'trace_error' && this.accepts(message)) {
      this.dispatchEvent(new CustomEvent('hardwareerror', { detail: message }));
    }
  }

  private accepts(message: GatewayMessage) {
    return !this.deviceSlot || Number(message.device_slot) === this.deviceSlot;
  }

  private rememberEvent(eventId?: string) {
    if (!eventId) return false;
    if (this.seenEventIds.has(eventId)) return false;
    this.seenEventIds.add(eventId);
    this.seenEventOrder.push(eventId);
    if (this.seenEventOrder.length > 500) {
      const oldest = this.seenEventOrder.shift();
      if (oldest) this.seenEventIds.delete(oldest);
    }
    return true;
  }

  private slotTarget() {
    return this.deviceSlot ? { device_slot: this.deviceSlot } : {};
  }

  private send(type: string, target: Record<string, unknown>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) throw new Error('TRACE 网关尚未连接');
    const requestId = globalThis.crypto?.randomUUID?.() || `trace-ui-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.socket.send(JSON.stringify({ type, ...target, request_id: requestId }));
    return requestId;
  }
}
