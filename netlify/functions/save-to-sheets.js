// netlify/functions/save-to-sheets.js
import { GoogleSpreadsheet } from 'google-spreadsheet';

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }) 
    };
  }

  try {
    const { type, data, week } = JSON.parse(event.body);
    
    // Initialize Google Sheets (requires service account credentials)
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
    
    // This would require setting up Google Service Account credentials
    // For now, just log the data
    console.log('Would save to sheets:', { type, data, week });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Data processed successfully',
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
