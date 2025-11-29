/**
 * Function Call Display Component
 * 
 * Displays function calls and thinking/reasoning in a consistent format
 * with toggle functionality to expand/collapse details.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface FunctionCallDisplayProps {
  functionName: string;
  description: string;
  content: string;
  isStreaming?: boolean;
}

export default function FunctionCallDisplay({
  functionName,
  description,
  content,
  isStreaming = false,
}: FunctionCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!content) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => !isStreaming && setIsExpanded(!isExpanded)}
        disabled={isStreaming}
        style={styles.header}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.functionName}>{description}</Text>
          {isStreaming && <Text style={styles.streamingIndicator}>...</Text>}
        </View>
        {!isStreaming && (
          <View style={styles.headerRight}>
            <Text style={styles.toggleText}>{isExpanded ? 'Hide' : 'Show'}</Text>
            <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
          </View>
        )}
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.content}>
          <Text style={styles.contentText}>{content}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    marginLeft: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  functionName: {
    fontSize: 12,
    color: '#334155',
    fontFamily: 'monospace',
  },
  streamingIndicator: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toggleText: {
    fontSize: 11,
    color: '#9ca3af',
  },
  chevron: {
    fontSize: 10,
    color: '#9ca3af',
  },
  content: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  contentText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#374151',
    fontFamily: 'monospace',
  },
});

