const { google } = require('googleapis');

exports.handler = async (event, context) => {
    console.log('=== 12Bowl Function Called ===');
    console.log('Method:', event.httpMethod);
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        console.log('CORS preflight handled');
        return { statusCode: 200, headers, body: '' };
    }

    try {
        console.log('Checking environment variables...');
        
        // Environment variables
        const SHEET_ID = process.env.SHEET_ID;
        const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

        console.log('Environment status:', {
            hasSheetId: !!SHEET_ID,
            hasEmail: !!SERVICE_EMAIL,
            hasKey: !!PRIVATE_KEY,
            sheetIdLength: SHEET_ID ? SHEET_ID.length : 0
        });

        if (!SHEET_ID || !SERVICE_EMAIL || !PRIVATE_KEY) {
            console.error('Missing environment variables');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Missing environment variables',
                    has: {
                        sheetId: !!SHEET_ID,
                        email: !!SERVICE_EMAIL,
                        key: !!PRIVATE_KEY
                    }
                })
            };
        }

        // Parse request
        let body = {};
        if (event.body) {
            try {
                body = JSON.parse(event.body);
                console.log('Request body:', body);
            } catch (e) {
                console.error('JSON parse error:', e);
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid JSON' })
                };
            }
        }

        const { action, data } = body;
        console.log('Action requested:', action);

        // Setup Google Sheets
        console.log('Setting up Google Sheets auth...');
        const auth = new google.auth.JWT(
            SERVICE_EMAIL,
            null,
            PRIVATE_KEY,
            ['https://www.googleapis.com/auth/spreadsheets']
        );

        const sheets = google.sheets({ version: 'v4', auth });
        console.log('Google Sheets client created');

        // Handle different actions
        let result = {};
        
        switch (action) {
            case 'getCurrentWeek':
                console.log('Getting current week');
                result = { currentWeek: 1, success: true, timestamp: new Date().toISOString() };
                break;
                
            case 'getPlayers':
                console.log('Getting players from sheet');
                result = await getPlayers(sheets, SHEET_ID);
                break;
                
            case 'savePick':
                console.log('Saving pick to sheet');
                result = await savePick(sheets, SHEET_ID, data);
                break;
                
            default:
                console.log('Unknown action:', action);
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: `Unknown action: ${action}`,
                        availableActions: ['getCurrentWeek', 'getPlayers', 'savePick']
                    })
                };
        }

        console.log('Action completed successfully');
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('Function error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Server error',
                message: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};

// Get players from Standings sheet
async function getPlayers(sheets, sheetId) {
    try {
        console.log('Fetching from Standings sheet, range A:A');
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Standings!A:A'
        });

        const rows = response.data.values || [];
        console.log('Raw data from sheet:', rows);
        
        // Process players (skip header row)
        const players = rows
            .slice(1)
            .filter(row => row && row[0] && row[0].trim())
            .map(row => row[0].trim());

        console.log('Processed players:', players);

        // Return fallback if no players found
        if (players.length === 0) {
            console.log('No players found, using defaults');
            return { 
                players: ['Brixon', 'Knox', 'Makena', 'Cal', 'Will', 'Jace'],
                success: true,
                source: 'fallback'
            };
        }

        return { 
            players: players,
            success: true,
            source: 'sheet',
            count: players.length
        };

    } catch (error) {
        console.error('getPlayers error:', error);
        return { 
            players: ['Brixon', 'Knox', 'Makena', 'Cal', 'Will', 'Jace'],
            success: false,
            error: error.message,
            source: 'fallback'
        };
    }
}

// Save pick to Picks sheet
async function savePick(sheets, sheetId, data) {
    try {
        console.log('savePick called with data:', data);
        
        const { player, week, gameId, teamPick, tiebreaker } = data || {};
        
        // Validate input
        if (!player || !week || !gameId || !teamPick) {
            console.error('Missing required fields:', { player, week, gameId, teamPick });
            return {
                success: false,
                error: 'Missing required fields: player, week, gameId, teamPick'
            };
        }

        console.log('Saving pick:', { player, week, gameId, teamPick, tiebreaker });

        const playerWeekKey = `${player}_Week${week}`;
        console.log('Player week key:', playerWeekKey);

        // Get existing data
        console.log('Getting existing picks data...');
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Picks!A:Z'
        });

        const rows = response.data.values || [];
        console.log(`Found ${rows.length} existing rows`);

        // Find existing row for this player/week
        let existingRowIndex = -1;
        for (let i = 1; i < rows.length; i++) {
            if (rows[i] && rows[i][0] === playerWeekKey) {
                existingRowIndex = i;
                console.log('Found existing row at index:', i);
                break;
            }
        }

        const timestamp = new Date().toISOString();
        const gameIndex = parseInt(gameId);
        const gameColumn = 2 + gameIndex - 1; // Game1 = column C (index 2)

        let result;
        
        if (existingRowIndex >= 0) {
            // Update existing row
            console.log('Updating existing row');
            
            const existingRow = [...rows[existingRowIndex]];
            
            // Ensure row has enough columns
            while (existingRow.length < 26) {
                existingRow.push('');
            }
            
            // Update the specific game pick
            existingRow[gameColumn] = teamPick;
            
            // Update tiebreaker and timestamp
            if (tiebreaker) {
                existingRow[24] = tiebreaker.toString(); // Column Y
            }
            existingRow[25] = timestamp; // Column Z

            const updateRange = `Picks!A${existingRowIndex + 1}:Z${existingRowIndex + 1}`;
            console.log('Updating range:', updateRange);
            
            await sheets.spreadsheets.values.update({
                spreadsheetId: sheetId,
                range: updateRange,
                valueInputOption: 'RAW',
                requestBody: { values: [existingRow] }
            });

            result = { success: true, method: 'updated', row: existingRowIndex + 1 };

        } else {
            // Create new row
            console.log('Creating new row');
            
            const newRow = [playerWeekKey, player]; // A, B columns
            
            // Add empty game columns (C-V)
            for (let i = 0; i < 20; i++) {
                newRow.push('');
            }
            
            // Set the specific game pick
            newRow[gameColumn] = teamPick;
            
            // Add reserved, tiebreaker, timestamp
            newRow.push(''); // W - Reserved1
            newRow.push(''); // X - Reserved2
            newRow.push(tiebreaker ? tiebreaker.toString() : ''); // Y - Tiebreaker
            newRow.push(timestamp); // Z - LastUpdated

            console.log('Appending new row with', newRow.length, 'columns');
            
            await sheets.spreadsheets.values.append({
                spreadsheetId: sheetId,
                range: 'Picks!A:Z',
                valueInputOption: 'RAW',
                requestBody: { values: [newRow] }
            });

            result = { success: true, method: 'created', row: rows.length + 1 };
        }

        console.log('Pick saved successfully:', result);
        return { ...result, timestamp };

    } catch (error) {
        console.error('savePick error:', error);
        return {
            success: false,
            error: error.message,
            details: error.stack
        };
    }
}
