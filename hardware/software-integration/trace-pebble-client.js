export class TracePebbleClient extends EventTarget {
  constructor(endpoint, options = {}) {
    super();
    this.endpoint = endpoint;
    this.id = options.id ?? endpoint;
    this.label = options.label ?? this.id;
    this.reconnectMs = options.reconnectMs ?? 1200;
    this.socket = null;
    this.retryTimer = null;
    this.closedByUser = false;
  }

  connect() {
    this.closedByUser = false;
    clearTimeout(this.retryTimer);
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;

    const socket = new WebSocket(this.endpoint);
    this.socket = socket;
    socket.addEventListener("open", () => {
      this.dispatchEvent(new CustomEvent("connection", {
        detail: { connected: true, id: this.id, endpoint: this.endpoint },
      }));
    });
    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        this.dispatchEvent(new CustomEvent("message", { detail: message }));
        if (message.type === "trace_event") {
          this.dispatchEvent(new CustomEvent("trace", { detail: message }));
        }
      } catch (error) {
        this.dispatchEvent(new CustomEvent("protocol-error", { detail: { error, data: event.data } }));
      }
    });
    socket.addEventListener("close", () => {
      this.dispatchEvent(new CustomEvent("connection", {
        detail: { connected: false, id: this.id, endpoint: this.endpoint },
      }));
      if (!this.closedByUser) {
        this.retryTimer = setTimeout(() => this.connect(), this.reconnectMs);
      }
    });
    socket.addEventListener("error", () => socket.close());
  }

  disconnect() {
    this.closedByUser = true;
    clearTimeout(this.retryTimer);
    this.socket?.close();
  }

  send(type, payload = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("TRACE Pebble is not connected");
    }
    this.socket.send(JSON.stringify({ type, ...payload }));
  }

  replay() {
    this.send("replay");
  }

  calibrate() {
    this.send("calibrate");
  }

  simulate() {
    this.send("simulate");
  }
}
