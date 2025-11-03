import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View className="flex-1 bg-gray-50 items-center justify-center p-6">
          <Text className="text-2xl font-bold text-red-600 mb-4">
            Something went wrong
          </Text>
          <ScrollView className="w-full max-h-96 bg-white rounded-lg p-4 mb-4">
            {this.state.error && (
              <Text className="text-red-600 font-semibold mb-2">
                {this.state.error.toString()}
              </Text>
            )}
            {this.state.errorInfo && (
              <Text className="text-gray-700 text-xs font-mono">
                {this.state.errorInfo.componentStack}
              </Text>
            )}
          </ScrollView>
          <TouchableOpacity
            onPress={this.handleReset}
            className="bg-blue-500 px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

