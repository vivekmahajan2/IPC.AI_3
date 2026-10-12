const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Limit worker pool size to prevent Node 24 spawn UNKNOWN errors on Windows
config.maxWorkers = 2;

module.exports = config;
