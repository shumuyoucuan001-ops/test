import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    PermissionsAndroid,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Camera } from 'react-native-camera-kit';

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export default function BarcodeScannerModal({ visible, onClose, onScan }: BarcodeScannerModalProps) {
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    if (visible) {
      requestCameraPermission();
    }
  }, [visible]);

  const requestCameraPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: '相机权限',
            message: '需要相机权限才能扫描条码',
            buttonNeutral: '稍后询问',
            buttonNegative: '取消',
            buttonPositive: '确定',
          }
        );
        
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          setHasPermission(true);
        } else {
          Alert.alert('提示', '需要相机权限才能扫描条码');
          onClose();
        }
      } else {
        setHasPermission(true);
      }
    } catch (error) {
      console.error('请求相机权限失败:', error);
      Alert.alert('错误', '无法获取相机权限');
      onClose();
    }
  };

  const handleBarcodeScan = (event: any) => {
    const code = event.nativeEvent?.codeStringValue;
    if (code) {
      console.log('扫描到条码:', code);
      onScan(code);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* 顶部关闭按钮 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>扫描条码/二维码</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* 相机视图 */}
        <View style={styles.cameraContainer}>
          {!hasPermission ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>正在请求相机权限...</Text>
            </View>
          ) : (
            <>
              <Camera
                style={StyleSheet.absoluteFill}
                scanBarcode
                onReadCode={handleBarcodeScan}
                showFrame={true}
                laserColor="#00FF00"
                frameColor="#FFFFFF"
              />

              {/* 提示文字 */}
              <View style={styles.hintContainer}>
                <Text style={styles.hintText}>请将条码/二维码放入框内</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  hintContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: '#fff',
    fontSize: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
});
