/**
 * 12Bowl NFL Pick'em App - API Module
 * Handles all communication with the Netlify backend
 */

window.API = {
  _isConnected: false,
  _lastError: null,
  _retryCount: 0,

  /**
   * Initialize API connection
   */
  initialize: async () => {
    Logger.info('Initializing API connection...');
    try {
      await API.testConnection();
      Logger.info('API initialized successfully');
    } catch (error) {
      Logger.warn('API initialization failed, will use offline mode:', error);
      API._isConnected = false;
    }
  },

  /**
   * Test backend connection
   */
  testConnection: async () => {
    try {
      Logger.debug('Testing backend connection...');
      
      const response = await API._makeRequest('getCurrentWeek', {});
      
      if (response && !response.error) {
        API._isConnected = true;
        API._lastError = null;
        API._retryCount = 0;
        Logger.info('Backend connection successful');
        return true;
      } else {
        throw new Error(response.error || 'Unknown backend error');
      }
      
    } catch (error) {
      API._isConnected = false;
      API._lastError = error.message;
      Logger.warn('Backend connection failed:', error.message);
      throw error;
    }
  },

  /**
   * Check if API is connected
   */
  isConnected: () => API._isConnected,

  /**
   * Get last error
   */
  getLastError: () => API._lastError,

  /**
   * Get current week from backend
   */
  getCurrentWeek: async () => {
    try {
      const response = await API._makeRequest('getCurrentWeek', {});
      return response.currentWeek || 1;
    } catch (error) {
      Logger.warn('Failed to get current week from backend:', error);
      return 1; // Default fallback
    }
  },

  /**
   * Get games for a specific week
   */
  getGames: async (week) => {
    try {
      const response = await API._makeRequest('getGames', { week });
      return response.games || [];
    } catch (error) {
      Logger.warn(`Failed to get games for week ${week}:`, error);
      throw error;
    }
  },

  /**
   * Save a pick to the backend
   */
  savePick: async (pickData) => {
    try {
      // Validate pick data
      const validation = Validation.validatePickData(pickData);
      if (!validation.isValid) {
        throw new Error(`Invalid pick data: ${validation.errors.join(', ')}`);
      }

      Logger.debug('Saving pick to backend:', pickData);
      
      const response = await API._makeRequest('savePick', pickData);
      
      if (response.success) {
        Logger.info('Pick saved to backend successfully');
        return response;
      } else {
        throw new Error(response.error || 'Failed to save pick');
      }
      
    } catch (error) {
      Logger.error('Failed to save pick:', error);
      throw error;
    }
  },

  /**
   * Get picks for a specific player and week
   */
  getPicks: async (player, week) => {
    try {
      const response = await API._makeRequest('getPicks', { player, week });
      return response.picks || [];
    } catch (error) {
      Logger.warn(`Failed to get picks for ${player}, week ${week}:`, error);
      return [];
    }
  },

  /**
   * Get standings from backend
   */
  getStandings: async () => {
    try {
      const response = await API._makeRequest('getStandings', {});
      return {
        standings: response.standings || [],
        players: response.players || [],
        lastUpdated: response.lastUpdated
      };
    } catch (error) {
      Logger.warn('Failed to get standings:', error);
      throw error;
    }
  },

  /**
   * Get player names from standings sheet
   */
  getPlayers: async () => {
    try {
      const response = await API._makeRequest('getPlayers', {});
      return {
        players: response.players || [],
        success: response.success !== false
      };
    } catch (error) {
      Logger.warn('Failed to get players:', error);
      throw error;
    }
  },

  /**
   * Generic request handler with retry logic
   */
  _makeRequest: async (action, data, retryCount = 0) => {
    try {
      const url = Config.API.BASE_URL;
      const payload = { action, data };

      Logger.debug(`API Request: ${action}`, data);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), Config.API.TIMEOUT);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          errorMessage += ` - ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      Logger.debug(`API Response: ${action}`, result);
      
      // Update connection status on successful request
      API._isConnected = true;
      API._lastError = null;
      
      return result;

    } catch (error) {
      Logger.error(`API request failed (${action}):`, error.message);

      // Handle different error types
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please try again');
      }
      
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        API._isConnected = false;
        throw new Error('Network error - check your internet connection');
      }

      // Retry logic for certain errors
      if (retryCount < Config.API.MAX_RETRIES && API._shouldRetry(error)) {
        Logger.info(`Retrying request (${retryCount + 1}/${Config.API.MAX_RETRIES})...`);
        
        await Utils.sleep(Config.API.RETRY_DELAY * (retryCount + 1));
        return API._makeRequest(action, data, retryCount + 1);
      }

      API._lastError = error.message;
      throw error;
    }
  },

  /**
   * Determine if request should be retried
   */
  _shouldRetry: (error) => {
    const retryableErrors = [
      'timeout',
      'network error',
      'internal server error',
      'bad gateway',
      'service unavailable',
      'gateway timeout'
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(retryable => errorMessage.includes(retryable));
  },

  /**
   * Health check endpoint
   */
  healthCheck: async () => {
    try {
      const url = Config.API.BASE_URL.replace('/sheets-api', '/health');
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        Logger.info('Health check passed:', data);
        return data;
      } else {
        throw new Error(`Health check failed: ${response.status}`);
      }
      
    } catch (error) {
      Logger.warn('Health check failed:', error);
      throw error;
    }
  },

  /**
   * Batch save multiple picks (future enhancement)
   */
  saveBatchPicks: async (picks) => {
    const results = [];
    
    for (const pick of picks) {
      try {
        const result = await API.savePick(pick);
        results.push({ success: true, pick, result });
      } catch (error) {
        results.push({ success: false, pick, error: error.message });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    Logger.info(`Batch save completed: ${successful} successful, ${failed} failed`);
    return results;
  },

  /**
   * Get API status for debugging
   */
  getStatus: () => ({
    isConnected: API._isConnected,
    lastError: API._lastError,
    retryCount: API._retryCount,
    baseUrl: Config.API.BASE_URL,
    timeout: Config.API.TIMEOUT,
    maxRetries: Config.API.MAX_RETRIES
  })
};

// Log API module load
Logger.info('API module loaded');
