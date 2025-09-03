/**
 * 12Bowl NFL Pick'em App - Configuration
 * Central configuration and constants
 */

window.Config = {
  // API Configuration
  API: {
    BASE_URL: '/.netlify/functions/sheets-api',
    TIMEOUT: 10000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
  },
  
  // App Settings
  APP: {
    VERSION: '2.0.0',
    NAME: '12Bowl NFL Pick\'em',
    MAX_WEEKS: 18,
    PLAYERS: ['Kid1', 'Kid2', 'Kid3', 'Kid4', 'Kid5', 'Kid6']
  },
  
  // Timing
  TIMING: {
    AUTO_SAVE_DELAY: 2000,        // Delay before auto-saving (ms)
    AUTO_SAVE_INTERVAL: 60000,    // Auto-save interval (ms)
    NOTIFICATION_DURATION: 4000,  // How long notifications show (ms)
    LOADING_DELAY: 500,           // Loading screen minimum duration (ms)
    ANIMATION_DURATION: 300       // Standard animation duration (ms)
  },
  
  // UI Settings
  UI: {
    MOBILE_BREAKPOINT: 768,
    TABLET_BREAKPOINT: 1024,
    DESKTOP_BREAKPOINT: 1200,
    ANIMATIONS_ENABLED: true,
    THEME: 'dark' // Only dark theme for now
  },
  
  // Debug Settings
  DEBUG_MODE: window.location.search.includes('debug=true') || 
              window.location.hostname === 'localhost' ||
              window.localStorage.getItem('debugMode') === 'true',
  
  // Feature Flags
  FEATURES: {
    OFFLINE_MODE: true,
    AUTO_SAVE: true,
    PUSH_NOTIFICATIONS: false, // Future feature
    REAL_TIME_UPDATES: false,  // Future feature
    ANALYTICS: false,          // Future feature
    DARK_MODE_ONLY: true
  },
  
  // LocalStorage Keys
  STORAGE_KEYS: {
    PICKS: 'nflPicks',
    STANDINGS: 'nflStandings',
    CURRENT_WEEK: 'currentWeek',
    PLAYER_PREFS: 'playerPreferences',
    DEBUG_MODE: 'debugMode',
    LAST_SYNC: 'lastSyncTime',
    APP_VERSION: 'appVersion'
  },
  
  // Error Messages
  ERRORS: {
    NO_CONNECTION: 'Unable to connect to server. Working offline.',
    SAVE_FAILED: 'Failed to save picks. Please try again.',
    LOAD_FAILED: 'Failed to load data. Please refresh the page.',
    INVALID_WEEK: 'Invalid week number. Please select a valid week.',
    NO_PLAYER: 'Please select your name before making picks.',
    GAME_COMPLETED: 'Cannot modify picks for completed games.',
    INVALID_DATA: 'Invalid data format. Please check your import file.'
  },
  
  // Success Messages  
  SUCCESS: {
    PICKS_SAVED: 'Your picks have been saved successfully! 🏈',
    PICKS_SAVED_OFFLINE: 'Picks saved locally. Will sync when connection restored.',
    DATA_EXPORTED: 'Data exported successfully!',
    DATA_IMPORTED: 'Data imported successfully!',
    CONNECTION_RESTORED: 'Connection restored!',
    WEEK_CHANGED: 'Week changed successfully'
  },
  
  // Sample Game Data Structure
  SAMPLE_GAMES: {
    1: [
      {
        id: 1,
        day: 'Thursday, Sep. 5',
        time: '8:20 PM ET',
        awayTeam: 'Baltimore',
        homeTeam: 'Kansas City',
        overUnder: 46.5,
        completed: false,
        awayScore: null,
        homeScore: null,
        winner: null,
        isMNF: false
      },
      {
        id: 2,
        day: 'Sunday, Sep. 8', 
        time: '1:00 PM ET',
        awayTeam: 'Atlanta',
        homeTeam: 'Pittsburgh',
        overUnder: 42.0,
        completed: false,
        awayScore: null,
        homeScore: null,
        winner: null,
        isMNF: false
      },
      {
        id: 3,
        day: 'Sunday, Sep. 8',
        time: '1:00 PM ET', 
        awayTeam: 'Miami',
        homeTeam: 'Jacksonville',
        overUnder: 47.5,
        completed: false,
        awayScore: null,
        homeScore: null,
        winner: null,
        isMNF: false
      },
      {
        id: 4,
        day: 'Sunday, Sep. 8',
        time: '4:25 PM ET',
        awayTeam: 'Green Bay',
        homeTeam: 'Philadelphia', 
        overUnder: 48.5,
        completed: false,
        awayScore: null,
        homeScore: null,
        winner: null,
        isMNF: false
      },
      {
        id: 5,
        day: 'Monday, Sep. 9',
        time: '8:15 PM ET',
        awayTeam: 'NY Jets',
        homeTeam: 'San Francisco',
        overUnder: 43.5,
        completed: false,
        awayScore: null,
        homeScore: null,
        winner: null,
        isMNF: true
      }
    ],
    
    2: [
      {
        id: 6,
        day: 'Thursday, Sep. 12',
        time: '8:15 PM ET',
        awayTeam: 'Buffalo',
        homeTeam: 'Miami',
        overUnder: 49.0,
        completed: true,
        awayScore: 31,
        homeScore: 10,
        winner: 'Buffalo',
        isMNF: false
      },
      {
        id: 7,
        day: 'Sunday, Sep. 15',
        time: '1:00 PM ET',
        awayTeam: 'Indianapolis',
        homeTeam: 'Houston',
        overUnder: 44.5,
        completed: true,
        awayScore: 29,
        homeScore: 27,
        winner: 'Indianapolis',
        isMNF: false
      },
      {
        id: 8,
        day: 'Sunday, Sep. 15',
        time: '4:25 PM ET',
        awayTeam: 'Dallas',
        homeTeam: 'Washington',
        overUnder: 45.5,
        completed: true,
        awayScore: 23,
        homeScore: 26,
        winner: 'Washington',
        isMNF: false
      },
      {
        id: 9,
        day: 'Monday, Sep. 16',
        time: '8:15 PM ET',
        awayTeam: 'Cincinnati',
        homeTeam: 'Washington',
        overUnder: 47.0,
        completed: false,
        awayScore: null,
        homeScore: null,
        winner: null,
        isMNF: true
      }
    ]
  },
  
  // NFL Team Abbreviations/Names
  NFL_TEAMS: {
    // AFC East
    'Buffalo': 'BUF',
    'Miami': 'MIA', 
    'New England': 'NE',
    'NY Jets': 'NYJ',
    
    // AFC North
    'Baltimore': 'BAL',
    'Cincinnati': 'CIN',
    'Cleveland': 'CLE',
    'Pittsburgh': 'PIT',
    
    // AFC South
    'Houston': 'HOU',
    'Indianapolis': 'IND',
    'Jacksonville': 'JAX',
    'Tennessee': 'TEN',
    
    // AFC West
    'Denver': 'DEN',
    'Kansas City': 'KC',
    'Las Vegas': 'LV',
    'LA Chargers': 'LAC',
    
    // NFC East
    'Dallas': 'DAL',
    'NY Giants': 'NYG',
    'Philadelphia': 'PHI',
    'Washington': 'WAS',
    
    // NFC North
    'Chicago': 'CHI',
    'Detroit': 'DET',
    'Green Bay': 'GB',
    'Minnesota': 'MIN',
    
    // NFC South
    'Atlanta': 'ATL',
    'Carolina': 'CAR',
    'New Orleans': 'NO',
    'Tampa Bay': 'TB',
    
    // NFC West
    'Arizona': 'ARI',
    'LA Rams': 'LAR',
    'San Francisco': 'SF',
    'Seattle': 'SEA'
  },
  
  // Validation Rules
  VALIDATION: {
    MIN_WEEK: 1,
    MAX_WEEK: 18,
    MIN_TIEBREAKER: 0,
    MAX_TIEBREAKER: 150,
    REQUIRED_PICKS_FOR_WEEK: 0, // 0 = no minimum requirement
    MAX_PLAYER_NAME_LENGTH: 20,
    MAX_IMPORT_FILE_SIZE: 5 * 1024 * 1024 // 5MB
  },
  
  // CSS Classes for dynamic styling
  CSS_CLASSES: {
    HIDDEN: 'hidden',
    LOADING: 'loading',
    ERROR: 'error',
    SUCCESS: 'success',
    WARNING: 'warning',
    ACTIVE: 'active',
    SELECTED: 'selected',
    DISABLED: 'disabled',
    COMPLETED: 'completed',
    CORRECT_PICK: 'correct-pick',
    WRONG_PICK: 'wrong-pick',
    WINNING_TEAM: 'winning-team',
    LOSING_TEAM: 'losing-team'
  },
  
  // Accessibility
  A11Y: {
    FOCUS_VISIBLE_CLASS: 'focus-visible',
    SR_ONLY_CLASS: 'sr-only',
    HIGH_CONTRAST_MODE: false, // Future feature
    KEYBOARD_NAVIGATION: true,
    SCREEN_READER_SUPPORT: true
  }
};

// Make timing constants available as shortcuts
window.AUTO_SAVE_DELAY = Config.TIMING.AUTO_SAVE_DELAY;
window.AUTO_SAVE_INTERVAL = Config.TIMING.AUTO_SAVE_INTERVAL;

// Freeze config to prevent accidental modifications
Object.freeze(Config);

// Log config load
if (Config.DEBUG_MODE) {
  console.log('🔧 Config loaded:', Config);
}
