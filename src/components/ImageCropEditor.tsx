import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  PanResponder,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CROP_AREA_SIZE = SCREEN_WIDTH - 40; // 20px padding on each side
const MIN_SCALE = 1;
const MAX_SCALE = 3;

interface ImageCropEditorProps {
  visible: boolean;
  imageUri: string;
  onSave: (croppedImageUri: string) => void;
  onCancel: () => void;
  aspectRatio?: number; // width/height ratio, default 16/9 for shop images
}

export default function ImageCropEditor({
  visible,
  imageUri,
  onSave,
  onCancel,
  aspectRatio = 16 / 9,
}: ImageCropEditorProps) {
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Store initial values
      },
      onPanResponderMove: (evt, gestureState) => {
        const newTranslateX = translateX + gestureState.dx;
        const newTranslateY = translateY + gestureState.dy;
        
        // Calculate bounds to keep image within crop area
        const maxX = (imageSize.width * scale - CROP_AREA_SIZE) / 2;
        const maxY = (imageSize.height * scale - CROP_AREA_SIZE / aspectRatio) / 2;
        
        setTranslateX(Math.max(-maxX, Math.min(maxX, newTranslateX)));
        setTranslateY(Math.max(-maxY, Math.min(maxY, newTranslateY)));
      },
      onPanResponderRelease: () => {
        // Pan ended
      },
    })
  ).current;

  const handleImageLoad = (event: any) => {
    const { width, height } = event.nativeEvent.source;
    const imageAspectRatio = width / height;
    const cropAspectRatio = aspectRatio;
    
    let displayWidth = CROP_AREA_SIZE;
    let displayHeight = CROP_AREA_SIZE / cropAspectRatio;
    
    if (imageAspectRatio > cropAspectRatio) {
      // Image is wider than crop area
      displayHeight = CROP_AREA_SIZE / cropAspectRatio;
      displayWidth = displayHeight * imageAspectRatio;
    } else {
      // Image is taller than crop area
      displayWidth = CROP_AREA_SIZE;
      displayHeight = displayWidth / imageAspectRatio;
    }
    
    setImageSize({ width: displayWidth, height: displayHeight });
  };

  const handleZoomIn = () => {
    const newScale = Math.min(MAX_SCALE, scale + 0.1);
    setScale(newScale);
  };

  const handleZoomOut = () => {
    const newScale = Math.max(MIN_SCALE, scale - 0.1);
    setScale(newScale);
  };

  const handleReset = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  };

  const handleSave = async () => {
    // For now, we'll use react-native-image-crop-picker to do the actual cropping
    // This is a simplified UI version - in production, you'd want to use the library
    try {
      const ImageCropPicker = require('react-native-image-crop-picker');
      
      const croppedImage = await ImageCropPicker.openCropper({
        path: imageUri,
        width: CROP_AREA_SIZE,
        height: CROP_AREA_SIZE / aspectRatio,
        cropping: true,
        cropperToolbarTitle: 'Adjust Image',
        cropperChooseText: 'Choose',
        cropperCancelText: 'Cancel',
        cropperRotateButtonsHidden: false,
        freeStyleCropEnabled: false,
        aspectRatio: aspectRatio,
      });

      onSave(croppedImage.path);
    } catch (error: any) {
      if (error.message !== 'User cancelled image selection') {
        console.error('Crop error:', error);
      }
    }
  };

  const cropHeight = CROP_AREA_SIZE / aspectRatio;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Adjust Image</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Crop Area */}
        <View style={styles.cropContainer}>
          <View style={[styles.cropArea, { height: cropHeight }]}>
            <View
              style={styles.imageContainer}
              {...panResponder.panHandlers}
            >
              <Image
                source={{ uri: imageUri }}
                style={[
                  styles.image,
                  {
                    width: imageSize.width * scale,
                    height: imageSize.height * scale,
                    transform: [
                      { translateX },
                      { translateY },
                    ],
                  },
                ]}
                resizeMode="contain"
                onLoad={handleImageLoad}
              />
            </View>
            
            {/* Overlay corners */}
            <View style={styles.overlay}>
              <View style={styles.cornerTopLeft} />
              <View style={styles.cornerTopRight} />
              <View style={styles.cornerBottomLeft} />
              <View style={styles.cornerBottomRight} />
            </View>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={handleZoomOut}
            style={styles.controlButton}
            disabled={scale <= MIN_SCALE}
          >
            <Text style={[styles.controlText, scale <= MIN_SCALE && styles.controlTextDisabled]}>
              −
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleZoomIn}
            style={styles.controlButton}
            disabled={scale >= MAX_SCALE}
          >
            <Text style={[styles.controlText, scale >= MAX_SCALE && styles.controlTextDisabled]}>
              +
            </Text>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            Pinch to zoom • Drag to move
          </Text>
        </View>
      </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1a1a1a',
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    padding: 8,
  },
  saveText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  cropContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cropArea: {
    width: CROP_AREA_SIZE,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
  },
  image: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -CROP_AREA_SIZE / 2,
    marginLeft: -CROP_AREA_SIZE / 2,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  cornerTopLeft: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#3b82f6',
  },
  cornerTopRight: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#3b82f6',
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#3b82f6',
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#3b82f6',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  controlText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  controlTextDisabled: {
    color: '#666',
  },
  resetButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
  },
  resetText: {
    color: '#fff',
    fontSize: 14,
  },
  instructions: {
    paddingBottom: 20,
    alignItems: 'center',
  },
  instructionText: {
    color: '#888',
    fontSize: 12,
  },
});
