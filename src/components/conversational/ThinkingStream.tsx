/**
 * Thinking Stream Component (React Native)
 * 
 * Displays the AI's reasoning process as it thinks through a search query.
 * Shows streaming text while thinking, then collapses to a toggle after completion.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';

interface ThinkingStreamProps {
  reasoning: string;
  isStreaming?: boolean;
  onStreamComplete?: () => void;
}

export function ThinkingStream({ reasoning, isStreaming = false, onStreamComplete }: ThinkingStreamProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [displayedText, setDisplayedText] = useState('');
  const [hasCompleted, setHasCompleted] = useState(!isStreaming);
  const streamIndexRef = useRef(0);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for thinking indicator
  useEffect(() => {
    if (isStreaming) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isStreaming, pulseAnim]);

  // Simulate streaming effect
  useEffect(() => {
    if (isStreaming && reasoning) {
      // Reset for new stream
      streamIndexRef.current = 0;
      setDisplayedText('');
      setHasCompleted(false);
      setIsExpanded(true);

      const streamInterval = setInterval(() => {
        if (streamIndexRef.current < reasoning.length) {
          // Stream 1-3 characters at a time for more natural feel (faster)
          const charsToAdd = Math.min(
            Math.floor(Math.random() * 3) + 1,
            reasoning.length - streamIndexRef.current
          );
          
          setDisplayedText((prev) => prev + reasoning.slice(streamIndexRef.current, streamIndexRef.current + charsToAdd));
          streamIndexRef.current += charsToAdd;
        } else {
          // Streaming complete
          clearInterval(streamInterval);
          setHasCompleted(true);
          if (onStreamComplete) {
            onStreamComplete();
          }
        }
      }, 15); // 15ms per chunk for faster streaming (more like real-time thinking)

      return () => clearInterval(streamInterval);
    } else {
      // Not streaming, show full text immediately
      setDisplayedText(reasoning);
      setHasCompleted(true);
    }
  }, [reasoning, isStreaming, onStreamComplete]);

  if (!reasoning) {
    return null;
  }

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  return (
    <View style={styles.container}>
      {/* Header - Always visible */}
      <TouchableOpacity
        onPress={() => hasCompleted && setIsExpanded(!isExpanded)}
        disabled={isStreaming}
        style={styles.header}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Animated.View style={[styles.brainIcon, isStreaming && { opacity: pulseOpacity }]}>
            <Text style={styles.brainEmoji}>🧠</Text>
          </Animated.View>
          <Text style={styles.headerTitle}>
            {isStreaming ? 'AI is thinking...' : 'AI Reasoning'}
          </Text>
        </View>
        {hasCompleted && (
          <View style={styles.headerRight}>
            <Text style={styles.toggleText}>{isExpanded ? 'Hide' : 'Show'}</Text>
            <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Content - Collapsible */}
      {isExpanded && (
        <View style={styles.content}>
          <Text style={styles.reasoningText}>
            {displayedText}
            {isStreaming && <Text style={styles.cursor}>▊</Text>}
          </Text>
          
          {hasCompleted && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                💡 This shows how the AI understood your search query
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    backgroundColor: '#FAF5FF',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  brainIcon: {
    marginRight: 8,
  },
  brainEmoji: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B21A8',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toggleText: {
    fontSize: 12,
    color: '#9333EA',
    marginRight: 4,
  },
  chevron: {
    fontSize: 12,
    color: '#9333EA',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E9D5FF',
  },
  reasoningText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#374151',
  },
  cursor: {
    color: '#9333EA',
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3E8FF',
  },
  footerText: {
    fontSize: 11,
    color: '#9333EA',
  },
});

