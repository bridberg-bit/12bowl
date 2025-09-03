/**
 * 12Bowl NFL Pick'em App - UI Module
 * Handles all user interface updates and interactions
 */

window.UI = {
  /**
   * Generate week navigation buttons
   */
  generateWeekButtons: () => {
    const weekSelector = document.getElementById('weekSelector');
    if (!weekSelector) return;

    weekSelector.innerHTML = '';
    
    for (let i = 1; i <= Config.APP.MAX_WEEKS; i++) {
      const btn = document.createElement('button');
      btn.className = `week-btn ${i === App.currentWeek ? 'active' : ''}`;
      btn.dataset.week = i;
      btn.textContent = `Week ${i}`;
      btn.setAttribute('aria-label', `Select Week ${i}`);
      
      btn.addEventListener('click', function() {
        if (App.isLoading) return;
        
        const newWeek = parseInt(this.dataset.week);
        if (newWeek !== App.currentWeek) {
          App.changeWeek(newWeek);
        }
      });
      
      weekSelector.appendChild(btn);
    }

    Logger.debug('Week buttons generated');
  },

  /**
   * Update active week button
   */
  updateActiveWeekButton: () => {
    document.querySelectorAll('.week-btn').forEach(btn => {
      btn.classList.remove('active');
      if (parseInt(btn.dataset.week) === App.currentWeek) {
        btn.classList.add('active');
      }
    });

    // Update navigation button states
    const prevBtn = document.getElementById('prevWeek');
    const nextBtn = document.getElementById('nextWeek');
    
    if (prevBtn) {
      prevBtn.disabled = App.currentWeek <= 1;
    }
    
    if (nextBtn) {
      nextBtn.disabled = App.currentWeek >= Config.APP.MAX_WEEKS;
    }

    Logger.debug(`Active week button updated to ${App.currentWeek}`);
  },

  /**
   * Display games for current week
   */
  displayGames: (games) => {
    const container = document.getElementById('gamesContainer');
    if (!container || !games || games.length === 0) {
      UI.showEmptyState('No games available for this week yet.');
      return;
    }

    // Group games by day
    const gamesByDay = Utils.array.groupBy(games, 'day');
    
    let html = '';
    
    Object.keys(gamesByDay).forEach(day => {
      html += `
        <div class="game-day">
          <div class="day-header">${Utils.sanitizeHtml(day)}</div>
      `;
      
      gamesByDay[day].forEach(game => {
        html += UI._createGameCardHTML(game);
      });
      
      html += '</div>';
    });
    
    container.innerHTML = html;
    Logger.debug(`Displayed ${games.length} games`);
  },

  /**
   * Create HTML for a single game card
   */
  _createGameCardHTML: (game) => {
    const playerKey = `${App.currentPlayer}_week${App.currentWeek}`;
    const savedPick = App.picks[playerKey]?.games?.[game.id] || null;
    
    // Determine card styling based on game completion and pick correctness
    let cardClasses = 'game-card';
    if (game.completed) {
      cardClasses += ' completed';
      if (savedPick) {
        if (savedPick === game.winner) {
          cardClasses += ' correct-pick';
        } else {
          cardClasses += ' wrong-pick';
        }
      }
    }
    
    // Game score display
    const scoreDisplay = game.completed && game.awayScore !== null && game.homeScore !== null 
      ? `<div class="game-score">Final: ${game.awayTeam} ${game.awayScore} - ${game.homeTeam} ${game.homeScore}</div>`
      : '';
    
    // MNF badge
    const mnfBadge = game.isMNF 
      ? '<div class="mnf-badge">Monday Night Football</div>'
      : '';
    
    return `
      <div class="${cardClasses}" data-game-id="${game.id}">
        <div class="game-info">
          <div class="matchup">${Utils.sanitizeHtml(game.awayTeam)} @ ${Utils.sanitizeHtml(game.homeTeam)}</div>
          <div class="game-time">${Utils.sanitizeHtml(game.time)}</div>
          <div class="over-under">Over/Under: ${game.overUnder}</div>
          ${scoreDisplay}
          ${mnfBadge}
        </div>
        <div class="pick-section">
          <button class="team-btn ${savedPick === game.awayTeam ? 'selected' : ''} ${UI._getTeamButtonClass(game, game.awayTeam)}" 
                  onclick="makePick(${game.id}, '${game.awayTeam}')" 
                  ${game.completed ? 'disabled' : ''}
                  aria-label="Pick ${game.awayTeam}">
            <span>${Utils.sanitizeHtml(game.awayTeam)}</span>
          </button>
          <button class="team-btn ${savedPick === game.homeTeam ? 'selected' : ''} ${UI._getTeamButtonClass(game, game.homeTeam)}" 
                  onclick="makePick(${game.id}, '${game.homeTeam}')"
                  ${game.completed ? 'disabled' : ''}
                  aria-label="Pick ${game.homeTeam}">
            <span>${Utils.sanitizeHtml(game.homeTeam)}</span>
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Get CSS class for team button based on game state
   */
  _getTeamButtonClass: (game, team) => {
    if (!game.completed) return '';
    
    if (game.winner === team) {
      return 'winning-team';
    } else {
      return 'losing-team';
    }
  },

  /**
   * Update game pick UI after selection
   */
  updateGamePickUI: (gameId, team) => {
    const gameCard = document.querySelector(`[data-game-id="${gameId}"]`);
    if (!gameCard) return;

    // Remove selected class from all buttons in this game
    const buttons = gameCard.querySelectorAll('.team-btn');
    buttons.forEach(btn => btn.classList.remove('selected'));
    
    // Add selected class to clicked button
    const selectedBtn = Array.from(buttons).find(btn => 
      btn.querySelector('span').textContent.trim() === team
    );
    
    if (selectedBtn) {
      selectedBtn.classList.add('selected');
    }
    
    // Add visual feedback
    gameCard.classList.add('selected');
    setTimeout(() => gameCard.classList.remove('selected'), 1000);

    Logger.debug(`Updated UI for game ${gameId}, team ${team}`);
  },

  /**
   * Show loading state for games
   */
  showGamesLoading: () => {
    const container = document.getElementById('gamesContainer');
    if (container) {
      container.innerHTML = `
        <div class="loading-state">
          <div class="loading-state-spinner"></div>
          <div class="loading-state-text">Loading NFL games...</div>
          <div class="loading-state-subtext">Getting the latest matchups for this week</div>
        </div>
      `;
    }
  },

  /**
   * Show empty state
   */
  showEmptyState: (message) => {
    const container = document.getElementById('gamesContainer');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🏈</div>
          <div class="empty-state-title">No Games Available</div>
          <div class="empty-state-message">${Utils.sanitizeHtml(message)}</div>
          <button class="empty-state-action" onclick="window.location.reload()">
            Refresh Page
          </button>
        </div>
      `;
    }
  },

  /**
   * Show error state
   */
  showErrorState: (title, message) => {
    const container = document.getElementById('gamesContainer');
    if (container) {
      container.innerHTML = `
        <div class="error-state">
          <span class="error-icon">⚠️</span>
          <div class="error-title">${Utils.sanitizeHtml(title)}</div>
          <div class="error-message">${Utils.sanitizeHtml(message)}</div>
          <div class="error-actions">
            <button class="error-btn" onclick="window.location.reload()">Reload Page</button>
            <button class="error-btn" onclick="adminControls.toggleOnlineMode()">Try Offline Mode</button>
          </div>
        </div>
      `;
    }
  },

  /**
   * Update player selection UI
   */
  updatePlayerSelection: () => {
    const select = document.getElementById('playerSelect');
    const saveBtn = document.getElementById('saveBtn');
    
    if (App.currentPlayer) {
      select.classList.add('has-selection');
      if (saveBtn) {
        saveBtn.style.display = 'block';
        saveBtn.disabled = false;
      }
    } else {
      select.classList.remove('has-selection');
      if (saveBtn) {
        saveBtn.style.display = 'none';
      }
    }
  },

  /**
   * Set save button loading state
   */
  setSaveButtonLoading: (loading) => {
    const saveBtn = document.getElementById('saveBtn');
    const spinner = saveBtn?.querySelector('.btn-spinner');
    const content = saveBtn?.querySelector('.btn-content');
    
    if (!saveBtn) return;

    if (loading) {
      saveBtn.classList.add('loading');
      saveBtn.disabled = true;
      if (spinner) spinner.classList.remove('hidden');
      if (content) content.style.opacity = '0';
    } else {
      saveBtn.classList.remove('loading');
      saveBtn.disabled = false;
      if (spinner) spinner.classList.add('hidden');
      if (content) content.style.opacity = '1';
    }
  },

  /**
   * Update weekly standings display
   */
  updateWeeklyStandings: () => {
    const container = document.getElementById('weeklyStandings');
    if (!container) return;

    let html = '';
    
    // Calculate weekly winners from picks and game results
    const weeklyWinners = UI._calculateWeeklyWinners();
    
    if (Object.keys(weeklyWinners).length === 0) {
      html = `
        <div class="standings-row">
          <span class="position">No completed weeks yet</span>
          <span class="score">—</span>
        </div>
      `;
    } else {
      Object.keys(weeklyWinners).forEach(week => {
        const winner = weeklyWinners[week];
        const isCurrentWeek = parseInt(week) === App.currentWeek;
        
        html += `
          <div class="standings-row ${isCurrentWeek ? 'winner' : ''}">
            <span class="position">Week ${week}</span>
            <span class="score">${Utils.sanitizeHtml(winner.player)} (${winner.score})</span>
          </div>
        `;
      });
    }
    
    container.innerHTML = html;
    Logger.debug('Weekly standings updated');
  },

  /**
   * Calculate weekly winners (placeholder - would use real game results)
   */
  _calculateWeeklyWinners: () => {
    // Sample weekly winners (in a real app, this would be calculated from actual game results)
    const sampleWeeklyWinners = {
      1: { player: App.players[2] || 'Player 3', score: '12/15' },
      2: { player: App.players[0] || 'Player 1', score: '11/16' },
      3: { player: App.players[4] || 'Player 5', score: '13/14' }
    };
    
    // Filter to only show weeks that have games
    const validWeeks = {};
    Object.keys(sampleWeeklyWinners).forEach(week => {
      if (parseInt(week) < App.currentWeek) {
        validWeeks[week] = sampleWeeklyWinners[week];
      }
    });
    
    return validWeeks;
  },

  /**
   * Update season standings display
   */
  updateSeasonStandings: () => {
    const container = document.getElementById('seasonStandings');
    if (!container) return;

    let html = '';
    
    // Use standings from app state
    const standings = Array.isArray(App.standings.season) 
      ? App.standings.season 
      : Object.keys(App.standings.season).map(player => ({
          player,
          wins: App.standings.season[player] || 0,
          totalGames: 25,
          percentage: '0.000'
        }));
    
    if (standings.length === 0) {
      html = `
        <div class="standings-row">
          <span class="position">Loading standings...</span>
          <span class="score">—</span>
        </div>
      `;
    } else {
      // Sort by wins descending
      const sortedStandings = standings.sort((a, b) => (b.wins || 0) - (a.wins || 0));
      
      sortedStandings.forEach((standing, index) => {
        html += `
          <div class="standings-row ${index === 0 ? 'winner' : ''}">
            <span class="position">${index + 1}. ${Utils.sanitizeHtml(standing.player)}</span>
            <span class="score">${standing.wins || 0} wins</span>
          </div>
        `;
      });
    }
    
    container.innerHTML = html;
    Logger.debug('Season standings updated');
  },

  /**
   * Show/hide tiebreaker section
   */
  toggleTiebreaker: (show) => {
    const section = document.getElementById('tiebreakerSection');
    if (section) {
      section.classList.toggle('hidden', !show);
    }
  },

  /**
   * Scroll to active week button
   */
  scrollToActiveWeek: () => {
    const activeBtn = document.querySelector('.week-btn.active');
    const container = document.getElementById('weekSelector');
    
    if (activeBtn && container) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      
      if (btnRect.left < containerRect.left || btnRect.right > containerRect.right) {
        activeBtn.scrollIntoView({ 
          behavior: 'smooth', 
          inline: 'center',
          block: 'nearest'
        });
      }
    }
  },

  /**
   * Update responsive design classes
   */
  updateResponsiveClasses: () => {
    const body = document.body;
    const deviceType = Utils.getDeviceType();
    
    body.classList.remove('mobile', 'tablet', 'desktop');
    body.classList.add(deviceType);
    
    Logger.debug(`Updated device class: ${deviceType}`);
  },

  /**
   * Handle window resize
   */
  handleResize: Utils.throttle(() => {
    UI.updateResponsiveClasses();
    UI.scrollToActiveWeek();
  }, 250)
};

// Set up window resize listener
window.addEventListener('resize', UI.handleResize);

// Initialize responsive classes
document.addEventListener('DOMContentLoaded', () => {
  UI.updateResponsiveClasses();
  Logger.info('UI module loaded');
});
