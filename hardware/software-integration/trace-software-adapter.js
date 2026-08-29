export class TraceSoftwareAdapter extends EventTarget {
  constructor(endpoint = "ws://127.0.0.1:8797/trace", options = {}) {
    super();
    this.endpoint = endpoint;
    this.reconnectMs = options.reconnectMs ?? 1200;
    this.socket = null;
    this.retryTimer = null;
    this.closedByUser = false;
    this.devices = [];
    this.deviceSlot = Number(options.deviceSlot) || null;
    this.profileId = options.profileId || (this.deviceSlot ? `trace-user-${String(this.deviceSlot).padStart(2, "0")}` : "trace-shared");
    this.seenEventIds = new Set();
    this.seenEventOrder = [];
  }

  static fromLocation(options = {}) {
    const query = new URLSearchParams(location.search);
    const deviceSlot = Number(query.get("traceDeviceSlot")) || options.deviceSlot || null;
    const profileId = query.get("traceProfile") || options.profileId;
    const endpoint = query.get("traceGateway") || options.endpoint || "ws://127.0.0.1:8797/trace";
    return new TraceSoftwareAdapter(endpoint, { ...options, deviceSlot, profileId });
  }

  connect() {
    this.closedByUser = false;
    clearTimeout(this.retryTimer);
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    const socket = new WebSocket(this.endpoint);
    this.socket = socket;
    socket.addEventListener("open", () => {
      this.dispatchEvent(new CustomEvent("connection", { detail: { connected: true, endpoint: this.endpoint } }));
    });
    socket.addEventListener("message", ({ data }) => {
      let message;
      try {
        message = JSON.parse(data);
      } catch {
        return;
      }
      this.dispatchEvent(new CustomEvent("message", { detail: message }));
      if (message.type === "trace_devices") {
        this.devices = message.devices;
        this.dispatchEvent(new CustomEvent("devices", { detail: message.devices }));
      } else if (message.type === "trace_event" && message.trigger === "squeeze" && this.accepts(message) && this.rememberEvent(message.event_id)) {
        this.dispatchEvent(new CustomEvent("moment", { detail: this.toMoment(message) }));
      } else if (message.type === "trace_status" && this.accepts(message)) {
        this.dispatchEvent(new CustomEvent("telemetry", { detail: message }));
      } else if (message.type === "trace_ack" && this.accepts(message)) {
        this.dispatchEvent(new CustomEvent("ack", { detail: message }));
      }
    });
    socket.addEventListener("close", () => {
      this.dispatchEvent(new CustomEvent("connection", { detail: { connected: false, endpoint: this.endpoint } }));
      if (!this.closedByUser) this.retryTimer = setTimeout(() => this.connect(), this.reconnectMs);
    });
    socket.addEventListener("error", () => socket.close());
  }

  disconnect() {
    this.closedByUser = true;
    clearTimeout(this.retryTimer);
    this.socket?.close();
  }

  toMoment(event) {
    return {
      hardwareEventId: event.event_id,
      pebbleId: event.device_id,
      pebbleLabel: event.device_label,
      pebbleSlot: event.device_slot,
      capturedAt: event.captured_at,
      pressure: event.pressure,
      durationMs: event.duration,
      light: event.light,
      profileId: this.profileId,
      rawHardwareEvent: event,
    };
  }

  accepts(message) {
    return !this.deviceSlot || Number(message.device_slot) === this.deviceSlot;
  }

  rememberEvent(eventId) {
    if (!eventId) return true;
    if (this.seenEventIds.has(eventId)) return false;
    this.seenEventIds.add(eventId);
    this.seenEventOrder.push(eventId);
    if (this.seenEventOrder.length > 500) {
      this.seenEventIds.delete(this.seenEventOrder.shift());
    }
    return true;
  }

  storageKey(name) {
    return `${name}:${this.profileId}`;
  }

  send(type, target = {}, payload = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("TRACE software gateway is not connected");
    }
    const requestId = payload.request_id || globalThis.crypto?.randomUUID?.() || `trace-ui-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.socket.send(JSON.stringify({ type, ...this.targetFields(target), ...payload, request_id: requestId }));
    return requestId;
  }

  targetFields(target) {
    if (typeof target === "number") return { device_slot: target };
    if (typeof target === "string") return { device_id: target };
    if (target?.hardwareEventId) return { event_id: target.hardwareEventId };
    if (target?.event_id) return { event_id: target.event_id };
    if (target?.pebbleId) return { device_id: target.pebbleId };
    if (target?.device_id) return { device_id: target.device_id };
    if (target?.pebbleSlot) return { device_slot: target.pebbleSlot };
    if (target?.device_slot) return { device_slot: target.device_slot };
    return this.deviceSlot ? { device_slot: this.deviceSlot } : {};
  }

  replay(target, options = {}) {
    return this.send("replay", target, options);
  }

  calibrate(target) {
    return this.send("calibrate", target);
  }
}
