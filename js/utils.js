/**
 * 12Bowl NFL Pick'em App - Utilities
 * Common utility functions and helpers
 */

window.Utils = {
  /**
   * Download JSON data as a file
   */
  downloadJSON: (data, filename = 'data.json') => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Debounce function execution
   */
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Throttle function execution
   */
  throttle: (func, limit) => {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Format date for display
   */
  formatDate: (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  },

  /**
   * Format time for display
   */
  formatTime: (time) => {
    if (!time) return '';
    return time.replace(/(\d{1,2}):(\d{2})\s*(AM|PM)/i, (match, hour, minute, period) => {
      return `${hour}:${minute} ${period.toUpperCase()}`;
    });
  },

  /**
   * Generate unique ID
   */
  generateId: () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  /**
   * Deep clone object
   */
  deepClone: (obj) => {
    if (obj === null || typeof obj !== "object") return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => Utils.deepClone(item));
    if (typeof obj === "object") {
      const clonedObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = Utils.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
  },

  /**
   * Check if device is mobile
   */
  isMobile: () => {
    return window.innerWidth <= Config.UI.MOBILE_BREAKPOINT;
  },

  /**
   * Check if device is tablet
   */
  isTablet: () => {
    return window.innerWidth > Config.UI.MOBILE_BREAKPOINT && 
           window.innerWidth <= Config.UI.TABLET_BREAKPOINT;
  },

  /**
   * Check if device is desktop
   */
  isDesktop: () => {
    return window.innerWidth > Config.UI.TABLET_BREAKPOINT;
  },

  /**
   * Get device type
   */
  getDeviceType: () => {
    if (Utils.isMobile()) return 'mobile';
    if (Utils.isTablet()) return 'tablet';
    return 'desktop';
  },

  /**
   * Sanitize HTML string
   */
  sanitizeHtml: (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * Validate email format
   */
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Calculate percentage
   */
  percentage: (value, total) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  },

  /**
   * Format number with commas
   */
  formatNumber: (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  },

  /**
   * Sleep/delay function
   */
  sleep: (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Local storage helpers with error handling
   */
  storage: {
    get: (key, defaultValue = null) => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (error) {
        Logger.error(`Failed to get ${key} from localStorage:`, error);
        return defaultValue;
      }
    },

    set: (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        Logger.error(`Failed to set ${key} in localStorage:`, error);
        return false;
      }
    },

    remove: (key) => {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        Logger.error(`Failed to remove ${key} from localStorage:`, error);
        return false;
      }
    },

    clear: () => {
      try {
        localStorage.clear();
        return true;
      } catch (error) {
        Logger.error('Failed to clear localStorage:', error);
        return false;
      }
    }
  },

  /**
   * URL helpers
   */
  url: {
    getParams: () => {
      const params = new URLSearchParams(window.location.search);
      const result = {};
      for (const [key, value] of params) {
        result[key] = value;
      }
      return result;
    },

    getParam: (name, defaultValue = null) => {
      const params = new URLSearchParams(window.location.search);
      return params.get(name) || defaultValue;
    },

    setParam: (name, value) => {
      const params = new URLSearchParams(window.location.search);
      params.set(name, value);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    }
  },

  /**
   * Array helpers
   */
  array: {
    shuffle: (array) => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    },

    unique: (array) => {
      return [...new Set(array)];
    },

    groupBy: (array, key) => {
      return array.reduce((groups, item) => {
        const group = item[key];
        groups[group] = groups[group] || [];
        groups[group].push(item);
        return groups;
      }, {});
    },

    sortBy: (array, key, direction = 'asc') => {
      return [...array].sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        if (direction === 'desc') {
          return bVal > aVal ? 1 : -1;
        }
        return aVal > bVal ? 1 : -1;
      });
    }
  }
};

/**
 * Enhanced Logger with different levels
 */
window.Logger = {
  _debugMode: Config.DEBUG_MODE,
  _logs: [],
  _maxLogs: 100,

  setDebugMode: (enabled) => {
    Logger._debugMode = enabled;
    Utils.storage.set(Config.STORAGE_KEYS.DEBUG_MODE, enabled);
  },

  isDebugMode: () => Logger._debugMode,

  _log: (level, message, data = null) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };

    // Add to internal log store
    Logger._logs.push(logEntry);
    if (Logger._logs.length > Logger._maxLogs) {
      Logger._logs.shift();
    }

    // Console output
    if (Logger._debugMode) {
      const formattedMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
      
      switch (level) {
        case 'error':
          console.error(formattedMessage, data || '');
          break;
        case 'warn':
          console.warn(formattedMessage, data || '');
          break;
        case 'info':
          console.info(formattedMessage, data || '');
          break;
        case 'debug':
          console.log(formattedMessage, data || '');
          break;
        default:
          console.log(formattedMessage, data || '');
      }

      // Update debug panel if visible
      Logger._updateDebugPanel();
    }
  },

  debug: (message, data) => Logger._log('debug', message, data),
  info: (message, data) => Logger._log('info', message, data),
  warn: (message, data) => Logger._log('warn', message, data),
  error: (message, data) => Logger._log('error', message, data),

  getLogs: () => [...Logger._logs],

  clearLogs: () => {
    Logger._logs = [];
    Logger._updateDebugPanel();
  },

  _updateDebugPanel: () => {
    const debugLogs = document.getElementById('debugLogs');
    if (debugLogs && debugLogs.offsetParent) {
      const recentLogs = Logger._logs.slice(-5);
      debugLogs.textContent = recentLogs
        .map(log => `${log.timestamp.split('T')[1].split('.')[0]} ${log.level.toUpperCase()}: ${log.message}`)
        .join('\n');
      debugLogs.scrollTop = debugLogs.scrollHeight;
    }
  },

  exportLogs: () => {
    const data = {
      logs: Logger._logs,
      exportTime: new Date().toISOString(),
      version: Config.APP.VERSION
    };
    Utils.downloadJSON(data, `12bowl-logs-${new Date().toISOString().split('T')[0]}.json`);
  }
};

/**
 * Enhanced Notifications System
 */
window.Notifications = {
  _container: null,
  _notifications: new Map(),
  _idCounter: 0,

  init: () => {
    Notifications._container = document.getElementById('notificationContainer');
    if (!Notifications._container) {
      // Create container if it doesn't exist
      Notifications._container = document.createElement('div');
      Notifications._container.id = 'notificationContainer';
      Notifications._container.className = 'notification-container';
      document.body.appendChild(Notifications._container);
    }
  },

  show: (message, type = 'info', options = {}) => {
    if (!Notifications._container) {
      Notifications.init();
    }

    const id = ++Notifications._idCounter;
    const notification = Notifications._create(id, message, type, options);
    
    Notifications._container.appendChild(notification);
    Notifications._notifications.set(id, notification);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    // Auto-dismiss
    const duration = options.duration || Config.TIMING.NOTIFICATION_DURATION;
    if (duration > 0) {
      setTimeout(() => {
        Notifications.dismiss(id);
      }, duration);
    }

    Logger.debug(`Notification shown: ${type} - ${message}`);
    return id;
  },

  _create: (id, message, type, options) => {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.dataset.id = id;

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    const title = options.title || Notifications._getDefaultTitle(type);
    
    notification.innerHTML = `
      <div class="notification-icon">${icons[type] || icons.info}</div>
      <div class="notification-content">
        ${title ? `<div class="notification-title">${Utils.sanitizeHtml(title)}</div>` : ''}
        <div class="notification-message">${Utils.sanitizeHtml(message)}</div>
      </div>
      <button class="notification-close" onclick="Notifications.dismiss(${id})" aria-label="Close notification">×</button>
    `;

    return notification;
  },

  _getDefaultTitle: (type) => {
    const titles = {
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      info: 'Info'
    };
    return titles[type] || '';
  },

  dismiss: (id) => {
    const notification = Notifications._notifications.get(id);
    if (notification) {
      notification.classList.remove('show');
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        Notifications._notifications.delete(id);
      }, Config.TIMING.ANIMATION_DURATION);

      Logger.debug(`Notification dismissed: ${id}`);
    }
  },

  dismissAll: () => {
    Notifications._notifications.forEach((notification, id) => {
      Notifications.dismiss(id);
    });
  },

  // Convenience methods
  success: (message, options) => Notifications.show(message, 'success', options),
  error: (message, options) => Notifications.show(message, 'error', options),
  warning: (message, options) => Notifications.show(message, 'warning', options),
  info: (message, options) => Notifications.show(message, 'info', options)
};

/**
 * Form Validation Helpers
 */
window.Validation = {
  isValidWeek: (week) => {
    const w = parseInt(week);
    return !isNaN(w) && w >= Config.VALIDATION.MIN_WEEK && w <= Config.VALIDATION.MAX_WEEK;
  },

  isValidTiebreaker: (value) => {
    const v = parseInt(value);
    return !isNaN(v) && v >= Config.VALIDATION.MIN_TIEBREAKER && v <= Config.VALIDATION.MAX_TIEBREAKER;
  },

  isValidPlayer: (playerName) => {
    return Config.APP.PLAYERS.includes(playerName);
  },

  isValidGameId: (gameId) => {
    return gameId && !isNaN(parseInt(gameId));
  },

  isValidTeamName: (teamName) => {
    return teamName && teamName.length > 0 && teamName.length <= 20;
  },

  validatePickData: (data) => {
    const errors = [];

    if (!data.player || !Validation.isValidPlayer(data.player)) {
      errors.push('Invalid or missing player name');
    }

    if (!Validation.isValidWeek(data.week)) {
      errors.push('Invalid week number');
    }

    if (!Validation.isValidGameId(data.gameId)) {
      errors.push('Invalid game ID');
    }

    if (!Validation.isValidTeamName(data.teamPick)) {
      errors.push('Invalid team selection');
    }

    if (data.tiebreaker && !Validation.isValidTiebreaker(data.tiebreaker)) {
      errors.push('Invalid tiebreaker value');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

/**
 * Animation Helpers
 */
window.Animations = {
  fadeIn: (element, duration = Config.TIMING.ANIMATION_DURATION) => {
    element.style.opacity = '0';
    element.style.display = 'block';
    
    const start = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - start;
      const progress = Math.min(elapsed / duration, 1);
      
      element.style.opacity = progress;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  },

  fadeOut: (element, duration = Config.TIMING.ANIMATION_DURATION) => {
    const start = performance.now();
    const startOpacity = parseFloat(window.getComputedStyle(element).opacity);
    
    const animate = (currentTime) => {
      const elapsed = currentTime - start;
      const progress = Math.min(elapsed / duration, 1);
      
      element.style.opacity = startOpacity * (1 - progress);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.style.display = 'none';
      }
    };
    
    requestAnimationFrame(animate);
  },

  slideDown: (element, duration = Config.TIMING.ANIMATION_DURATION) => {
    element.style.height = '0px';
    element.style.overflow = 'hidden';
    element.style.display = 'block';
    
    const targetHeight = element.scrollHeight;
    const start = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - start;
      const progress = Math.min(elapsed / duration, 1);
      
      element.style.height = (targetHeight * progress) + 'px';
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.style.height = '';
        element.style.overflow = '';
      }
    };
    
    requestAnimationFrame(animate);
  }
};

// Initialize notifications on load
document.addEventListener('DOMContentLoaded', () => {
  Notifications.init();
  Logger.info('Utils and Notifications initialized');
});
