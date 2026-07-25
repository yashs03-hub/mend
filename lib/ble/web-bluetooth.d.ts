/**
 * Minimal ambient types for the subset of the Web Bluetooth API this module
 * uses. TypeScript's bundled `dom` lib does not ship Web Bluetooth types
 * (it is not yet a stable web standard), and pulling in a third-party
 * `@types/web-bluetooth` package for four interfaces would be a heavier
 * dependency than declaring exactly what we call. This intentionally does
 * not attempt to model the full spec (no `BluetoothManufacturerDataMap`,
 * no `watchAdvertisements`, etc.) — only what `lib/ble/heart-rate.ts` uses.
 */
export {};

declare global {
  interface BluetoothRemoteGATTCharacteristic extends EventTarget {
    readonly value: DataView | undefined;
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    addEventListener(
      type: "characteristicvaluechanged",
      listener: (this: BluetoothRemoteGATTCharacteristic, ev: Event) => void,
    ): void;
    removeEventListener(
      type: "characteristicvaluechanged",
      listener: (this: BluetoothRemoteGATTCharacteristic, ev: Event) => void,
    ): void;
  }

  interface BluetoothRemoteGATTService {
    getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
  }

  interface BluetoothRemoteGATTServer {
    readonly connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
  }

  interface BluetoothDevice extends EventTarget {
    readonly id: string;
    readonly name?: string;
    readonly gatt?: BluetoothRemoteGATTServer;
    addEventListener(
      type: "gattserverdisconnected",
      listener: (this: BluetoothDevice, ev: Event) => void,
    ): void;
    removeEventListener(
      type: "gattserverdisconnected",
      listener: (this: BluetoothDevice, ev: Event) => void,
    ): void;
  }

  interface BluetoothLEScanFilter {
    services?: string[];
  }

  interface RequestDeviceOptions {
    filters?: BluetoothLEScanFilter[];
    optionalServices?: string[];
    acceptAllDevices?: boolean;
  }

  interface Bluetooth {
    requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
  }

  interface Navigator {
    readonly bluetooth?: Bluetooth;
  }
}
