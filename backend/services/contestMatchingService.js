const db = require('../config/db');
const auditLog = require('./auditLogService');

/**
 * Weighted matching algorithm for contests.
 * Compare: Slug, Name, Number, Type, Date, Start Time.
 * Returns confidence score (0-100).
 */
function calculateConfidence(entry, master) {
  let score = 0;
  
  // 1. Slug Match (Max 40 points)
  const entrySlug = (entry.contestSlug || entry.contest?.titleSlug || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const masterSlug = (master.slug || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  if (entrySlug && masterSlug) {
    if (entrySlug === masterSlug) {
      score += 40;
    } else if (entrySlug.includes(masterSlug) || masterSlug.includes(entrySlug)) {
      score += 25;
    }
  }

  // 2. Name Match (Max 30 points)
  const entryName = (entry.contestName || entry.contest?.title || '').trim().toLowerCase();
  const masterName = (master.title || master.contest_name || '').trim().toLowerCase();
  if (entryName && masterName) {
    if (entryName === masterName) {
      score += 30;
    } else if (entryName.includes(masterName) || masterName.includes(entryName)) {
      score += 15;
    }
  }

  // 3. Number and Type Match (Max 15 points)
  const entryType = (entry.contestType || (entrySlug.includes('biweekly') ? 'Biweekly' : 'Weekly')).toLowerCase();
  const masterType = (master.contest_type || '').toLowerCase();
  
  const entryNumMatch = entrySlug.match(/contest-(\d+)/) || entryName.match(/contest\s+(\d+)/);
  const entryNum = entryNumMatch ? parseInt(entryNumMatch[1], 10) : 0;
  const masterNum = master.contest_number || 0;
  
  if (entryType === masterType && entryNum === masterNum && entryNum > 0) {
    score += 15;
  }

  // 4. Date and Start Time Match (Max 15 points)
  // Timezone differences might cause shift, so check difference in hours
  const entryTime = entry.contestDate 
    ? new Date(entry.contestDate).getTime() 
    : (entry.contest?.startTime ? entry.contest.startTime * 1000 : null);
  const masterTime = master.start_time ? new Date(master.start_time).getTime() : null;
  if (entryTime && masterTime) {
    const diffHours = Math.abs(entryTime - masterTime) / (1000 * 60 * 60);
    if (diffHours < 2) {
      score += 15;
    } else if (diffHours < 24) {
      score += 8;
    }
  }

  return score;
}

/**
 * Attempt to match a fetched contest history entry against database master contests.
 */
async function matchContest(studentId, platform, entry, masterContests) {
  let bestMatch = null;
  let maxScore = 0;

  for (const master of masterContests) {
    const score = calculateConfidence(entry, master);
    if (score > maxScore) {
      maxScore = score;
      bestMatch = master;
    }
  }

  if (maxScore >= 70) {
    return { match: bestMatch, confidence: maxScore, ambiguous: false };
  } else if (maxScore >= 40 && bestMatch) {
    // Ambiguous match - log for review
    const fetchedName = entry.contestName || entry.contest?.title || 'Unknown Contest';
    console.log(`[Matching] Ambiguous contest match found for Student ${studentId}: "${fetchedName}" matches "${bestMatch.title}" with score ${maxScore}`);
    
    // Save to AmbiguousContestMatches table
    try {
      await db.query(
        `INSERT IGNORE INTO AmbiguousContestMatches (student_id, fetched_contest_name, matched_contest_id, confidence_score, status)
         VALUES (?, ?, ?, ?, 'PENDING')`,
        [studentId, fetchedName.substring(0, 255), bestMatch.contest_id, maxScore]
      );
      
      await auditLog.log(auditLog.AUDIT_ACTIONS.CONTEST_UPDATED, {
        severity: 'WARNING',
        targetType: 'contest',
        targetId: bestMatch.contest_id,
        details: {
          message: 'Ambiguous contest match detected',
          studentId,
          fetchedName,
          confidenceScore: maxScore
        }
      });
    } catch (e) {
      console.warn('[Matching] Failed to log ambiguous match:', e.message);
    }
    
    return { match: bestMatch, confidence: maxScore, ambiguous: true };
  }

  return null;
}

module.exports = {
  matchContest
};
