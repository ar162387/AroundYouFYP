/**
 * Voice Input Button Component
 * 
 * Premium button for recording voice input and converting to text.
 * Uses React Native Voice for speech-to-text.
 */

import React, { useState, useEffect } from 'react';
import { TouchableOpacity, StyleSheet, View, Animated } from 'react-native';
import Voice from '@react-native-voice/voice';
import MicrophoneIcon from '../../icons/MicrophoneIcon';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export default function VoiceInputButton({ onTranscript, disabled = false }: VoiceInputButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Set up voice event handlers
    Voice.onSpeechStart = () => {
      setIsRecording(true);
      setError(null);
      startPulseAnimation();
    };

    Voice.onSpeechEnd = () => {
      setIsRecording(false);
      stopPulseAnimation();
    };

    Voice.onSpeechResults = (e) => {
      if (e.value && e.value.length > 0) {
        const transcript = e.value[0];
        onTranscript(transcript);
      }
      setIsRecording(false);
      stopPulseAnimation();
    };

    Voice.onSpeechError = (e) => {
      console.error('Voice recognition error:', e);
      setError(e.error?.message || 'Speech recognition error');
      setIsRecording(false);
      stopPulseAnimation();
    };

    return () => {
      // Cleanup
      Voice.destroy().then(Voice.removeAllListeners);
      stopPulseAnimation();
    };
  }, [onTranscript]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const startRecording = async () => {
    try {
      setError(null);
      await Voice.start('en-US');
    } catch (err: any) {
      console.error('Error starting voice recognition:', err);
      setError(err.message || 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      await Voice.stop();
    } catch (err: any) {
      console.error('Error stopping voice recognition:', err);
    }
  };

  const handlePress = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.buttonWrapper,
          { transform: [{ scale: isRecording ? pulseAnim : 1 }] }
        ]}
      >
        <TouchableOpacity
          style={[
            styles.button,
            isRecording && styles.buttonRecording,
            disabled && styles.buttonDisabled
          ]}
          onPress={handlePress}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <MicrophoneIcon
            size={22}
            color="#FFFFFF"
            isRecording={isRecording}
          />
        </TouchableOpacity>
        
        {isRecording && (
          <View style={styles.recordingIndicator} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonRecording: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  buttonDisabled: {
    backgroundColor: '#d1d5db',
    shadowOpacity: 0,
    elevation: 0,
  },
  recordingIndicator: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#ef4444',
    opacity: 0.4,
    top: 0,
    left: 0,
  },
});

