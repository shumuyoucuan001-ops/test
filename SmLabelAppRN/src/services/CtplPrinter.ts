import { NativeEventEmitter, NativeModules } from 'react-native';

const { CtplPrinter } = NativeModules;

export interface PrinterDevice {
  name: string;
  address: string;
}

export interface PrinterStatus {
  connected: boolean;
}

class CtplPrinterService {
  private eventEmitter: NativeEventEmitter;
  private connectedPrinter: PrinterDevice | null = null;

  constructor() {
    this.eventEmitter = new NativeEventEmitter(CtplPrinter);
  }

  /**
   * 扫描已配对的蓝牙设备
   */
  async scanDevices(): Promise<PrinterDevice[]> {
    try {
      const devices = await CtplPrinter.scanDevices();
      console.log('[CtplPrinter] 扫描到设备:', devices);
      return devices;
    } catch (error) {
      console.error('[CtplPrinter] 扫描设备失败:', error);
      throw error;
    }
  }

  /**
   * 连接到指定地址的打印机
   */
  async connect(address: string): Promise<boolean> {
    try {
      console.log('[CtplPrinter] 连接打印机:', address);
      const result = await CtplPrinter.connect(address);
      if (result) {
        this.connectedPrinter = { address, name: '' };
        console.log('[CtplPrinter] 连接成功');
      }
      return result;
    } catch (error) {
      console.error('[CtplPrinter] 连接失败:', error);
      throw error;
    }
  }

  /**
   * 断开打印机连接
   */
  async disconnect(): Promise<boolean> {
    try {
      console.log('[CtplPrinter] 断开连接');
      const result = await CtplPrinter.disconnect();
      this.connectedPrinter = null;
      return result;
    } catch (error) {
      console.error('[CtplPrinter] 断开连接失败:', error);
      throw error;
    }
  }

  /**
   * 打印TSPL命令
   */
  async print(tsplCommand: string): Promise<boolean> {
    try {
      console.log('[CtplPrinter] 开始打印');
      console.log('[CtplPrinter] TSPL命令长度:', tsplCommand.length);
      console.log('[CtplPrinter] TSPL命令内容:', tsplCommand);
      
      const result = await CtplPrinter.print(tsplCommand);
      console.log('[CtplPrinter] 打印完成');
      return result;
    } catch (error) {
      console.error('[CtplPrinter] 打印失败:', error);
      throw error;
    }
  }

  /**
   * 获取打印机状态
   */
  async getStatus(): Promise<PrinterStatus> {
    try {
      const status = await CtplPrinter.getStatus();
      return status;
    } catch (error) {
      console.error('[CtplPrinter] 获取状态失败:', error);
      throw error;
    }
  }

  /**
   * 监听打印机连接事件
   */
  onConnected(callback: (device: PrinterDevice) => void) {
    return this.eventEmitter.addListener('printerConnected', callback);
  }

  /**
   * 监听打印机断开事件
   */
  onDisconnected(callback: () => void) {
    return this.eventEmitter.addListener('printerDisconnected', callback);
  }

  /**
   * 获取当前连接的打印机（从原生模块获取真实状态）
   */
  async getConnectedPrinter(): Promise<PrinterDevice | null> {
    try {
      const device = await CtplPrinter.getConnectedDevice();
      if (device) {
        this.connectedPrinter = device as PrinterDevice;
      }
      return device as PrinterDevice | null;
    } catch (error) {
      console.error('[CtplPrinter] 获取连接状态失败:', error);
      return null;
    }
  }
}

export default new CtplPrinterService();


