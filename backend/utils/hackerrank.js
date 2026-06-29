const https = require('https');

/**
 * Helper to perform HTTPS requests
 */
function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*'
    };
    
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: { ...defaultHeaders, ...(options.headers || {}) },
      timeout: options.timeout || 10000
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (e) => {
      reject(new Error(`HTTPS fetch failed: ${e.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Scraping fallback: parse HackerRank HTML if JSON REST APIs fail
 */
function parseHackerRankHtml(html) {
  const result = {
    badges: [],
    stars: 0,
    certificates: [],
    problemsSolved: 0
  };

  // 1. Match stars
  const starsMatches = html.match(/class="star-icon[^"]*?"/g) || 
                       html.match(/star-icon/g);
  if (starsMatches) {
    result.stars = Math.min(starsMatches.length, 6);
  }

  // 2. Extract badges (approximate from HTML)
  const badgeMatch = html.match(/badge-title">([^<]+)/g);
  if (badgeMatch) {
    result.badges = badgeMatch.map(m => m.replace('badge-title">', '').trim());
  }

  // 3. Extract certificates
  const certMatch = html.match(/certificate-card-title">([^<]+)/g);
  if (certMatch) {
    result.certificates = certMatch.map(m => m.replace('certificate-card-title">', '').trim());
  }

  // 4. Solved count
  const solvedMatch = html.match(/solved\s*(\d+)\s*challenges/i) || 
                      html.match(/challenges\s*solved\s*(\d+)/i) ||
                      html.match(/(\d+)\s*challenges?\s*solved/i);
  if (solvedMatch) {
    result.problemsSolved = parseInt(solvedMatch[1], 10);
  }

  return result;
}

/**
 * Verifies if a HackerRank username exists
 * @param {string} username - HackerRank username
 * @returns {Promise<{exists: boolean, username?: string, error?: string}>}
 */
async function verifyHackerRankUsername(username) {
  if (!username || typeof username !== 'string') {
    return { exists: false, error: 'Invalid username' };
  }

  const trimmedUsername = username.trim();
  if (trimmedUsername === '') {
    return { exists: false, error: 'Username cannot be empty' };
  }

  try {
    // Query profile info endpoint
    const url = `https://www.hackerrank.com/rest/contests/master/hackers/${encodeURIComponent(trimmedUsername)}/profile`;
    const response = await fetchUrl(url, { timeout: 6000 });
    
    if (response.statusCode === 200) {
      const json = JSON.parse(response.data);
      if (json.model) {
        return {
          exists: true,
          username: json.model.username || trimmedUsername
        };
      }
    } else if (response.statusCode === 404) {
      return { exists: false, error: 'HackerRank username not found' };
    }
  } catch (err) {
    console.warn(`[HackerRank API Alert] REST profile endpoint failed for ${trimmedUsername}:`, err.message);
  }

  // Fallback check on HTML profile page
  try {
    const htmlUrl = `https://www.hackerrank.com/profile/${encodeURIComponent(trimmedUsername)}`;
    const response = await fetchUrl(htmlUrl);
    if (response.statusCode === 200) {
      if (response.data.includes(trimmedUsername) || response.data.includes('profile-heading')) {
        return {
          exists: true,
          username: trimmedUsername
        };
      }
      return { exists: false, error: 'Profile exists but page format unrecognized' };
    } else if (response.statusCode === 404) {
      return { exists: false, error: 'HackerRank username not found' };
    } else {
      return { exists: false, error: `HackerRank returned HTTP status ${response.statusCode}` };
    }
  } catch (err) {
    return { exists: false, error: `Network error connecting to HackerRank: ${err.message}` };
  }
}

/**
 * Fetches HackerRank user statistics
 * @param {string} username - HackerRank username
 * @returns {Promise<object>}
 */
async function getUserHackerRankStats(username) {
  if (!username) {
    return { success: false, error: 'Invalid username' };
  }
  const trimmedUsername = username.trim();

  let badges = [];
  let stars = 0;
  let certificates = [];
  let problemsSolved = 0;
  let hasValidData = false;

  // 1. Try to fetch from badges endpoint
  try {
    const badgesUrl = `https://www.hackerrank.com/rest/hackers/${encodeURIComponent(trimmedUsername)}/badges`;
    const response = await fetchUrl(badgesUrl, { timeout: 6000 });
    if (response.statusCode === 200) {
      const json = JSON.parse(response.data);
      if (json.models) {
        hasValidData = true;
        json.models.forEach(model => {
          badges.push(model.badge_name);
          if (model.stars > stars) {
            stars = model.stars;
          }
          problemsSolved += model.solved || 0;
        });
      }
    }
  } catch (err) {
    console.warn(`[HackerRank Stats] Badges endpoint failed for ${trimmedUsername}:`, err.message);
  }

  // 2. Try to fetch from profile endpoint
  try {
    const profileUrl = `https://www.hackerrank.com/rest/contests/master/hackers/${encodeURIComponent(trimmedUsername)}/profile`;
    const response = await fetchUrl(profileUrl, { timeout: 6000 });
    if (response.statusCode === 200) {
      const json = JSON.parse(response.data);
      if (json.model) {
        hasValidData = true;
        problemsSolved = Math.max(problemsSolved, json.model.challenges_solved || 0);
        // Extract certifications/certificates if available
        if (json.model.certifications) {
          certificates = json.model.certifications.map(c => c.certification_name || c.name);
        }
      }
    }
  } catch (err) {
    console.warn(`[HackerRank Stats] Profile endpoint failed for ${trimmedUsername}:`, err.message);
  }

  if (hasValidData) {
    return {
      success: true,
      username: trimmedUsername,
      badges: badges,
      stars: stars,
      certificates: certificates,
      problemsSolved: problemsSolved
    };
  }

  // Fallback to scraping
  try {
    const htmlUrl = `https://www.hackerrank.com/profile/${encodeURIComponent(trimmedUsername)}`;
    const response = await fetchUrl(htmlUrl);
    if (response.statusCode === 200) {
      const parsed = parseHackerRankHtml(response.data);
      return {
        success: true,
        username: trimmedUsername,
        badges: parsed.badges,
        stars: parsed.stars,
        certificates: parsed.certificates,
        problemsSolved: parsed.problemsSolved
      };
    } else {
      return { success: false, error: `HackerRank profile HTML returned status ${response.statusCode}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  verifyHackerRankUsername,
  getUserHackerRankStats
};
