import type { CaptureEvent } from './types';

export interface CaptureAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(onTrace: (event: CaptureEvent) => void): () => void;
}

export function createMockCaptureEvent(): CaptureEvent {
  const now = new Date();
  return {
    eventId: `mock-${now.getTime()}`,
    capturedAt: now.toISOString(),
    source: 'mock',
    durationMs: 720,
    pressurePeak: 0.62,
  };
}

// Hardware only needs to match these constants and the JSON event contract.
export const TRACE_BLE = {
  service: '7b0e1000-54d2-4ca4-8e8a-02521c4a77c1',
  eventCharacteristic: '7b0e1001-54d2-4ca4-8e8a-02521c4a77c1',
  ackCharacteristic: '7b0e1002-54d2-4ca4-8e8a-02521c4a77c1',
} as const;

type BluetoothRemoteGATTCharacteristicLike = EventTarget & {
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristicLike>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristicLike>;
  writeValue?(value: BufferSource): Promise<void>;
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
};

type BluetoothNavigator = Navigator & {
  bluetooth?: {
    requestDevice(options: unknown): Promise<{
      gatt?: {
        connected: boolean;
        connect(): Promise<{
          getPrimaryService(uuid: string): Promise<{
            getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristicLike>;
          }>;
          disconnect(): void;
        }>;
      };
    }>;
  };
};

export class BleCaptureAdapter implements CaptureAdapter {
  private characteristic?: BluetoothRemoteGATTCharacteristicLike;
  private ackCharacteristic?: BluetoothRemoteGATTCharacteristicLike;
  private listeners = new Set<(event: CaptureEvent) => void>();

  async connect() {
    const bluetooth = (navigator as BluetoothNavigator).bluetooth;
    if (!bluetooth) throw new Error('当前浏览器不支持 Web Bluetooth。请使用桌面版 Chrome 连接 Pebble。');

    const device = await bluetooth.requestDevice({
      filters: [{ services: [TRACE_BLE.service] }],
      optionalServices: [TRACE_BLE.service],
    });
    const server = await device.gatt?.connect();
    if (!server) throw new Error('未能连接 Pebble。');
    const service = await server.getPrimaryService(TRACE_BLE.service);
    this.characteristic = await service.getCharacteristic(TRACE_BLE.eventCharacteristic);
    this.ackCharacteristic = await service.getCharacteristic(TRACE_BLE.ackCharacteristic);
    this.characteristic.addEventListener('characteristicvaluechanged', this.handleValue);
    await this.characteristic.startNotifications();
  }

  async disconnect() {
    if (!this.characteristic) return;
    this.characteristic.removeEventListener('characteristicvaluechanged', this.handleValue);
    await this.characteristic.stopNotifications();
    this.characteristic = undefined;
    this.ackCharacteristic = undefined;
  }

  subscribe(onTrace: (event: CaptureEvent) => void) {
    this.listeners.add(onTrace);
    return () => this.listeners.delete(onTrace);
  }

  private handleValue = (browserEvent: Event) => {
    try {
      const target = browserEvent.target as { value?: DataView };
      if (!target.value) return;
      const json = new TextDecoder().decode(target.value.buffer);
      const raw = JSON.parse(json) as {
        protocolVersion?: number;
        eventId: string;
        capturedAt: string;
        durationMs?: number;
        pressurePeak?: number;
      };
      if (raw.protocolVersion !== undefined && raw.protocolVersion !== 1) return;
      const event: CaptureEvent = { ...raw, source: 'ble' };
      this.listeners.forEach((listener) => listener(event));
      void this.acknowledge(raw.eventId);
    } catch {
      // Ignore malformed packets. A production build should report telemetry.
    }
  };

  private async acknowledge(eventId: string) {
    if (!this.ackCharacteristic) return;
    const value = new TextEncoder().encode(JSON.stringify({ protocolVersion: 1, eventId, stored: true }));
    if (this.ackCharacteristic.writeValueWithoutResponse) {
      await this.ackCharacteristic.writeValueWithoutResponse(value);
    } else {
      await this.ackCharacteristic.writeValue?.(value);
    }
  }
}
