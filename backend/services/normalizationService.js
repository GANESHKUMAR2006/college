function createBasePlatformProfile(platform, username, overrides = {}) {
  return {
    platform,
    username: username || null,
    verified: false,
    status: overrides.status || 'unavailable',
    message: overrides.message || null,
    rating: null,
    maxRating: null,
    problemsSolved: 0,
    contests: 0,
    rank: null,
    badges: [],
    submissions: [],
    lastUpdated: new Date().toISOString(),
    metadata: overrides.metadata || {}
  };
}

function normalizeLeetCodeProfile(result, username) {
  const profile = createBasePlatformProfile('leetcode', username, {
    status: result?.verified ? 'verified' : 'unavailable',
    message: result?.message || null
  });

  if (result?.success || result?.verified) {
    profile.verified = true;
    profile.rating = result.contestRating || result.rating || null;
    profile.maxRating = result.maxRating || result.contestRating || result.rating || null;
    profile.problemsSolved = result.totalSolved || result.problemsSolved || 0;
    profile.contests = result.contestParticipationCount || 0;
    profile.rank = result.globalRanking || null;
    profile.submissions = result.submissions || [];
    profile.metadata = {
      activeDays: result.activeDays || 0,
      easySolved: result.easySolved || 0,
      mediumSolved: result.mediumSolved || 0,
      hardSolved: result.hardSolved || 0
    };
  }

  return profile;
}

function normalizeCodeChefProfile(result, username) {
  const profile = createBasePlatformProfile('codechef', username, {
    status: result?.verified ? 'verified' : 'unavailable',
    message: result?.message || null
  });

  if (result?.success || result?.verified) {
    profile.verified = true;
    profile.rating = result.rating || null;
    profile.maxRating = result.maxRating || result.rating || null;
    profile.problemsSolved = result.problemsSolved || 0;
    profile.contests = result.contestParticipationCount || 0;
    profile.rank = result.globalRanking || null;
    profile.countryRank = result.countryRank || null;

    let calculatedStars = result.stars;
    if (!calculatedStars && result.rating) {
      const r = Number(result.rating);
      if (r < 1400) calculatedStars = '1★';
      else if (r < 1600) calculatedStars = '2★';
      else if (r < 1800) calculatedStars = '3★';
      else if (r < 2000) calculatedStars = '4★';
      else if (r < 2200) calculatedStars = '5★';
      else if (r < 2500) calculatedStars = '6★';
      else calculatedStars = '7★';
    }
    profile.stars = calculatedStars;
    profile.metadata = {
      stars: calculatedStars || '1★',
      contestHistory: result.contestHistory || []
    };
  }

  return profile;
}

function normalizeCodeforcesProfile(result, username) {
  const profile = createBasePlatformProfile('codeforces', username, {
    status: result?.verified ? 'verified' : 'unavailable',
    message: result?.message || null
  });

  if (result?.success || result?.verified) {
    profile.verified = true;
    profile.rating = result.rating || null;
    profile.maxRating = result.maxRating || result.rating || null;
    profile.problemsSolved = result.problemsSolved || 0;
    profile.contests = result.contestParticipationCount || 0;
    profile.rank = result.rank || null;
    profile.metadata = {
      maxRank: result.maxRank || null,
      contestHistory: result.contestHistory || []
    };
  }

  return profile;
}

function normalizeHackerRankProfile(result, username) {
  const profile = createBasePlatformProfile('hackerrank', username, {
    status: result?.verified ? 'verified' : 'unavailable',
    message: result?.message || null
  });

  if (result?.success || result?.verified) {
    profile.verified = true;
    profile.problemsSolved = result.problemsSolved || 0;
    profile.contests = result.contestParticipationCount || 0;
    profile.badges = Array.isArray(result.badges) ? result.badges : [];
    profile.metadata = {
      stars: result.stars || 0,
      certificates: result.certificates || []
    };
  }

  return profile;
}

module.exports = {
  createBasePlatformProfile,
  normalizeLeetCodeProfile,
  normalizeCodeChefProfile,
  normalizeCodeforcesProfile,
  normalizeHackerRankProfile
};
