import React from 'react';

/**
 * Registry describing every supported competitive programming platform.
 * Components are lazy-loaded via React.lazy to reduce bundle size and loading overhead.
 */
export const platformRegistry = [
  {
    id: 'leetcode',
    title: 'LeetCode',
    component: React.lazy(() => import('./LeetCodeProgress'))
  },
  {
    id: 'codechef',
    title: 'CodeChef',
    component: React.lazy(() => import('./CodeChefProgress'))
  },
  {
    id: 'codeforces',
    title: 'Codeforces',
    component: React.lazy(() => import('./CodeforcesProgress'))
  },
  {
    id: 'hackerrank',
    title: 'HackerRank',
    component: React.lazy(() => import('./HackerRankProgress'))
  }
];
