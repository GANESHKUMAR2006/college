/**
 * utils/networkService.js
 * =======================
 * Reusable portable networking service with transport abstraction, retries,
 * backoff, rate limiting, and error normalization.
 */

const axios = require('axios');
const { exec } = require('child_process');

class NetworkService {
  /**
   * Performs an HTTP request with retry logic, backoff, and transport abstraction.
   * 
   * @param {string} url - Request URL
   * @param {object} options - Request options
   * @param {string} options.method - HTTP method ('GET', 'POST', etc.)
   * @param {object} options.headers - Headers mapping
   * @param {number} options.timeout - Timeout in MS (default 15000)
   * @param {number} options.retries - Number of retries (default 3)
   * @param {number} options.backoffFactor - Multiplier for exponential backoff (default 1500)
   * @param {boolean} options.useCurlTransport - Force using CLI curl transport (for LeetCode/Cloudflare bypass)
   * @param {Function} options.onRequestAttempt - Callback invoked on each request attempt
   * @returns {Promise<any>} Response body data
   */
  static async request(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = options.headers || {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://leetcode.com/'
    };
    const timeout = options.timeout || 15000;
    const retries = options.retries !== undefined ? options.retries : 3;
    const backoffFactor = options.backoffFactor || 1500;
    const useCurlTransport = !!options.useCurlTransport;

    let lastError;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      if (options.onRequestAttempt) {
        await options.onRequestAttempt(attempt);
      }

      try {
        if (useCurlTransport) {
          return await this.fetchWithCurl(url, headers, timeout);
        } else {
          return await this.fetchWithAxios(url, method, headers, timeout);
        }
      } catch (err) {
        lastError = err;
        console.warn(`[Network] Attempt ${attempt} failed for: ${url} - ${err.message}`);

        if (attempt <= retries) {
          const delay = attempt * backoffFactor;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw this.normalizeError(lastError, url);
  }

  /**
   * Standard Axios fetch method.
   */
  static async fetchWithAxios(url, method, headers, timeout) {
    const config = {
      url,
      method,
      headers,
      timeout
    };

    const response = await axios(config);
    return response.data;
  }

  /**
   * CLI curl fetch method. Works portably across Windows, Linux, and Docker.
   */
  static fetchWithCurl(url, headers, timeout) {
    return new Promise((resolve, reject) => {
      const userAgent = headers['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      
      // Portable CLI command using standard 'curl' instead of 'curl.exe'
      const cmd = `curl -s -H "User-Agent: ${userAgent}" "${url}"`;

      exec(cmd, { maxBuffer: 30 * 1024 * 1024, timeout }, (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(`CLI curl execution failed: ${err.message}`));
        }
        try {
          const data = JSON.parse(stdout);
          resolve(data);
        } catch (parseErr) {
          reject(new Error(`Failed to parse response JSON: ${parseErr.message}. Raw output snippet: ${stdout.slice(0, 200)}`));
        }
      });
    });
  }

  /**
   * Normalizes errors into standard user-friendly formats.
   */
  static normalizeError(err, url) {
    const error = new Error(err.message || 'Request failed');
    error.url = url;
    if (err.response) {
      error.status = err.response.status;
      error.data = err.response.data;
    }
    return error;
  }
}

module.exports = NetworkService;
