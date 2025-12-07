package com.smlabelapprn

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.IOException
import java.io.OutputStream
import java.util.UUID

class CtplPrinterModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    private val TAG = "CtplPrinter"
    private var bluetoothSocket: BluetoothSocket? = null
    private var outputStream: OutputStream? = null
    private var connectedDeviceAddress: String? = null
    private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    
    override fun getName(): String {
        return "CtplPrinter"
    }
    
    @ReactMethod
    fun scanDevices(promise: Promise) {
        try {
            val bluetoothAdapter = BluetoothAdapter.getDefaultAdapter()
            if (bluetoothAdapter == null) {
                promise.reject("NO_BLUETOOTH", "设备不支持蓝牙")
                return
            }
            
            if (!bluetoothAdapter.isEnabled) {
                promise.reject("BLUETOOTH_DISABLED", "蓝牙未开启")
                return
            }
            
            val pairedDevices = bluetoothAdapter.bondedDevices
            val devices = WritableNativeArray()
            
            for (device in pairedDevices) {
                val deviceInfo = WritableNativeMap()
                deviceInfo.putString("name", device.name)
                deviceInfo.putString("address", device.address)
                devices.pushMap(deviceInfo)
                Log.d(TAG, "发现已配对设备: ${device.name} (${device.address})")
            }
            
            promise.resolve(devices)
        } catch (e: Exception) {
            Log.e(TAG, "扫描设备失败", e)
            promise.reject("SCAN_ERROR", "扫描设备失败: ${e.message}", e)
        }
    }
    
    @ReactMethod
    fun connect(address: String, promise: Promise) {
        try {
            Log.d(TAG, "开始连接打印机: $address")
            
            // 关闭现有连接
            try {
                outputStream?.close()
                bluetoothSocket?.close()
                outputStream = null
                bluetoothSocket = null
                connectedDeviceAddress = null
            } catch (e: Exception) {
                Log.e(TAG, "清理旧连接失败", e)
            }
            
            val bluetoothAdapter = BluetoothAdapter.getDefaultAdapter()
            if (bluetoothAdapter == null) {
                promise.reject("NO_BLUETOOTH", "设备不支持蓝牙")
                return
            }
            
            val device: BluetoothDevice = bluetoothAdapter.getRemoteDevice(address)
            bluetoothSocket = device.createRfcommSocketToServiceRecord(SPP_UUID)
            
            bluetoothSocket?.let { socket ->
                socket.connect()
                outputStream = socket.outputStream
                connectedDeviceAddress = address
                Log.d(TAG, "成功连接到打印机: $address")
                
                // 发送连接事件
                sendEvent("printerConnected", Arguments.createMap().apply {
                    putString("address", address)
                    putString("name", device.name)
                })
                
                promise.resolve(true)
            } ?: run {
                promise.reject("CONNECTION_ERROR", "无法创建蓝牙套接字")
            }
        } catch (e: IOException) {
            Log.e(TAG, "连接打印机失败", e)
            try {
                outputStream?.close()
                bluetoothSocket?.close()
                outputStream = null
                bluetoothSocket = null
                connectedDeviceAddress = null
            } catch (cleanupError: Exception) {
                Log.e(TAG, "清理连接失败", cleanupError)
            }
            promise.reject("CONNECTION_ERROR", "连接打印机失败: ${e.message}", e)
        } catch (e: Exception) {
            Log.e(TAG, "连接打印机时发生错误", e)
            promise.reject("CONNECTION_ERROR", "连接失败: ${e.message}", e)
        }
    }
    
    @ReactMethod
    fun disconnect(promise: Promise) {
        try {
            outputStream?.close()
            bluetoothSocket?.close()
            outputStream = null
            bluetoothSocket = null
            connectedDeviceAddress = null
            Log.d(TAG, "已断开打印机连接")
            
            sendEvent("printerDisconnected", null)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "断开连接失败", e)
            promise.reject("DISCONNECT_ERROR", "断开连接失败: ${e.message}", e)
        }
    }
    
    @ReactMethod
    fun print(tsplCommand: String, promise: Promise) {
        try {
            Log.d(TAG, "=== 开始打印 ===")
            Log.d(TAG, "TSPL命令长度: ${tsplCommand.length} 字节")
            
            // 检查连接状态
            val socket = bluetoothSocket
            val stream = outputStream
            
            if (socket == null || stream == null || !socket.isConnected) {
                Log.e(TAG, "打印机未连接或连接已断开")
                promise.reject("NOT_CONNECTED", "打印机未连接，请先连接打印机")
                return
            }
            
            Log.d(TAG, "打印机已连接，准备发送数据")
            
            // 检查是否包含Base64编码的二进制数据
            val bytes = if (tsplCommand.contains("__BINARY_DATA_BASE64__")) {
                Log.d(TAG, "检测到Base64二进制数据,进行解析...")
                
                // 分割TSPL命令: 头部 + Base64数据 + 尾部
                val parts = tsplCommand.split("__BINARY_DATA_BASE64__")
                if (parts.size != 2) {
                    throw IllegalArgumentException("TSPL命令格式错误: 缺少__BINARY_DATA_BASE64__分隔符")
                }
                
                val headerPart = parts[0]  // TSPL头部(包含"BITMAP 0,0,40,240,1,")
                val dataAndFooter = parts[1].split("__END_BINARY__")
                if (dataAndFooter.size != 2) {
                    throw IllegalArgumentException("TSPL命令格式错误: 缺少__END_BINARY__分隔符")
                }
                
                val base64Data = dataAndFooter[0]  // Base64编码的位图数据
                val footerPart = dataAndFooter[1]  // TSPL尾部("\r\nPRINT 1\r\n")
                
                Log.d(TAG, "TSPL头部长度: ${headerPart.length} 字节")
                Log.d(TAG, "Base64数据长度: ${base64Data.length} 字符")
                Log.d(TAG, "TSPL尾部长度: ${footerPart.length} 字节")
                
                // 解码Base64数据为原始二进制字节
                val bitmapBytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
                Log.d(TAG, "解码后位图数据: ${bitmapBytes.size} 字节")
                Log.d(TAG, "前40字节(十六进制): ${bitmapBytes.take(40).joinToString("") { "%02X".format(it) }}")
                
                // 组合: TSPL头部(UTF-8) + 位图数据(原始二进制) + TSPL尾部(UTF-8)
                val headerBytes = headerPart.toByteArray(Charsets.UTF_8)
                val footerBytes = footerPart.toByteArray(Charsets.UTF_8)
                
                Log.d(TAG, "最终数据: 头部${headerBytes.size} + 位图${bitmapBytes.size} + 尾部${footerBytes.size} = ${headerBytes.size + bitmapBytes.size + footerBytes.size} 字节")
                
                // 合并所有字节
                headerBytes + bitmapBytes + footerBytes
            } else {
                Log.d(TAG, "标准TSPL命令,直接UTF-8编码")
                Log.d(TAG, "TSPL命令内容:\n$tsplCommand")
                tsplCommand.toByteArray(Charsets.UTF_8)
            }
            stream.write(bytes)
            stream.flush()
            
            Log.d(TAG, "已发送 ${bytes.size} 字节到打印机")
            Log.d(TAG, "=== 打印完成 ===")
            
            promise.resolve(true)
        } catch (e: IOException) {
            Log.e(TAG, "打印失败（IO异常）", e)
            // 清理失效的连接
            try {
                outputStream?.close()
                bluetoothSocket?.close()
            } catch (cleanupError: Exception) {
                Log.e(TAG, "清理连接失败", cleanupError)
            } finally {
                outputStream = null
                bluetoothSocket = null
                connectedDeviceAddress = null
            }
            promise.reject("PRINT_ERROR", "打印失败: ${e.message}，请重新连接打印机", e)
        } catch (e: Exception) {
            Log.e(TAG, "打印时发生错误", e)
            promise.reject("PRINT_ERROR", "打印错误: ${e.message}", e)
        }
    }
    
    @ReactMethod
    fun getStatus(promise: Promise) {
        try {
            val isConnected = bluetoothSocket?.isConnected ?: false
            val status = WritableNativeMap()
            status.putBoolean("connected", isConnected)
            promise.resolve(status)
        } catch (e: Exception) {
            Log.e(TAG, "获取状态失败", e)
            promise.reject("STATUS_ERROR", "获取状态失败: ${e.message}", e)
        }
    }
    
    @ReactMethod
    fun getConnectedDevice(promise: Promise) {
        try {
            val socket = bluetoothSocket
            val address = connectedDeviceAddress
            
            if (socket != null && socket.isConnected && address != null) {
                val deviceMap = WritableNativeMap()
                deviceMap.putString("address", address)
                deviceMap.putString("name", socket.remoteDevice?.name ?: "")
                promise.resolve(deviceMap)
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            Log.e(TAG, "获取连接设备失败", e)
            promise.resolve(null)
        }
    }
    
    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}

