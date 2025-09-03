/**
 * 12Bowl NFL Pick'em App - Admin Module
 * Advanced debugging, testing, and management tools
 */

window.Admin = {
  /**
   * Initialize admin features
   */
  init: () => {
    if (Config.DEBUG_MODE) {
      Admin.enableDebugMode();
      Admin.logSystemInfo();
    }
  },

  /**
   * Enable debug mode with enhanced features
   */
  enableDebugMode: () => {
    Logger.setDebugMode(true);
    
    // Add debug styles
    document.body.classList.add('debug-mode');
    
    // Show debug panel
    const debugPanel = document.getElementById('debugPanel');
    if (debugPanel) {
      debugPanel.classList.remove('hidden');
    }
    
    // Add debug info to title
    document.title += ' [DEBUG]';
    
    Logger.info('🔧 Debug mode enabled');
  },

  /**
   * Log comprehensive system information
   */
  logSystemInfo: () => {
    const info = {
      // App Info
      version: Config.APP.VERSION,
      buildTime: new Date().toISOString(),
      debugMode: Config.DEBUG_MODE,
      
      // Environment
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      
      // Screen/Device
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      deviceType: Utils.getDeviceType(),
      
      // Storage
      localStorageAvailable: Admin._checkStorageAvailable('localStorage'),
      sessionStorageAvailable: Admin._checkStorageAvailable('sessionStorage'),
      
      // API Status
      apiConnected: App.isOnlineMode,
      apiBaseUrl: Config.API.BASE_URL,
      
      // App State
      currentWeek: App.currentWeek,
      currentPlayer: App.currentPlayer,
      totalPicks: Object.keys(App.picks).length,
      totalPlayers: App.players.length
    };
    
    console.group('🎯 12Bowl System Information');
    console.table(info);
    console.groupEnd();
    
    return info;
  },

  /**
   * Check if storage type is available
   */
  _checkStorageAvailable: (type) => {
    try {
      const storage = window[type];
      const x = '__storage_test__';
      storage.setItem(x, x);
      storage.removeItem(x);
      return true;
    } catch(e) {
      return false;
    }
  },

  /**
   * Generate comprehensive test data
   */
  generateTestData: () => {
    Logger.info('🧪 Generating test data...');
    
    const players = App.players.length > 0 ? App.players : Config.APP.PLAYERS;
    const testData = {
      picks: {},
      standings: { weekly: {}, season: {} }
    };
    
    // Generate picks for multiple weeks
    for (let week = 1; week <= 5; week++) {
      const games = GameData.getSampleGames(week) || GameData.generateSampleWeek(week);
      
      players.forEach(player => {
        const playerKey = `${player}_week${week}`;
        testData.picks[playerKey] = {
          player: player,
          week: week,
          games: {},
          tiebreaker: Math.floor(Math.random() * 30) + 35 // 35-65
        };
        
        // Random picks for each game
        games.forEach(game => {
          const randomPick = Math.random() > 0.5 ? game.awayTeam : game.homeTeam;
          testData.picks[playerKey].games[game.id] = randomPick;
        });
      });
      
      // Generate weekly winner
      const randomWinner = players[Math.floor(Math.random() * players.length)];
      testData.standings.weekly[week] = {
        player: randomWinner,
        score: `${Math.floor(Math.random() * 5) + 10}/${games.length}`
      };
    }
    
    // Generate season standings
    testData.standings.season = players.map(player => ({
      player: player,
      wins: Math.floor(Math.random() * 30) + 10,
      totalGames: 50,
      percentage: '0.000'
    })).sort((a, b) => b.wins - a.wins);
    
    return testData;
  },

  /**
   * Load test data into app
   */
  loadTestData: () => {
    const testData = Admin.generateTestData();
    
    // Apply test data
    App.picks = testData.picks;
    App.standings = testData.standings;
    
    // Save to localStorage
    Utils.storage.set(Config.STORAGE_KEYS.PICKS, testData.picks);
    Utils.storage.set(Config.STORAGE_KEYS.STANDINGS, testData.standings);
    
    // Refresh UI
    if (App.currentPlayer) {
      loadPlayerPicks();
    }
    
    UI.updateWeeklyStandings();
    UI.updateSeasonStandings();
    
    Logger.info('🧪 Test data loaded successfully');
    Notifications.success('Test data loaded! Refresh to see changes.');
    
    return testData;
  },

  /**
   * Simulate game results for current week
   */
  simulateWeekResults: (week = null) => {
    const targetWeek = week || App.currentWeek;
    let games = GameData.getSampleGames(targetWeek);
    
    if (!games || games.length === 0) {
      games = GameData.generateSampleWeek(targetWeek);
    }
    
    // Simulate results
    const simulatedGames = GameData.simulateGameResults(games);
    
    // Update current week games if simulating current week
    if (targetWeek === App.currentWeek) {
      App.games = simulatedGames;
      UI.displayGames(simulatedGames);
    }
    
    Logger.info(`🎲 Simulated results for week ${targetWeek}`);
    return simulatedGames;
  },

  /**
   * Validate app integrity
   */
  validateAppState: () => {
    const issues = [];
    
    // Check required elements
    const requiredElements = [
      'playerSelect', 'gamesContainer', 'saveBtn', 
      'weekSelector', 'tiebreakerInput'
    ];
    
    requiredElements.forEach(id => {
      if (!document.getElementById(id)) {
        issues.push(`Missing required element: ${id}`);
      }
    });
    
    // Check app state
    if (App.currentWeek < 1 || App.currentWeek > Config.APP.MAX_WEEKS) {
      issues.push(`Invalid current week: ${App.currentWeek}`);
    }
    
    if (App.players.length === 0) {
      issues.push('No players loaded');
    }
    
    // Check localStorage
    if (!Admin._checkStorageAvailable('localStorage')) {
      issues.push('localStorage not available');
    }
    
    // Check API configuration
    if (!Config.API.BASE_URL) {
      issues.push('API base URL not configured');
    }
    
    const result = {
      valid: issues.length === 0,
      issues: issues,
      timestamp: new Date().toISOString()
    };
    
    if (result.valid) {
      Logger.info('✅ App state validation passed');
    } else {
      Logger.error('❌ App state validation failed:', result.issues);
    }
    
    return result;
  },

  /**
   * Performance monitoring
   */
  startPerformanceMonitoring: () => {
    if (!window.performance) {
      Logger.warn('Performance API not available');
      return;
    }
    
    const perfData = {
      navigationStart: performance.timing.navigationStart,
      loadEventEnd: performance.timing.loadEventEnd,
      domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
      pageLoad: performance.timing.loadEventEnd - performance.timing.navigationStart,
      memoryUsed: performance.memory ? performance.memory.usedJSHeapSize : null
    };
    
    Logger.info('📊 Performance metrics:', perfData);
    return perfData;
  },

  /**
   * Network diagnostics
   */
  runNetworkDiagnostics: async () => {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      connection: navigator.onLine,
      networkType: navigator.connection?.effectiveType || 'unknown',
      apiReachable: false,
      apiResponseTime: null,
      healthCheck: null
    };
    
    // Test API connectivity
    try {
      const startTime = performance.now();
      await API.testConnection();
      diagnostics.apiReachable = true;
      diagnostics.apiResponseTime = performance.now() - startTime;
    } catch (error) {
      diagnostics.apiError = error.message;
    }
    
    // Test health endpoint
    try {
      diagnostics.healthCheck = await API.healthCheck();
    } catch (error) {
      diagnostics.healthError = error.message;
    }
    
    Logger.info('🌐 Network diagnostics:', diagnostics);
    return diagnostics;
  },

  /**
   * Export comprehensive debug report
   */
  exportDebugReport: () => {
    const report = {
      metadata: {
        exportTime: new Date().toISOString(),
        version: Config.APP.VERSION,
        debugMode: Config.DEBUG_MODE
      },
      systemInfo: Admin.logSystemInfo(),
      appState: {
        currentWeek: App.currentWeek,
        currentPlayer: App.currentPlayer,
        isOnlineMode: App.isOnlineMode,
        isLoading: App.isLoading,
        games: App.games.length,
        picks: Object.keys(App.picks).length,
        players: App.players
      },
      validation: Admin.validateAppState(),
      logs: Logger.getLogs(),
      localStorage: {
        picks: Utils.storage.get(Config.STORAGE_KEYS.PICKS, {}),
        standings: Utils.storage.get(Config.STORAGE_KEYS.STANDINGS, {}),
        currentWeek: Utils.storage.get(Config.STORAGE_KEYS.CURRENT_WEEK, 1)
      },
      configuration: {
        api: Config.API,
        features: Config.FEATURES,
        timing: Config.TIMING
      }
    };
    
    const filename = `12bowl-debug-report-${new Date().toISOString().split('T')[0]}.json`;
    Utils.downloadJSON(report, filename);
    
    Logger.info('📋 Debug report exported');
    return report;
  },

  /**
   * Clear all data and reset app
   */
  factoryReset: () => {
    if (!confirm('🚨 FACTORY RESET: This will delete ALL data. Continue?')) {
      return false;
    }
    
    Logger.warn('🔄 Performing factory reset...');
    
    // Clear localStorage
    Utils.storage.clear();
    
    // Reset app state
    App.currentWeek = 1;
    App.currentPlayer = '';
    App.picks = {};
    App.games = [];
    App.players = [];
    App.standings = { weekly: {}, season: {} };
    
    // Reset UI
    if (App.elements.playerSelect) {
      App.elements.playerSelect.value = '';
    }
    
    // Reload page
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
    Logger.info('🔄 Factory reset completed');
    Notifications.warning('Factory reset completed. Reloading page...');
    
    return true;
  },

  /**
   * Toggle feature flags
   */
  toggleFeature: (featureName) => {
    if (!Config.FEATURES.hasOwnProperty(featureName)) {
      Logger.error(`Unknown feature: ${featureName}`);
      return;
    }
    
    const oldValue = Config.FEATURES[featureName];
    Config.FEATURES[featureName] = !oldValue;
    
    Logger.info(`🎛️ Feature toggle: ${featureName} = ${Config.FEATURES[featureName]}`);
    
    // Apply feature changes
    switch (featureName) {
      case 'OFFLINE_MODE':
        if (!Config.FEATURES.OFFLINE_MODE && !App.isOnlineMode) {
          Logger.warn('Offline mode disabled but currently offline');
        }
        break;
        
      case 'AUTO_SAVE':
        if (Config.FEATURES.AUTO_SAVE) {
          startAutoSave();
        } else {
          stopAutoSave();
        }
        break;
    }
    
    return Config.FEATURES[featureName];
  }
};

// Enhanced admin controls for console
window.adminControls = {
  ...window.adminControls, // Preserve existing controls
  
  // Data management
  loadTestData: Admin.loadTestData,
  validateApp: Admin.validateAppState,
  factoryReset: Admin.factoryReset,
  
  // Diagnostics
  systemInfo: Admin.logSystemInfo,
  networkDiag: Admin.runNetworkDiagnostics,
  perfMonitor: Admin.startPerformanceMonitoring,
  
  // Debug tools
  exportDebugReport: Admin.exportDebugReport,
  toggleFeature: Admin.toggleFeature,
  
  // Game simulation
  simulateWeek: Admin.simulateWeekResults,
  simulateAll: () => {
    for (let week = 1; week <= 5; week++) {
      Admin.simulateWeekResults(week);
    }
    Logger.info('🎲 Simulated results for weeks 1-5');
  },
  
  // Quick actions
  quickTest: () => {
    Logger.info('🚀 Running quick test suite...');
    
    const results = {
      validation: Admin.validateAppState(),
      testData: Object.keys(Admin.generateTestData()).length > 0,
      apiStatus: API.getStatus(),
      storageTest: Admin._checkStorageAvailable('localStorage')
    };
    
    console.table(results);
    return results;
  }
};

// Initialize admin features
document.addEventListener('DOMContentLoaded', () => {
  Admin.init();
  Logger.info('Admin module loaded');
});

// Add helpful console message
if (Config.DEBUG_MODE) {
  console.log(`
🔧 12Bowl Admin Controls Available:

DATA MANAGEMENT:
• adminControls.loadTestData()     - Generate and load test data
• adminControls.exportData()       - Export all user data
• importFromFile()                 - Import data from JSON file
• adminControls.factoryReset()     - Reset everything (destructive!)

DIAGNOSTICS:
• adminControls.systemInfo()       - Show system information
• adminControls.networkDiag()      - Test network connectivity
• adminControls.validateApp()      - Check app integrity
• adminControls.quickTest()        - Run test suite

GAME SIMULATION:
• adminControls.simulateWeek(2)    - Simulate results for specific week
• adminControls.simulateAll()      - Simulate results for weeks 1-5
• adminControls.calculateWeekScores(2) - Calculate weekly scores

DEBUG TOOLS:
• adminControls.exportDebugReport() - Export comprehensive debug report
• adminControls.toggleFeature('AUTO_SAVE') - Toggle feature flags
• adminControls.getStatus()        - Show current app status

QUICK ACCESS:
• Ctrl+D: Toggle debug panel
• Current Week: ${App.currentWeek}
• Online Mode: ${App.isOnlineMode}
• Players: ${App.players.length}
  `);
}
