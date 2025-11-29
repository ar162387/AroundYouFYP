/**
 * Test setup file
 * Mocks React Native modules for Node.js testing environment
 */

// Set up global mocks for browser/React Native APIs
if (typeof global !== 'undefined') {
  (global as any).window = global;
  (global as any).document = {
    createElement: () => ({}),
  };
}

// Mock react-native-config and other React Native modules
const Module = require('module');
const path = require('path');

const originalRequire = Module.prototype.require;

Module.prototype.require = function(id: string) {
  if (id === 'react-native-config') {
    return require('./mocks/react-native-config');
  }
  
  // Mock AsyncStorage
  if (id === '@react-native-async-storage/async-storage') {
    return require('./mocks/async-storage');
  }
  
  // Mock other React Native modules
  if (id.startsWith('react-native') || id.startsWith('@react-native')) {
    return {};
  }
  
  return originalRequire.apply(this, arguments);
};

