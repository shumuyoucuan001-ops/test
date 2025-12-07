import AsyncStorage from '@react-native-async-storage/async-storage';

export type PrinterType = 'desktop' | 'portable';

export interface PrinterSettings {
  type: PrinterType;
  name: string;
  description: string;
  lastConnectedAddress?: string; // 上次连接的打印机地址
  lastConnectedName?: string; // 上次连接的打印机名称
}

const PRINTER_SETTINGS_KEY = '@printer_settings';

export class PrinterSettingsService {
  private static instance: PrinterSettingsService;
  private currentSettings: PrinterSettings = {
    type: 'desktop',
    name: '桌面打印机',
    description: 'TSPL指令，适用于桌面标签打印机'
  };

  static getInstance(): PrinterSettingsService {
    if (!PrinterSettingsService.instance) {
      PrinterSettingsService.instance = new PrinterSettingsService();
    }
    return PrinterSettingsService.instance;
  }

  // 获取打印机类型选项
  getAvailableTypes(): PrinterSettings[] {
    return [
      {
        type: 'desktop',
        name: '桌面打印机',
        description: 'TSPL指令，适用于桌面标签打印机'
      },
      {
        type: 'portable',
        name: '便携打印机',
        description: 'CPCL指令，适用于便携式打印机'
      }
    ];
  }

  // 获取当前设置
  getCurrentSettings(): PrinterSettings {
    return this.currentSettings;
  }

  // 获取当前打印机类型
  getCurrentType(): PrinterType {
    return this.currentSettings.type;
  }

  // 设置打印机类型
  async setPrinterType(type: PrinterType): Promise<void> {
    const availableTypes = this.getAvailableTypes();
    const selectedType = availableTypes.find(t => t.type === type);
    
    if (selectedType) {
      this.currentSettings = selectedType;
      await this.saveSettings();
    }
  }

  // 从存储加载设置
  async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(PRINTER_SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored) as PrinterSettings;
        this.currentSettings = settings;
      }
    } catch (error) {
      console.error('Failed to load printer settings:', error);
    }
  }

  // 保存设置到存储
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(PRINTER_SETTINGS_KEY, JSON.stringify(this.currentSettings));
    } catch (error) {
      console.error('Failed to save printer settings:', error);
    }
  }

  // 保存上次连接的打印机信息
  async saveLastConnectedPrinter(address: string, name?: string): Promise<void> {
    this.currentSettings.lastConnectedAddress = address;
    this.currentSettings.lastConnectedName = name;
    await this.saveSettings();
  }

  // 获取上次连接的打印机地址
  getLastConnectedAddress(): string | undefined {
    return this.currentSettings.lastConnectedAddress;
  }

  // 获取上次连接的打印机名称
  getLastConnectedName(): string | undefined {
    return this.currentSettings.lastConnectedName;
  }

  // 重置为默认设置
  async resetToDefault(): Promise<void> {
    this.currentSettings = {
      type: 'desktop',
      name: '桌面打印机',
      description: 'TSPL指令，适用于桌面标签打印机'
    };
    await this.saveSettings();
  }
}

export default PrinterSettingsService.getInstance();

