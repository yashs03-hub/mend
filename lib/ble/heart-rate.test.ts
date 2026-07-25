import { describe, expect, it } from "vitest";
import {
  HeartRateParseError,
  parseHeartRateMeasurement,
  qualityFromSensorContact,
} from "./heart-rate";

/** Builds a `DataView` over exactly the given bytes, the same way a real
 * `BluetoothRemoteGATTCharacteristic.value` arrives. */
function buffer(...bytes: number[]): DataView {
  return new DataView(new Uint8Array(bytes).buffer);
}

describe("parseHeartRateMeasurement", () => {
  describe("uint8 encoding (flags bit 0 = 0)", () => {
    it("parses a typical resting heart rate", () => {
      expect(parseHeartRateMeasurement(buffer(0x00, 72))).toEqual({
        bpm: 72,
        sensorContact: "not_supported",
      });
    });

    it("parses the minimum single-byte value", () => {
      expect(parseHeartRateMeasurement(buffer(0x00, 0)).bpm).toBe(0);
    });

    it("parses the maximum single-byte value (255)", () => {
      expect(parseHeartRateMeasurement(buffer(0x00, 255)).bpm).toBe(255);
    });

    it("ignores any bytes beyond the ones uint8 encoding needs", () => {
      // Flags claim uint8 format even though extra bytes (e.g. an RR-interval
      // field the flags byte doesn't actually declare) are present — only
      // byte 1 is the BPM.
      expect(parseHeartRateMeasurement(buffer(0x00, 88, 0xff, 0xff)).bpm).toBe(88);
    });
  });

  describe("uint16 little-endian encoding (flags bit 0 = 1)", () => {
    it("parses a value that fits in one byte but is still encoded as uint16", () => {
      // 75 = 0x004B -> LE bytes [0x4B, 0x00]
      expect(parseHeartRateMeasurement(buffer(0x01, 0x4b, 0x00)).bpm).toBe(75);
    });

    it("gets the endianness right: a value only representable past 255 must round-trip", () => {
      // 300 = 0x012C -> LE bytes [0x2C, 0x01]. Reading this big-endian would
      // wrongly yield 0x2C01 = 11265; reading it little-endian correctly
      // yields 300.
      expect(parseHeartRateMeasurement(buffer(0x01, 0x2c, 0x01)).bpm).toBe(300);
    });

    it("parses the maximum uint16 value (65535)", () => {
      expect(parseHeartRateMeasurement(buffer(0x01, 0xff, 0xff)).bpm).toBe(65535);
    });

    it("would misparse if byte order were swapped (sanity check on the fixture itself)", () => {
      const littleEndian = parseHeartRateMeasurement(buffer(0x01, 0x2c, 0x01)).bpm;
      const bigEndianEquivalentBytes = parseHeartRateMeasurement(buffer(0x01, 0x01, 0x2c)).bpm;
      expect(littleEndian).not.toBe(bigEndianEquivalentBytes);
    });
  });

  describe("sensor contact status (flags bits 1-2)", () => {
    it("reports not_supported when the support bit is clear", () => {
      expect(parseHeartRateMeasurement(buffer(0b0000_0000, 80)).sensorContact).toBe(
        "not_supported",
      );
      // Even if the detected bit happens to be set, "supported" governs.
      expect(parseHeartRateMeasurement(buffer(0b0000_0010, 80)).sensorContact).toBe(
        "not_supported",
      );
    });

    it("reports not_detected when supported but contact is not made", () => {
      expect(parseHeartRateMeasurement(buffer(0b0000_0100, 80)).sensorContact).toBe(
        "not_detected",
      );
    });

    it("reports detected when supported and contact is made", () => {
      expect(parseHeartRateMeasurement(buffer(0b0000_0110, 80)).sensorContact).toBe("detected");
    });
  });

  describe("unrelated flag bits are ignored for BPM decoding", () => {
    it("still parses correctly with Energy Expended (bit 3) and RR-Interval (bit 4) flags set", () => {
      // uint8 format + contact detected + energy expended + RR-interval present.
      const flags = 0b0001_1110;
      expect(parseHeartRateMeasurement(buffer(flags, 95)).bpm).toBe(95);
    });
  });

  describe("malformed / truncated buffers", () => {
    it("throws on a completely empty buffer", () => {
      expect(() => parseHeartRateMeasurement(buffer())).toThrow(HeartRateParseError);
    });

    it("throws when only the flags byte is present but uint8 format needs a value byte", () => {
      expect(() => parseHeartRateMeasurement(buffer(0x00))).toThrow(HeartRateParseError);
    });

    it("throws when only the flags byte is present and uint16 format is declared", () => {
      expect(() => parseHeartRateMeasurement(buffer(0x01))).toThrow(HeartRateParseError);
    });

    it("throws when uint16 format is declared but only one value byte is present", () => {
      expect(() => parseHeartRateMeasurement(buffer(0x01, 0x4b))).toThrow(HeartRateParseError);
    });

    it("includes a useful message describing the shortfall", () => {
      try {
        parseHeartRateMeasurement(buffer(0x01, 0x4b));
        expect.unreachable("expected parseHeartRateMeasurement to throw");
      } catch (err) {
        expect(err).toBeInstanceOf(HeartRateParseError);
        expect((err as Error).message).toContain("uint16");
        expect((err as Error).message).toContain("2");
      }
    });

    it("never returns a fabricated reading for a truncated buffer", () => {
      expect(() => parseHeartRateMeasurement(buffer(0x00))).toThrow();
      expect(() => parseHeartRateMeasurement(buffer(0x01, 0x00))).toThrow();
    });
  });
});

describe("qualityFromSensorContact", () => {
  it("marks quality poor when contact is not detected", () => {
    expect(qualityFromSensorContact("not_detected")).toBe("poor");
  });

  it("marks quality ok when contact is detected", () => {
    expect(qualityFromSensorContact("detected")).toBe("ok");
  });

  it("marks quality ok when the device does not support contact reporting", () => {
    expect(qualityFromSensorContact("not_supported")).toBe("ok");
  });
});
