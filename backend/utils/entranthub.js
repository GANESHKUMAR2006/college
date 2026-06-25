const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * Fetches contest metadata from EntrantHub.
 * Defaults to the configured ENTRANTHUB_API_URL or a hypothetical public api,
 * and falls back safely to the local mock file if the request fails or times out.
 * 
 * @returns {Promise<Array<{contest_name: string, contest_slug: string, contest_date: string, contest_status: string, contest_url: string}>>}
 */
async function fetchEntrantHubContests() {
  const url = process.env.ENTRANTHUB_API_URL || 'https://entranthub.com/api/v1/contests';
  
  console.log(`[EntrantHub] Attempting to fetch contest metadata from: ${url}`);
  
  try {
    const contests = await new Promise((resolve, reject) => {
      const req = https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`Failed to parse JSON response: ${e.message}`));
            }
          } else {
            reject(new Error(`Server returned status code: ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', reject);
      
      req.setTimeout(4000, () => {
        req.destroy();
        reject(new Error('Request timed out after 4000ms'));
      });
    });

    console.log(`[EntrantHub] Successfully fetched ${contests.length} contests from live API.`);
    return contests;
  } catch (err) {
    console.warn(`[EntrantHub] Failed to fetch from live API. Error: ${err.message}.`);
    console.log(`[EntrantHub] Falling back to local mock contests database...`);
    
    try {
      const mockPath = path.join(__dirname, 'mock_entranthub_contests.json');
      if (fs.existsSync(mockPath)) {
        const mockData = fs.readFileSync(mockPath, 'utf8');
        const contests = JSON.parse(mockData);
        console.log(`[EntrantHub Fallback] Loaded ${contests.length} contests from mock file.`);
        return contests;
      } else {
        console.error(`[EntrantHub Fallback Error] Mock file not found at ${mockPath}`);
        return [];
      }
    } catch (fallbackErr) {
      console.error(`[EntrantHub Fallback Error] Failed to read mock file:`, fallbackErr.message);
      return [];
    }
  }
}

/**
 * Fetches the participant list for a specific contest from EntrantHub.
 * Safely falls back to local mock data.
 * @param {string} contestSlug 
 * @returns {Promise<Array<string>>} List of participant usernames (lowercased)
 */
async function fetchEntrantHubParticipants(contestSlug) {
  const url = process.env.ENTRANTHUB_API_URL 
    ? `${process.env.ENTRANTHUB_API_URL}/${contestSlug}/participants`
    : `https://entranthub.com/api/v1/contests/${contestSlug}/participants`;

  try {
    const participants = await new Promise((resolve, reject) => {
      const req = https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`Failed to parse JSON: ${e.message}`));
            }
          } else {
            reject(new Error(`Status code: ${res.statusCode}`));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(4000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
    return participants.map(p => p.toLowerCase());
  } catch (err) {
    const fs = require('fs');
    const path = require('path');
    const mockPath = path.join(__dirname, 'mock_entranthub_participants.json');
    try {
      if (fs.existsSync(mockPath)) {
        const mockData = JSON.parse(fs.readFileSync(mockPath, 'utf8'));
        const list = mockData[contestSlug] || [];
        return list.map(p => p.toLowerCase());
      }
    } catch (mockErr) {
      console.error('[EntrantHub Fallback Error] Mock participants failed:', mockErr.message);
    }
    return [];
  }
}

module.exports = {
  fetchEntrantHubContests,
  fetchEntrantHubParticipants
};
