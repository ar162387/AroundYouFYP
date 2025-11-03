#!/usr/bin/env node

// Create a stub for react-native-worklets/plugin to satisfy Babel auto-detection
// This is needed because react-native-worklets 0.5.2 is incompatible with RN 0.76.9
// but something in the build chain tries to auto-load it

const fs = require('fs');
const path = require('path');

const workletsDir = path.join(__dirname, '..', 'node_modules', 'react-native-worklets');
const pluginDir = path.join(workletsDir, 'plugin');
const pluginFile = path.join(pluginDir, 'index.js');
const packageFile = path.join(workletsDir, 'package.json');

// Only create stub if the real package doesn't exist
if (!fs.existsSync(workletsDir) || !fs.existsSync(path.join(workletsDir, 'android'))) {
  // Create directory structure
  if (!fs.existsSync(pluginDir)) {
    fs.mkdirSync(pluginDir, { recursive: true });
  }

  // Create stub plugin
  if (!fs.existsSync(pluginFile)) {
    fs.writeFileSync(pluginFile, `// Stub plugin for react-native-worklets
// This satisfies Babel's auto-detection without requiring the full worklets package
// which is incompatible with RN 0.76.9
module.exports = function() {
  return {
    visitor: {}
  };
};
`);
  }

  // Create minimal package.json
  if (!fs.existsSync(packageFile)) {
    fs.writeFileSync(packageFile, JSON.stringify({
      "name": "react-native-worklets",
      "version": "0.0.0-stub",
      "description": "Stub package to satisfy Babel auto-detection",
      "main": "index.js",
      "plugin": "./plugin/index.js"
    }, null, 2));
  }

  // Ensure native folders don't exist (they cause build errors)
  const androidDir = path.join(workletsDir, 'android');
  const iosDir = path.join(workletsDir, 'ios');
  const appleDir = path.join(workletsDir, 'apple');
  if (fs.existsSync(androidDir)) {
    fs.rmSync(androidDir, { recursive: true, force: true });
  }
  if (fs.existsSync(iosDir)) {
    fs.rmSync(iosDir, { recursive: true, force: true });
  }
  if (fs.existsSync(appleDir)) {
    fs.rmSync(appleDir, { recursive: true, force: true });
  }

  console.log('✓ Created react-native-worklets stub');
} else {
  console.log('ℹ react-native-worklets already exists, skipping stub creation');
}

