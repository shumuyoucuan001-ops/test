/*
  轻量封装蓝牙经典串口打印（Android为主）。
  - 设计为可选依赖：如果未安装原生模块则不会崩溃，在控制台提示。
  - 推荐原生模块：react-native-bluetooth-classic（SPP/RFCOMM），可用于TSPL打印机。
  - 使用方式：在 Dev Client 中安装原生模块后，本服务会自动使用真实实现。
*/

/* eslint-disable @typescript-eslint/no-var-requires */
import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';

export interface BluetoothDevice {
  name?: string;
  address?: string; // Android: MAC 地址
}

class BluetoothPrinterService {
  private rnBluetoothClassic: any | null = null;
  private connectedDevice: BluetoothDevice | null = null;
  private ble: BleManager | null = null;
  private addressToRaw: Record<string, any> = {};

  constructor() {
    try {
      // 动态引入，避免在 Expo Go 下因缺少原生模块而报错
      // eslint-disable-next-line global-require
      const mod = require('react-native-bluetooth-classic');
      // 兼容导出在 default 下的情况
      this.rnBluetoothClassic = (mod && mod.default) ? mod.default : mod;
    } catch (e) {
      this.rnBluetoothClassic = null;
      console.warn('[BluetoothPrinter] 未检测到原生模块。请使用 Dev Client 并安装 react-native-bluetooth-classic');
    }
    try {
      this.ble = new BleManager();
    } catch (_) {
      this.ble = null;
    }
  }

  isSupported(): boolean {
    return !!this.rnBluetoothClassic;
  }

  private async ensurePermissions(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      const perms: string[] = [
        'android.permission.BLUETOOTH_CONNECT',
        'android.permission.BLUETOOTH_SCAN',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
      ];
      await Promise.allSettled(perms.map((p) => PermissionsAndroid.request(p as any)));
    } catch (_) {}
  }

  private async ensureBluetoothEnabled(): Promise<void> {
    if (!this.rnBluetoothClassic) return;
    try {
      const isEnabled = this.rnBluetoothClassic.isEnabled || this.rnBluetoothClassic.isBluetoothEnabled;
      const requestEnable = this.rnBluetoothClassic.requestEnable || this.rnBluetoothClassic.enable;
      let ok = true;
      if (isEnabled) ok = await isEnabled.call(this.rnBluetoothClassic);
      if (!ok && requestEnable) {
        try { await requestEnable.call(this.rnBluetoothClassic); } catch (_) {}
      }
    } catch (_) {}
  }

  getConnectedDevice(): BluetoothDevice | null {
    return this.connectedDevice;
  }

  async syncFromSystem(): Promise<BluetoothDevice | null> {
    if (!this.rnBluetoothClassic) return this.connectedDevice;
    try {
      await this.ensurePermissions();
      await this.ensureBluetoothEnabled();
      // 优先使用 getConnectedDevice；部分版本仅提供 isDeviceConnected/getConnectedDevices
      const getConnectedDevice = this.rnBluetoothClassic.getConnectedDevice;
      const isDeviceConnected = this.rnBluetoothClassic.isDeviceConnected || this.rnBluetoothClassic.isConnected;
      if (getConnectedDevice) {
        const dev = await getConnectedDevice.call(this.rnBluetoothClassic);
        this.connectedDevice = dev ? { name: dev.name, address: dev.address } : null;
      } else if (isDeviceConnected) {
        // 无法获取设备详情时，仅标记已连接
        const ok = await isDeviceConnected.call(this.rnBluetoothClassic);
        if (ok) {
          const list = (await this.getPairedDevices()) || [];
          // 尝试挑选第一个已配对设备作为当前连接（多数设备同一时间仅连接一个）
          this.connectedDevice = list[0] || this.connectedDevice;
        } else {
          this.connectedDevice = null;
        }
      }
    } catch (e) {
      // 不影响主流程
    }
    return this.connectedDevice;
  }

  async getPairedDevices(): Promise<BluetoothDevice[]> {
    if (!this.rnBluetoothClassic) return [];
    try {
      await this.ensurePermissions();
      await this.ensureBluetoothEnabled();
      // 一些版本 API 名为 getBondedDevices, 也有 getConnectedDevices/ list
      const api =
        this.rnBluetoothClassic.getBondedDevices ||
        this.rnBluetoothClassic.getConnectedDevices ||
        this.rnBluetoothClassic.list;
      const list = api ? await api.call(this.rnBluetoothClassic) : [];
      (list || []).forEach((d: any) => { if (d?.address) this.addressToRaw[String(d.address)] = d; });
      return (list || []).map((d: any) => ({ name: d.name, address: d.address }));
    } catch (e) {
      console.error('[BluetoothPrinter] 获取已配对设备失败', e);
      return [];
    }
  }

  async discoverUnpaired(timeoutMs = 6000): Promise<BluetoothDevice[]> {
    try {
      await this.ensurePermissions();
      if (this.rnBluetoothClassic) {
        await this.ensureBluetoothEnabled();
      }
      let devices: any[] = [];
      // 1) 经典蓝牙扫描（若模块可用）
      if (this.rnBluetoothClassic) {
        const startDiscovery = this.rnBluetoothClassic.discoverUnpairedDevices || this.rnBluetoothClassic.startDiscovery || this.rnBluetoothClassic.requestDiscoverDevices;
        const cancelDiscovery = this.rnBluetoothClassic.cancelDiscovery || this.rnBluetoothClassic.cancelDiscoveryDevices;
        if (startDiscovery) {
          try {
            const emitter = new NativeEventEmitter(NativeModules.RNBluetoothClassic || this.rnBluetoothClassic);
            const seen: Record<string, boolean> = {};
            const sub = emitter.addListener('deviceDiscovered', (d: any) => {
              if (!d?.address) return;
              const key = String(d.address).toUpperCase();
              if (!seen[key]) {
                seen[key] = true;
                devices.push(d);
                this.addressToRaw[String(d.address)] = d;
              }
            });
            const result = await startDiscovery.call(this.rnBluetoothClassic);
            const immediate = result?.devices || result?.found || result || [];
            if (Array.isArray(immediate) && immediate.length) {
              immediate.forEach((d: any) => {
                if (!d?.address) return;
                const key = String(d.address).toUpperCase();
                if (!seen[key]) { seen[key] = true; devices.push(d); }
                this.addressToRaw[String(d.address)] = d;
              });
            }
            await new Promise((resolve) => setTimeout(resolve, timeoutMs));
            try { cancelDiscovery && cancelDiscovery.call(this.rnBluetoothClassic); } catch (_) {}
            sub.remove();
          } catch (_) {
            const result = await startDiscovery.call(this.rnBluetoothClassic);
            devices = result?.devices || result?.found || result || [];
            (devices || []).forEach((d: any) => { if (d?.address) this.addressToRaw[String(d.address)] = d; });
          }
        }
      }
      let classic: BluetoothDevice[] = (devices || []).map((d: any) => ({ name: d.name, address: d.address }));
      // 2) BLE 扫描（即使没有经典蓝牙模块也执行）
      if (this.ble) {
        const bleFound: Record<string, BluetoothDevice> = {};
        try {
          await new Promise<void>((resolve) => {
            const sub = this.ble!.onStateChange((state) => {
              if (state === 'PoweredOn') { resolve(); sub.remove(); }
            }, true);
          });
          await new Promise<void>((resolve) => {
            const seen: Record<string, boolean> = {};
            const sub = this.ble!.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
              if (error) { return; }
              const name = device?.name || (device as any)?.localName;
              if (!name) return;
              const key = String(name).toUpperCase();
              if (!seen[key]) {
                seen[key] = true;
                bleFound[key] = { name, address: device?.id };
              }
            });
            setTimeout(() => { try { this.ble!.stopDeviceScan(); (sub as any)?.remove?.(); } catch(_) {} resolve(); }, timeoutMs);
          });
        } catch (_) {}
        const merged: Record<string, BluetoothDevice> = {};
        classic.forEach((d) => { if (d.name) merged[String(d.name).toUpperCase()] = d; });
        Object.values(bleFound).forEach((d) => { const key = (d.name||'').toUpperCase(); if (!merged[key]) merged[key] = d; });
        classic = Object.values(merged);
      }
      return classic;
    } catch (e) {
      console.error('[BluetoothPrinter] 扫描未配对设备失败', e);
      return [];
    }
  }

  async connect(address: string): Promise<boolean> {
    // 如果传入的 address 不是典型 MAC（如来自 BLE 的临时 ID），尝试通过名称映射
    if (address && address.indexOf(':') === -1) {
      try {
        const classicList = await this.getPairedDevices();
        const candidate = classicList.find((d) => (d.address || '').includes(':'));
        if (candidate?.address) {
          address = candidate.address;
        }
      } catch (_) {}
    }
    if (!this.rnBluetoothClassic) {
      console.warn('[BluetoothPrinter] 未启用原生模块，使用模拟连接');
      this.connectedDevice = { name: '模拟打印机', address: '00:00:00:00:00:00' };
      return true;
    }
    try {
      await this.ensurePermissions();
      await this.ensureBluetoothEnabled();
      // 若在扫描，先停止，避免连接被系统阻止
      try {
        const cancelDiscovery = this.rnBluetoothClassic.cancelDiscovery || this.rnBluetoothClassic.cancelDiscoveryDevices || this.rnBluetoothClassic.stopDiscovery;
        cancelDiscovery && (await cancelDiscovery.call(this.rnBluetoothClassic));
      } catch (_) {}
      // 如果系统层面已经连接到该地址，则直接同步状态
      try {
        const isDeviceConnected = this.rnBluetoothClassic.isDeviceConnected || this.rnBluetoothClassic.isConnectedToDevice;
        if (isDeviceConnected) {
          const ok = await isDeviceConnected.call(this.rnBluetoothClassic, address);
          if (ok) {
            this.connectedDevice = { address };
            return true;
          }
        }
      } catch (_) {}

      // 多路径连接：device对象 → 动态枚举connect* → 不安全通道
      const getDevice = this.rnBluetoothClassic.getDevice || this.rnBluetoothClassic.device;
      const connectToDevice = this.rnBluetoothClassic.connectToDevice || this.rnBluetoothClassic.connect;
      try {
        console.log('[BluetoothPrinter][debug] RNBTC methods:', Object.keys(this.rnBluetoothClassic || {}));
      } catch (_) {}
      let device: any;
      try {
        // 优先使用之前扫描/配对缓存到的原始设备对象
        const cached = this.addressToRaw[String(address)];
        if (cached && typeof cached.connect === 'function') {
          await cached.connect({ delimiter: '\n' });
          device = cached;
        } else
        if (typeof getDevice === 'function') {
          const devObj = await getDevice.call(this.rnBluetoothClassic, address);
          try { console.log('[BluetoothPrinter][debug] device methods:', Object.keys(devObj || {})); } catch (_) {}
          if (devObj && typeof devObj.connect === 'function') {
            await devObj.connect({ delimiter: '\n' });
            device = devObj;
          } else if (typeof connectToDevice === 'function') {
            device = await connectToDevice.call(this.rnBluetoothClassic, address, { delimiter: '\n' });
          } else {
            // 动态寻找可用的 connect* 方法
            const fnName = Object.keys(this.rnBluetoothClassic).find((k) => /^connect/i.test(k) && typeof (this.rnBluetoothClassic as any)[k] === 'function');
            if (fnName) {
              device = await (this.rnBluetoothClassic as any)[fnName].call(this.rnBluetoothClassic, address, { delimiter: '\n' });
            } else {
              console.warn('[BluetoothPrinter][debug] no connect-like API on module');
              throw new Error('No connect API');
            }
          }
        } else if (typeof connectToDevice === 'function') {
          device = await connectToDevice.call(this.rnBluetoothClassic, address, { delimiter: '\n' });
        } else {
          const fnName = Object.keys(this.rnBluetoothClassic).find((k) => /^connect/i.test(k) && typeof (this.rnBluetoothClassic as any)[k] === 'function');
          if (fnName) {
            device = await (this.rnBluetoothClassic as any)[fnName].call(this.rnBluetoothClassic, address, { delimiter: '\n' });
          } else {
            console.warn('[BluetoothPrinter][debug] no connect-like API on module');
            throw new Error('No connect API');
          }
        }
      } catch (err: any) {
        // 遇到需要配对/未绑定等错误时，尝试配对后再连
        try {
          const pair = this.rnBluetoothClassic.pairDevice || this.rnBluetoothClassic.createBond || this.rnBluetoothClassic.bond;
          if (typeof pair === 'function') {
            await pair.call(this.rnBluetoothClassic, address);
            try {
              if (typeof getDevice === 'function') {
                const devObj = await getDevice.call(this.rnBluetoothClassic, address);
                try { console.log('[BluetoothPrinter][debug] device methods after pair:', Object.keys(devObj || {})); } catch (_) {}
                if (devObj && typeof devObj.connect === 'function') {
                  await devObj.connect({ delimiter: '\n' });
                  device = devObj;
                } else if (typeof connectToDevice === 'function') {
                  device = await connectToDevice.call(this.rnBluetoothClassic, address, { delimiter: '\n' });
                } else {
                  const fnName = Object.keys(this.rnBluetoothClassic).find((k) => /^connect/i.test(k) && typeof (this.rnBluetoothClassic as any)[k] === 'function');
                  if (fnName) {
                    device = await (this.rnBluetoothClassic as any)[fnName].call(this.rnBluetoothClassic, address, { delimiter: '\n' });
                  } else {
                    console.warn('[BluetoothPrinter][debug] no connect-like API on module after pair');
                    throw new Error('No connect API');
                  }
                }
              } else if (typeof connectToDevice === 'function') {
                device = await connectToDevice.call(this.rnBluetoothClassic, address, { delimiter: '\n' });
              } else {
                const fnName = Object.keys(this.rnBluetoothClassic).find((k) => /^connect/i.test(k) && typeof (this.rnBluetoothClassic as any)[k] === 'function');
                if (fnName) {
                  device = await (this.rnBluetoothClassic as any)[fnName].call(this.rnBluetoothClassic, address, { delimiter: '\n' });
                } else {
                  console.warn('[BluetoothPrinter][debug] no connect-like API on module after pair');
                  throw new Error('No connect API');
                }
              }
            } catch (e2) {
              // 有些设备需要不安全通道
              const connectInsecure = this.rnBluetoothClassic.connectInsecure || this.rnBluetoothClassic.connectToDeviceInsecure;
              if (typeof connectInsecure === 'function') {
                device = await connectInsecure.call(this.rnBluetoothClassic, address, { delimiter: '\n' });
              } else {
                throw e2;
              }
            }
          } else {
            throw err;
          }
        } catch (inner) {
          throw inner || err;
        }
      }
      this.connectedDevice = { name: device?.name, address: device?.address };
      return true;
    } catch (e) {
      console.error('[BluetoothPrinter] 连接失败', e);
      this.connectedDevice = null;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.rnBluetoothClassic) {
      this.connectedDevice = null;
      return;
    }
    try {
      await this.rnBluetoothClassic.disconnect();
    } finally {
      this.connectedDevice = null;
    }
  }

  async writeRaw(tspl: string | Uint8Array): Promise<boolean> {
    if (!this.rnBluetoothClassic) {
      console.log('[BluetoothPrinter][模拟发送]\n', tspl);
      return true;
    }
    try {
      // 兼容不同库方法名：writeToDevice(address,data) 或 write(data)
      const writeToDevice = this.rnBluetoothClassic.writeToDevice;
      const write = this.rnBluetoothClassic.write;
      if (writeToDevice && this.connectedDevice?.address) {
        await writeToDevice.call(this.rnBluetoothClassic, this.connectedDevice.address, tspl);
      } else if (write) {
        await write.call(this.rnBluetoothClassic, tspl);
      } else {
        throw new Error('No write API');
      }
      return true;
    } catch (e) {
      console.error('[BluetoothPrinter] 发送失败', e);
      return false;
    }
  }
}

const BluetoothPrinter = new BluetoothPrinterService();
export default BluetoothPrinter;


