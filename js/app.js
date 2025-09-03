/**
 * 12Bowl NFL Pick'em App - Main Application Controller
 * Coordinates all modules and manages app lifecycle
 */

// Global app state
window.App = {
  // Core state
  currentWeek: 1,
  currentPlayer: '',
  games: [],
  picks: {},
  standings: {
    weekly: {},
    season: {
      'Kid1': 0, 'Kid2': 0, 'Kid3': 0, 
      'Kid4': 0, 'Kid5': 0, 'Kid6': 0
    }
  },
  
  // App status
  isOnlineMode: false,
  isLoading: false,
  lastSaveTime: null,
  autoSaveTimer: null,
  
  // DOM elements (cached)
  elements: {
    loadingScreen: null,
    playerSelect: null,
    saveBtn: null,
    gamesContainer: null,
    tiebreakerSection: null,
    tiebreakerInput: null,
    weekSelector: null,
    connectionStatus: null,
    currentWeekDisplay: null,
    saveStatusBanner: null,
    debugPanel: null
  }
};

/**
 * Application Initialization
 */
document.addEventListener('DOMContentLoaded', async function() {
  try {
    Logger.info('🚀 Initializing 12Bowl App...');
    
    // Show loading screen
    showLoadingScreen();
    
    // Cache DOM elements
    cacheElements();
    
    // Initialize modules in order
    await initializeApp();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load initial data
    await loadInitialData();
    
    // Hide loading screen
    hideLoadingScreen();
    
    Logger.info('✅ App initialized successfully');
    
  } catch (error) {
    Logger.error('💥 App initialization failed:', error);
    showErrorState('Failed to initialize app', error.message);
  }
});

/**
 * Cache frequently used DOM elements
 */
function cacheElements() {
  const elements = App.elements;
  
  elements.loadingScreen = document.getElementById('loadingScreen');
  elements.playerSelect = document.getElementById('playerSelect');
  elements.saveBtn = document.getElementById('saveBtn');
  elements.gamesContainer = document.getElementById('gamesContainer');
  elements.tiebreakerSection = document.getElementById('tiebreakerSection');
  elements.tiebreakerInput = document.getElementById('tiebreakerInput');
  elements.weekSelector = document.getElementById('weekSelector');
  elements.connectionStatus = document.getElementById('connectionStatus');
  elements.currentWeekDisplay = document.getElementById('currentWeekDisplay');
  elements.saveStatusBanner = document.getElementById('saveStatusBanner');
  elements.debugPanel = document.getElementById('debugPanel');
  
  Logger.debug('DOM elements cached');
}

/**
 * Initialize all app modules
 */
async function initializeApp() {
  // Load saved data from localStorage
  loadSavedData();
  
  // Always load fallback players first so dropdown isn't empty
  const fallbackPlayers = ['Alex', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Taylor'];
  App.players = fallbackPlayers;
  updatePlayerDropdown(fallbackPlayers);
  Logger.info('Loaded fallback players for immediate display');
  
  // Initialize API connection
  await API.initialize();
  App.isOnlineMode = API.isConnected();
  
  // Update connection status
  updateConnectionStatus();
  
  // Generate week navigation
  UI.generateWeekButtons();
  
  // Set initial week display
  updateCurrentWeekDisplay();
  
  // Enable debug mode if requested
  if (Config.DEBUG_MODE) {
    enableDebugMode();
  }
  
  Logger.debug('App modules initialized');
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  const elements = App.elements;
  
  // Player selection
  elements.playerSelect.addEventListener('change', handlePlayerChange);
  
  // Tiebreaker input with debounced auto-save
  let tiebreakerTimeout;
  elements.tiebreakerInput.addEventListener('input', function() {
    clearTimeout(tiebreakerTimeout);
    tiebreakerTimeout = setTimeout(() => {
      if (App.currentPlayer) {
        savePicks(false); // Auto-save without notification
      }
    }, Config.AUTO_SAVE_DELAY);
  });
  
  // Week navigation
  document.getElementById('prevWeek').addEventListener('click', () => {
    const newWeek = Math.max(1, App.currentWeek - 1);
    if (newWeek !== App.currentWeek) {
      changeWeek(newWeek);
    }
  });
  
  document.getElementById('nextWeek').addEventListener('click', () => {
    const newWeek = Math.min(18, App.currentWeek + 1);
    if (newWeek !== App.currentWeek) {
      changeWeek(newWeek);
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
  
  // Auto-save before page unload
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  // Handle online/offline events
  window.addEventListener('online', handleOnlineStatusChange);
  window.addEventListener('offline', handleOnlineStatusChange);
  
  // Error handling
  window.addEventListener('error', handleGlobalError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
  
  Logger.debug('Event listeners setup complete');
}

/**
 * Load initial data (games, standings, etc.)
 */
async function loadInitialData() {
  try {
    App.isLoading = true;
    
    // Test backend connection
    await API.testConnection();
    App.isOnlineMode = API.isConnected();
    updateConnectionStatus();
    
    // Load games for current week
    await loadGames(App.currentWeek);
    
    // Load standings
    loadStandings();
    
    // Load player picks if player is selected
    if (App.currentPlayer) {
      loadPlayerPicks();
    }
    
  } catch (error) {
    Logger.error('Failed to load initial data:', error);
    Notifications.show('Failed to load some data. Using offline mode.', 'warning');
  } finally {
    App.isLoading = false;
  }
}

/**
 * Handle player selection change
 */
function handlePlayerChange(event) {
  const newPlayer = event.target.value;
  
  if (newPlayer === App.currentPlayer) return;
  
  App.currentPlayer = newPlayer;
  Logger.info(`Player selected: ${newPlayer}`);
  
  if (newPlayer) {
    // Show save button
    App.elements.saveBtn.style.display = 'block';
    App.elements.saveBtn.disabled = false;
    
    // Load player picks
    loadPlayerPicks();
    
    // Start auto-save timer
    startAutoSave();
    
    // Track player selection
    Analytics.trackPlayerSelection(newPlayer);
    
  } else {
    // Hide save button
    App.elements.saveBtn.style.display = 'none';
    
    // Stop auto-save
    stopAutoSave();
  }
  
  // Update UI
  UI.updatePlayerSelection();
}

/**
 * Change to a different week
 */
async function changeWeek(week) {
  if (App.isLoading) return;
  
  try {
    App.isLoading = true;
    
    // Update current week
    App.currentWeek = week;
    localStorage.setItem('currentWeek', week.toString());
    
    // Update UI
    updateCurrentWeekDisplay();
    UI.updateActiveWeekButton();
    
    // Load games for new week
    await loadGames(week);
    
    // Load player picks if player is selected
    if (App.currentPlayer) {
      loadPlayerPicks();
    }
    
    Logger.info(`Changed to week ${week}`);
    
  } catch (error) {
    Logger.error(`Failed to change to week ${week}:`, error);
    Notifications.show(`Failed to load week ${week}`, 'error');
  } finally {
    App.isLoading = false;
  }
}

/**
 * Load games for a specific week
 */
async function loadGames(week) {
  try {
    Logger.info(`Loading games for week ${week}...`);
    
    // Show loading state
    UI.showGamesLoading();
    
    let games = [];
    
    if (App.isOnlineMode) {
      try {
        // Try to get games from backend
        games = await API.getGames(week);
        Logger.info(`Loaded ${games.length} games from backend`);
      } catch (error) {
        Logger.warn('Backend failed, using sample data:', error);
        games = GameData.getSampleGames(week);
      }
    } else {
      // Use sample data
      games = GameData.getSampleGames(week);
      Logger.info(`Using sample data: ${games.length} games`);
    }
    
    App.games = games;
    
    if (games.length === 0) {
      UI.showEmptyState('No games available for this week yet.');
      App.elements.tiebreakerSection.classList.add('hidden');
    } else {
      UI.displayGames(games);
      App.elements.tiebreakerSection.classList.remove('hidden');
    }
    
  } catch (error) {
    Logger.error('Failed to load games:', error);
    UI.showErrorState('Failed to load games', 'Please try again later.');
  }
}

/**
 * Load player picks for current week and player
 */
function loadPlayerPicks() {
  if (!App.currentPlayer) return;
  
  const playerKey = `${App.currentPlayer}_week${App.currentWeek}`;
  const playerPicks = App.picks[playerKey];
  
  Logger.debug(`Loading picks for ${playerKey}:`, playerPicks);
  
  // Update tiebreaker input
  if (playerPicks && playerPicks.tiebreaker) {
    App.elements.tiebreakerInput.value = playerPicks.tiebreaker;
  } else {
    App.elements.tiebreakerInput.value = '';
  }
  
  // Update game displays
  if (App.games.length > 0) {
    UI.displayGames(App.games);
  }
}

/**
 * Save picks with enhanced feedback and error handling
 */
async function savePicks(showNotification = true) {
  if (!App.currentPlayer) {
    Notifications.show('Please select your name first!', 'error');
    return false;
  }
  
  const playerKey = `${App.currentPlayer}_week${App.currentWeek}`;
  const saveBtn = App.elements.saveBtn;
  
  try {
    // Show loading state
    UI.setSaveButtonLoading(true);
    
    // Prepare pick data
    const tiebreakerValue = App.elements.tiebreakerInput.value;
    if (App.picks[playerKey] && tiebreakerValue) {
      App.picks[playerKey].tiebreaker = parseInt(tiebreakerValue);
    }
    
    // Save locally first (always works)
    localStorage.setItem('nflPicks', JSON.stringify(App.picks));
    App.lastSaveTime = Date.now();
    
    let backendSaveSuccess = false;
    
    // Try to save to backend if online
    if (App.isOnlineMode && App.picks[playerKey]) {
      try {
        const playerPicks = App.picks[playerKey];
        
        // Save each pick individually to backend
        for (const [gameId, teamPick] of Object.entries(playerPicks.games || {})) {
          await API.savePick({
            player: App.currentPlayer,
            week: App.currentWeek,
            gameId: gameId,
            teamPick: teamPick,
            tiebreaker: playerPicks.tiebreaker
          });
        }
        
        backendSaveSuccess = true;
        Logger.info(`Picks saved to backend for ${App.currentPlayer}, week ${App.currentWeek}`);
        
      } catch (error) {
        Logger.warn(`Backend save failed: ${error.message}`);
        // Don't show error since local save worked
      }
    }
    
    // Show success feedback
    if (showNotification) {
      const message = backendSaveSuccess 
        ? 'Your picks have been saved successfully! 🏈'
        : 'Picks saved locally. Will sync when connection is restored.';
      
      const type = backendSaveSuccess ? 'success' : 'warning';
      
      Notifications.show(message, type);
      showSaveStatusBanner(backendSaveSuccess);
    }
    
    Logger.info(`Picks saved for ${App.currentPlayer}, week ${App.currentWeek}`);
    return true;
    
  } catch (error) {
    Logger.error(`Save error: ${error.message}`);
    Notifications.show('Failed to save picks. Please try again.', 'error');
    return false;
    
  } finally {
    UI.setSaveButtonLoading(false);
  }
}

/**
 * Make a team pick for a game
 */
function makePick(gameId, team) {
  if (!App.currentPlayer) {
    Notifications.show('Please select your name first!', 'error');
    return;
  }
  
  // Check if game is completed
  const game = App.games.find(g => g.id === gameId);
  if (game && game.completed) {
    Notifications.show('Cannot pick completed games!', 'error');
    return;
  }
  
  const playerKey = `${App.currentPlayer}_week${App.currentWeek}`;
  
  // Initialize pick data if needed
  if (!App.picks[playerKey]) {
    App.picks[playerKey] = {
      player: App.currentPlayer,
      week: App.currentWeek,
      games: {},
      tiebreaker: null
    };
  }
  
  // Save the pick
  App.picks[playerKey].games[gameId] = team;
  
  Logger.debug(`Pick made: ${App.currentPlayer} - Game ${gameId} - ${team}`);
  
  // Update UI immediately
  UI.updateGamePickUI(gameId, team);
  
  // Auto-save picks
  savePicks(false);
  
  // Track pick analytics
  Analytics.trackPick(gameId, team);
}

/**
 * Load saved data from localStorage
 */
function loadSavedData() {
  try {
    // Load picks
    const savedPicks = localStorage.getItem('nflPicks');
    if (savedPicks) {
      App.picks = JSON.parse(savedPicks);
    }
    
    // Load standings
    const savedStandings = localStorage.getItem('nflStandings');
    if (savedStandings) {
      App.standings = { ...App.standings, ...JSON.parse(savedStandings) };
    }
    
    // Load current week
    const savedWeek = localStorage.getItem('currentWeek');
    if (savedWeek) {
      App.currentWeek = parseInt(savedWeek);
    }
    
    Logger.debug('Saved data loaded from localStorage');
    
  } catch (error) {
    Logger.error('Failed to load saved data:', error);
  }
}

/**
 * Load and display standings
 */
function loadStandings() {
  try {
    UI.updateWeeklyStandings();
    UI.updateSeasonStandings();
    Logger.debug('Standings loaded');
  } catch (error) {
    Logger.error('Failed to load standings:', error);
  }
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus() {
  const status = App.elements.connectionStatus;
  const isConnected = App.isOnlineMode;
  
  status.className = `connection-status ${isConnected ? 'connected' : 'offline'}`;
  
  const indicator = status.querySelector('.status-indicator');
  const text = status.querySelector('.status-text');
  
  if (isConnected) {
    text.textContent = 'Connected';
  } else {
    text.textContent = 'Offline Mode';
  }
  
  Logger.debug(`Connection status updated: ${isConnected ? 'online' : 'offline'}`);
}

/**
 * Update current week display
 */
function updateCurrentWeekDisplay() {
  const display = App.elements.currentWeekDisplay;
  const weekNumber = display.querySelector('#currentWeekNumber');
  if (weekNumber) {
    weekNumber.textContent = App.currentWeek;
  }
}

/**
 * Show enhanced save status banner
 */
function showSaveStatusBanner(backendSuccess = true) {
  const banner = App.elements.saveStatusBanner;
  const title = banner.querySelector('.banner-title');
  const subtitle = banner.querySelector('.banner-subtitle');
  
  if (backendSuccess) {
    title.textContent = 'Picks Saved Successfully!';
    subtitle.textContent = 'Your selections have been secured for this week';
    banner.style.background = 'linear-gradient(135deg, var(--success) 0%, var(--success-light) 100%)';
  } else {
    title.textContent = 'Picks Saved Locally!';
    subtitle.textContent = 'Will sync when connection is restored';
    banner.style.background = 'linear-gradient(135deg, var(--warning) 0%, #F59E0B 100%)';
  }
  
  banner.classList.remove('hidden');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    hideSaveStatusBanner();
  }, 5000);
}

/**
 * Hide save status banner
 */
function hideSaveStatusBanner() {
  const banner = App.elements.saveStatusBanner;
  banner.classList.add('hidden');
}

/**
 * Show loading screen
 */
function showLoadingScreen() {
  const screen = App.elements.loadingScreen;
  if (screen) {
    screen.classList.remove('hidden');
  }
}

/**
 * Hide loading screen
 */
function hideLoadingScreen() {
  const screen = App.elements.loadingScreen;
  if (screen) {
    setTimeout(() => {
      screen.classList.add('hidden');
    }, 500); // Small delay for smooth transition
  }
}

/**
 * Show error state in main container
 */
function showErrorState(title, message) {
  const container = App.elements.gamesContainer;
  container.innerHTML = `
    <div class="error-state">
      <span class="error-icon">⚠️</span>
      <div class="error-title">${title}</div>
      <div class="error-message">${message}</div>
      <div class="error-actions">
        <button class="error-btn" onclick="location.reload()">Reload Page</button>
        <button class="error-btn" onclick="adminControls.toggleOnlineMode()">Try Offline Mode</button>
      </div>
    </div>
  `;
}

/**
 * Start auto-save timer
 */
function startAutoSave() {
  if (App.autoSaveTimer) {
    clearInterval(App.autoSaveTimer);
  }
  
  App.autoSaveTimer = setInterval(() => {
    if (App.currentPlayer && Object.keys(App.picks).length > 0) {
      savePicks(false);
      Logger.debug('Auto-save completed');
    }
  }, Config.AUTO_SAVE_INTERVAL);
  
  Logger.debug('Auto-save started');
}

/**
 * Stop auto-save timer
 */
function stopAutoSave() {
  if (App.autoSaveTimer) {
    clearInterval(App.autoSaveTimer);
    App.autoSaveTimer = null;
    Logger.debug('Auto-save stopped');
  }
}

/**
 * Enable debug mode
 */
function enableDebugMode() {
  Logger.setDebugMode(true);
  App.elements.debugPanel.classList.remove('hidden');
  
  // Add debug info to console
  console.log(`
🏈 12Bowl Debug Mode Enabled

Commands:
- adminControls.setWeek(5)       - Change week
- adminControls.testBackend()    - Test API connection  
- adminControls.exportData()     - Export all data
- adminControls.simulateResults() - Add fake results
- toggleDebugPanel()             - Toggle debug panel

Status:
- Week: ${App.currentWeek}
- Player: ${App.currentPlayer || 'None'}
- Online: ${App.isOnlineMode}
- Picks: ${Object.keys(App.picks).length}
  `);
}

/**
 * Toggle debug panel visibility
 */
function toggleDebugPanel() {
  const panel = App.elements.debugPanel;
  panel.classList.toggle('hidden');
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboardShortcuts(event) {
  // Ctrl+D - Toggle debug panel
  if (event.ctrlKey && event.key === 'd') {
    event.preventDefault();
    toggleDebugPanel();
    return;
  }
  
  // Ctrl+S - Save picks
  if (event.ctrlKey && event.key === 's') {
    event.preventDefault();
    if (App.currentPlayer) {
      savePicks(true);
    }
    return;
  }
  
  // Arrow keys - Navigate weeks
  if (event.altKey) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const newWeek = Math.max(1, App.currentWeek - 1);
      if (newWeek !== App.currentWeek) {
        changeWeek(newWeek);
      }
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      const newWeek = Math.min(18, App.currentWeek + 1);
      if (newWeek !== App.currentWeek) {
        changeWeek(newWeek);
      }
    }
  }
}

/**
 * Handle before unload - save data
 */
function handleBeforeUnload(event) {
  try {
    // Save current data
    if (App.currentPlayer && Object.keys(App.picks).length > 0) {
      localStorage.setItem('nflPicks', JSON.stringify(App.picks));
      localStorage.setItem('currentWeek', App.currentWeek.toString());
    }
    
    // Stop auto-save
    stopAutoSave();
    
  } catch (error) {
    Logger.error('Error during page unload:', error);
  }
}

/**
 * Handle online/offline status changes
 */
function handleOnlineStatusChange() {
  const wasOnline = App.isOnlineMode;
  const isOnline = navigator.onLine && API.isConnected();
  
  if (isOnline !== wasOnline) {
    App.isOnlineMode = isOnline;
    updateConnectionStatus();
    
    if (isOnline) {
      Logger.info('Connection restored - switching to online mode');
      Notifications.show('Connection restored!', 'success');
      
      // Retry loading current week data
      loadGames(App.currentWeek);
      
    } else {
      Logger.warn('Connection lost - switching to offline mode');
      Notifications.show('Connection lost. Working offline.', 'warning');
    }
  }
}

/**
 * Global error handler
 */
function handleGlobalError(event) {
  const error = event.error || event;
  Logger.error('Global error:', error);
  
  // Don't show error notifications for every script error
  // Only show for critical errors
  if (error.message && error.message.includes('ChunkLoadError')) {
    Notifications.show('App update available. Please refresh the page.', 'info');
  }
}

/**
 * Handle unhandled promise rejections
 */
function handleUnhandledRejection(event) {
  const error = event.reason;
  Logger.error('Unhandled promise rejection:', error);
  
  // Show user-friendly error for network issues
  if (error && error.message && error.message.includes('fetch')) {
    Notifications.show('Network error occurred. Data saved locally.', 'warning');
  }
  
  // Prevent default browser error handling
  event.preventDefault();
}

/**
 * Expose global functions for HTML onclick handlers
 */
window.savePicks = savePicks;
window.makePick = makePick;
window.hideSaveStatusBanner = hideSaveStatusBanner;
window.toggleDebugPanel = toggleDebugPanel;

/**
 * Enhanced Admin Controls for debugging and management
 */
window.adminControls = {
  setWeek: (week) => {
    if (week < 1 || week > 18) {
      Logger.error('Invalid week number. Must be 1-18.');
      return;
    }
    changeWeek(week);
    Notifications.show(`Week changed to ${week}`, 'success');
  },
  
  toggleOnlineMode: () => {
    App.isOnlineMode = !App.isOnlineMode;
    updateConnectionStatus();
    Logger.info(`Online mode: ${App.isOnlineMode ? 'ENABLED' : 'DISABLED'}`);
    loadGames(App.currentWeek);
  },
  
  testBackend: async () => {
    Logger.info('Testing backend connection...');
    try {
      await API.testConnection();
      const isConnected = API.isConnected();
      App.isOnlineMode = isConnected;
      updateConnectionStatus();
      
      const message = isConnected ? 'Backend connection successful!' : 'Backend connection failed.';
      const type = isConnected ? 'success' : 'error';
      Notifications.show(message, type);
      
      return isConnected;
    } catch (error) {
      Logger.error('Backend test failed:', error);
      Notifications.show(`Backend test failed: ${error.message}`, 'error');
      return false;
    }
  },
  
  exportData: () => {
    const data = {
      picks: App.picks,
      standings: App.standings,
      currentWeek: App.currentWeek,
      currentPlayer: App.currentPlayer,
      exportDate: new Date().toISOString(),
      version: '2.0'
    };
    
    Utils.downloadJSON(data, `12bowl-data-week${App.currentWeek}-${new Date().toISOString().split('T')[0]}.json`);
    Logger.info('Data exported successfully');
    Notifications.show('Data exported successfully!', 'success');
  },
  
  importData: (jsonData) => {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      
      if (data.picks) App.picks = data.picks;
      if (data.standings) App.standings = data.standings;
      if (data.currentWeek) {
        App.currentWeek = data.currentWeek;
        updateCurrentWeekDisplay();
        UI.updateActiveWeekButton();
      }
      if (data.currentPlayer) {
        App.currentPlayer = data.currentPlayer;
        App.elements.playerSelect.value = data.currentPlayer;
        UI.updatePlayerSelection();
      }
      
      // Save to localStorage
      localStorage.setItem('nflPicks', JSON.stringify(App.picks));
      localStorage.setItem('nflStandings', JSON.stringify(App.standings));
      localStorage.setItem('currentWeek', App.currentWeek.toString());
      
      // Refresh displays
      loadGames(App.currentWeek);
      loadStandings();
      if (App.currentPlayer) loadPlayerPicks();
      
      Logger.info('Data imported successfully');
      Notifications.show('Data imported successfully!', 'success');
      
    } catch (error) {
      Logger.error('Import failed:', error);
      Notifications.show(`Import failed: ${error.message}`, 'error');
    }
  },
  
  resetSeason: () => {
    if (confirm('⚠️ Reset entire season? This cannot be undone!')) {
      localStorage.clear();
      Logger.info('Season data reset');
      Notifications.show('Season reset complete!', 'success');
      setTimeout(() => location.reload(), 1000);
    }
  },
  
  simulateResults: (week = null) => {
    const targetWeek = week || App.currentWeek;
    const games = GameData.getSampleGames(targetWeek);
    
    if (!games || games.length === 0) {
      Logger.error('No games found for simulation');
      Notifications.show(`No games found for week ${targetWeek}`, 'error');
      return;
    }
    
    games.forEach(game => {
      if (!game.completed) {
        // Simulate random scores
        game.awayScore = Math.floor(Math.random() * 28) + 7; // 7-35 points
        game.homeScore = Math.floor(Math.random() * 28) + 7;
        game.completed = true;
        game.winner = game.awayScore > game.homeScore ? game.awayTeam : game.homeTeam;
      }
    });
    
    // Update current games if simulating current week
    if (targetWeek === App.currentWeek) {
      App.games = games;
      UI.displayGames(games);
    }
    
    Logger.info(`Simulated results for week ${targetWeek}`);
    Notifications.show(`Game results simulated for week ${targetWeek}`, 'success');
    
    return games;
  },
  
  calculateWeekScores: (week = null) => {
    const targetWeek = week || App.currentWeek;
    const games = GameData.getSampleGames(targetWeek);
    
    if (!games || games.length === 0) {
      Logger.warn(`No games found for week ${targetWeek}`);
      return {};
    }
    
    const scores = {};
    const players = App.players.length > 0 ? App.players : Config.APP.PLAYERS;
    
    players.forEach(player => {
      const playerKey = `${player}_week${targetWeek}`;
      const playerPicks = App.picks[playerKey];
      
      if (!playerPicks) {
        scores[player] = { correct: 0, total: 0, percentage: 0 };
        return;
      }
      
      let correct = 0;
      let total = 0;
      
      games.forEach(game => {
        if (game.completed && game.winner) {
          total++;
          const pick = playerPicks.games[game.id];
          if (pick === game.winner) {
            correct++;
          }
        }
      });
      
      scores[player] = {
        correct,
        total,
        percentage: total > 0 ? (correct / total * 100).toFixed(1) : 0
      };
    });
    
    Logger.info(`Week ${targetWeek} scores calculated:`, scores);
    return scores;
  },
  
  getStatus: () => {
    const status = {
      currentWeek: App.currentWeek,
      currentPlayer: App.currentPlayer,
      isOnlineMode: App.isOnlineMode,
      isLoading: App.isLoading,
      totalGames: App.games.length,
      totalPicks: Object.keys(App.picks).length,
      lastSaveTime: App.lastSaveTime ? new Date(App.lastSaveTime).toLocaleString() : 'Never',
      autoSaveActive: !!App.autoSaveTimer,
      localStorageSize: JSON.stringify(App.picks).length + ' bytes',
      debugMode: Logger.isDebugMode()
    };
    
    console.table(status);
    return status;
  }
};

/**
 * File import helper
 */
window.importFromFile = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.style.display = 'none';
  
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          window.adminControls.importData(e.target.result);
        } catch (error) {
          Notifications.show(`Import failed: ${error.message}`, 'error');
        }
      };
      reader.readAsText(file);
    }
  };
  
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
};

/**
 * Analytics tracking (placeholder for future implementation)
 */
const Analytics = {
  trackPlayerSelection: (player) => {
    Logger.debug(`Analytics: Player selected - ${player}`);
  },
  
  trackPick: (gameId, team) => {
    Logger.debug(`Analytics: Pick made - Game ${gameId}, Team ${team}`);
  },
  
  trackWeekChange: (week) => {
    Logger.debug(`Analytics: Week changed - ${week}`);
  }
};

// Log successful app.js load
Logger.info('App.js loaded successfully');
