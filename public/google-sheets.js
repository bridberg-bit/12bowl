// Simple Google Sheets integration using public methods
class GoogleSheetsManager {
  constructor(sheetId) {
    this.sheetId = sheetId;
    this.isEnabled = sheetId && sheetId !== 'YOUR_SHEET_ID_HERE';
  }

  // Initialize (check if sheet is accessible)
  async init() {
    if (!this.isEnabled) {
      console.log('Google Sheets not configured');
      return false;
    }
    
    try {
      // Test if we can access the sheet
      const testUrl = `https://docs.google.com/spreadsheets/d/${this.sheetId}/export?format=csv&gid=0`;
      const response = await fetch(testUrl, { mode: 'no-cors' });
      console.log('Google Sheets connection test completed');
      return true;
    } catch (error) {
      console.warn('Google Sheets connection failed:', error);
      return false;
    }
  }

  // Save data (for now, just log it and save locally for manual export)
  async saveData(type, data) {
    if (!this.isEnabled) return;
    
    const exportData = {
      timestamp: new Date().toISOString(),
      type: type,
      data: data
    };
    
    // Save to localStorage for manual export
    localStorage.setItem(`export-${type}-${Date.now()}`, JSON.stringify(exportData));
    
    console.log(`📊 Data ready for Google Sheets (${type}):`, exportData);
    return true;
  }

  // Load data (placeholder for future implementation)
  async loadData(type, week) {
    if (!this.isEnabled) return null;
    
    // For now, return null (use localStorage)
    return null;
  }
}

// Global functions
window.initializeGoogleSheets = async (sheetId) => {
  window.googleSheetsManager = new GoogleSheetsManager(sheetId);
  return await window.googleSheetsManager.init();
};

window.saveToGoogleSheets = async (type, data) => {
  if (window.googleSheetsManager) {
    return await window.googleSheetsManager.saveData(type, data);
  }
  return false;
};

window.loadFromGoogleSheets = async (type, week) => {
  if (window.googleSheetsManager) {
    return await window.googleSheetsManager.loadData(type, week);
  }
  return null;
};
