/**
 * Live heart rate over the standard Bluetooth GATT Heart Rate Service
 * (0x180D, characteristic 0x2A37). Every consumer wearable that exposes a
 * heart rate to a phone app exposes this profile — Web Bluetooth's `filters`
 * option even accepts the well-known short names ("heart_rate",
 * "heart_rate_measurement") in place of numeric UUIDs, so nothing brand- or
 * device-specific is declared anywhere in this file.
 *
 * This module is split into two halves on purpose:
 *   - `parseHeartRateMeasurement` is a pure function over a `DataView`. It
 *     has no dependency on `navigator`, `BluetoothDevice`, or any other
 *     browser API, so it can be exhaustively unit tested in Node.
 *   - `connectHeartRate` is the browser API surface (requestDevice, GATT
 *     connect, characteristic notifications). It cannot be unit tested
 *     without a real or emulated Bluetooth adapter and is intentionally
 *     kept thin — a wrapper that translates the DOM's event-driven,
 *     exception-heavy API into the small discriminated-union result types
 *     below, with the parsing logic factored out.
 */

export const HEART_RATE_SERVICE = "heart_rate";
export const HEART_RATE_MEASUREMENT_CHARACTERISTIC = "heart_rate_measurement";

export class HeartRateParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HeartRateParseError";
  }
}

export type SensorContactStatus = "not_supported" | "not_detected" | "detected";

/** Maps GATT sensor-contact status to Mend vitals quality. Contact loss is
 * poor by definition (fail-safe → symptom-only rules). Devices that cannot
 * report contact stay "ok" — we do not invent a failure. */
export function qualityFromSensorContact(
  sensorContact: SensorContactStatus,
): "ok" | "poor" {
  return sensorContact === "not_detected" ? "poor" : "ok";
}

export interface HeartRateMeasurement {
  bpm: number;
  sensorContact: SensorContactStatus;
}

/** org.bluetooth.characteristic.heart_rate_measurement flags bitfield. */
const FLAG_VALUE_FORMAT_UINT16 = 0b0000_0001; // bit 0
const FLAG_CONTACT_DETECTED = 0b0000_0010; // bit 1
const FLAG_CONTACT_SUPPORTED = 0b0000_0100; // bit 2

/**
 * Parses the standard Heart Rate Measurement payload. Bit 0 of the flags
 * byte (offset 0) selects the BPM encoding at offset 1: 0 = uint8, 1 =
 * uint16 little-endian — `getUint16(1, true)`, never big-endian.
 *
 * Throws `HeartRateParseError` — never fabricates a reading — when the
 * buffer is shorter than the flags byte itself declares it must be. Energy
 * Expended and RR-Interval fields (flag bits 3 and 4) are not consumed by
 * Mend and are ignored rather than validated.
 */
export function parseHeartRateMeasurement(view: DataView): HeartRateMeasurement {
  if (view.byteLength < 1) {
    throw new HeartRateParseError("Empty heart rate payload: missing flags byte.");
  }

  const flags = view.getUint8(0);
  const isUint16 = (flags & FLAG_VALUE_FORMAT_UINT16) === FLAG_VALUE_FORMAT_UINT16;
  const requiredLength = isUint16 ? 3 : 2;

  if (view.byteLength < requiredLength) {
    throw new HeartRateParseError(
      `Truncated heart rate payload: flags declare ${isUint16 ? "a uint16" : "a uint8"} ` +
        `BPM value (needs ${requiredLength} byte(s) total) but the buffer is only ` +
        `${view.byteLength} byte(s).`,
    );
  }

  const bpm = isUint16 ? view.getUint16(1, true) : view.getUint8(1);

  const contactSupported = (flags & FLAG_CONTACT_SUPPORTED) === FLAG_CONTACT_SUPPORTED;
  const sensorContact: SensorContactStatus = !contactSupported
    ? "not_supported"
    : (flags & FLAG_CONTACT_DETECTED) === FLAG_CONTACT_DETECTED
      ? "detected"
      : "not_detected";

  return { bpm, sensorContact };
}

export interface HeartRateReading {
  bpm: number;
  sensorContact: SensorContactStatus;
  /** ISO 8601, stamped when Mend received the notification (the GATT
   * characteristic itself carries no timestamp). */
  timestamp: string;
  /** The BLE device's advertised name, resolved once at connect time. */
  deviceLabel: string;
}

export type HeartRateSessionEvent =
  | { type: "reading"; reading: HeartRateReading }
  | {
      /** The link dropped — out of range, powered off, or the OS Bluetooth
       * stack hiccuped. Not fatal: the UI should offer to reconnect, not
       * treat this as an error. */
      type: "disconnected";
    };

export interface HeartRateSession {
  deviceLabel: string;
  /** Tears down notifications and closes the GATT connection. Safe to call
   * more than once and safe to call after the device has already
   * disconnected on its own. */
  disconnect: () => void;
}

export type ConnectHeartRateResult =
  | { outcome: "connected"; session: HeartRateSession }
  /** The user closed the device chooser without picking anything. A normal
   * outcome — the caller should return to its idle state, not show an
   * error. */
  | { outcome: "cancelled" }
  /** `navigator.bluetooth` does not exist in this browser (e.g. Safari). */
  | { outcome: "unsupported" }
  | { outcome: "error"; message: string };

const FALLBACK_DEVICE_LABEL = "Unnamed heart rate monitor";

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && navigator.bluetooth !== undefined;
}

/**
 * Requests a nearby heart-rate-broadcasting device, connects, and subscribes
 * to live BPM notifications.
 *
 * MUST be invoked from within a real user gesture handler (a click) — that
 * is a Web Bluetooth security requirement enforced by the browser itself,
 * not by this function; calling it from `useEffect` on mount will simply
 * reject. Every readable failure mode is returned as a value, never thrown:
 * callers should exhaustively switch on `result.outcome`.
 */
export async function connectHeartRate(handlers: {
  onEvent: (event: HeartRateSessionEvent) => void;
}): Promise<ConnectHeartRateResult> {
  if (!isWebBluetoothSupported()) {
    return { outcome: "unsupported" };
  }

  let device: BluetoothDevice;
  try {
    device = await navigator.bluetooth!.requestDevice({
      filters: [{ services: [HEART_RATE_SERVICE] }],
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotFoundError") {
      return { outcome: "cancelled" };
    }
    return {
      outcome: "error",
      message: err instanceof Error ? err.message : "Bluetooth device selection failed.",
    };
  }

  const deviceLabel = device.name?.trim() || FALLBACK_DEVICE_LABEL;

  try {
    const server = await device.gatt?.connect();
    if (!server) {
      return { outcome: "error", message: "This device did not expose a Bluetooth GATT server." };
    }

    const service = await server.getPrimaryService(HEART_RATE_SERVICE);
    const characteristic = await service.getCharacteristic(
      HEART_RATE_MEASUREMENT_CHARACTERISTIC,
    );

    const onValueChanged = () => {
      const value = characteristic.value;
      if (!value) return;
      try {
        const { bpm, sensorContact } = parseHeartRateMeasurement(value);
        handlers.onEvent({
          type: "reading",
          reading: { bpm, sensorContact, deviceLabel, timestamp: new Date().toISOString() },
        });
      } catch (err) {
        // A single malformed notification must not take down the session —
        // drop it and wait for the next one (these arrive roughly once a
        // second while notifying).
        console.warn("[ble/heart-rate] discarding malformed notification:", err);
      }
    };

    const onDisconnected = () => {
      handlers.onEvent({ type: "disconnected" });
    };

    characteristic.addEventListener("characteristicvaluechanged", onValueChanged);
    device.addEventListener("gattserverdisconnected", onDisconnected);

    await characteristic.startNotifications();

    return {
      outcome: "connected",
      session: {
        deviceLabel,
        disconnect: () => {
          characteristic.removeEventListener("characteristicvaluechanged", onValueChanged);
          device.removeEventListener("gattserverdisconnected", onDisconnected);
          if (device.gatt?.connected) {
            device.gatt.disconnect();
          }
        },
      },
    };
  } catch (err) {
    return {
      outcome: "error",
      message: err instanceof Error ? err.message : "Failed to connect to the heart rate service.",
    };
  }
}
