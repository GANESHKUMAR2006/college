import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  TrendingUp, 
  Award, 
  Flame, 
  Calendar, 
  Building2, 
  Trophy, 
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  LineChart,
  Line,
  Cell
} from 'recharts';

function Analytics() {
  const [loading, setLoading] = useState(true);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [departmentData, setDepartmentData] = useState(null);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [error, setError] = useState('');

  // Filters state
  const [filterDept, setFilterDept] = useState('');
  const [filterSec, setFilterSec] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('overall');
  const [availableDepts, setAvailableDepts] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [availableBatches, setAvailableBatches] = useState([]);

  // Fetch initial filters (departments & batches) on mount
  useEffect(() => {
    const fetchInitialFilters = async () => {
      try {
        const [deptsRes, batchesRes] = await Promise.all([
          axios.get('/api/departments?status=active'),
          axios.get('/api/students/batches')
        ]);
        if (deptsRes.data.success) {
          setAvailableDepts(deptsRes.data.data);
        }
        if (batchesRes.data.success) {
          setAvailableBatches(batchesRes.data.data);
        }
      } catch (err) {
        console.error('Failed to load filters data in Analytics:', err);
      }
    };
    fetchInitialFilters();
  }, []);

  // Fetch available sections dynamically when department or batch filters change
  useEffect(() => {
    const fetchAvailableSections = async () => {
      try {
        const params = { status: 'active' };
        if (filterDept) params.department = filterDept;
        if (filterBatch) params.academicBatch = filterBatch;
        const res = await axios.get('/api/students/sections', { params });
        if (res.data.success) {
          const sections = res.data.data;
          setAvailableSections(sections);
          if (filterSec && !sections.includes(filterSec)) {
            setFilterSec('');
          }
        }
      } catch (err) {
        console.error('Failed to fetch sections:', err);
      }
    };
    fetchAvailableSections();
  }, [filterDept, filterBatch]);

  // Fetch analytics data when active tab or filters change
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      setLoading(true);
      try {
        const lbParams = {};
        if (filterDept) lbParams.department = filterDept;
        if (filterSec) lbParams.section = filterSec;
        if (filterBatch) lbParams.academicBatch = filterBatch;

        const [lbRes, deptRes] = await Promise.all([
          axios.get('/api/analytics/leaderboards', { params: lbParams }),
          axios.get('/api/analytics/departments')
        ]);

        if (lbRes.data.success && deptRes.data.success) {
          setLeaderboardData(lbRes.data);
          setDepartmentData(deptRes.data.departments);
          setError('');
        } else {
          setError('Failed to load analytical metrics.');
        }
      } catch (err) {
        setError('Error connecting to the server. Please ensure database is initialized.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalyticsData();
  }, [activeTab, filterDept, filterSec, filterBatch]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !leaderboardData || !departmentData) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-950/40 p-6 text-rose-600 dark:text-rose-400">
        <p className="font-semibold">Analytics system offline</p>
        <p className="text-sm mt-1">{error || 'Verify database credentials in backend/.env'}</p>
      </div>
    );
  }

  const { topPerformers, topImprovers, mostConsistent, coverageSummary } = leaderboardData;

  const filteredTopPerformers = [...(topPerformers || [])]
    .filter((student) => {
      const value = searchText.toLowerCase();
      return !value || [student.name, student.register_number, student.leetcode_username, student.codechef_username, student.codeforces_username, student.hackerrank_username]
        .filter(Boolean)
        .some((text) => String(text).toLowerCase().includes(value));
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return Number(b.current_rating || 0) - Number(a.current_rating || 0);
      if (sortBy === 'problems') return Number(b.problems_solved || 0) - Number(a.problems_solved || 0);
      if (sortBy === 'attendance') return Number(b.contests_attended || 0) - Number(a.contests_attended || 0);
      return Number(b.overall_score || 0) - Number(a.overall_score || 0);
    });

  const formatPlatformLabel = (platform) => {
    switch (platform) {
      case 'leetcode': return 'LeetCode';
      case 'codechef': return 'CodeChef';
      case 'codeforces': return 'Codeforces';
      case 'hackerrank': return 'HackerRank';
      default: return platform;
    }
  };

  // Chart Cell Colors for Departments
  const COLORS = ['#4f73ff', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Performance Analytics & Leaderboard</h1>
        <p className="text-sm text-slate-400">In-depth statistical insights and performance charts.</p>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button 
          onClick={() => setActiveTab('leaderboard')}
          className={`pb-3 text-sm font-semibold transition-all ${
            activeTab === 'leaderboard' 
              ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400' 
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Leaderboards & Consistency
        </button>
        <button 
          onClick={() => setActiveTab('departments')}
          className={`pb-3 text-sm font-semibold transition-all ${
            activeTab === 'departments' 
              ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400' 
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Department Performance Comparisons
        </button>
      </div>

      {activeTab === 'leaderboard' ? (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-4 shadow-sm">
            {/* Search */}
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search by name or handle"
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-3 py-2.5 text-xs outline-none focus:border-primary-500 dark:text-slate-200"
            />

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-3 py-2.5 text-xs outline-none focus:border-primary-500 dark:text-slate-200"
            >
              <option value="overall">Sort by overall score</option>
              <option value="rating">Sort by current rating</option>
              <option value="problems">Sort by problems solved</option>
              <option value="attendance">Sort by contests attended</option>
            </select>

            {/* Dept filter */}
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-3 py-2.5 text-xs outline-none focus:border-primary-500 dark:text-slate-200"
            >
              <option value="">All Departments</option>
              {availableDepts.map(dept => (
                <option key={dept.id} value={dept.code}>{dept.code}</option>
              ))}
            </select>

            {/* Batch filter */}
            <select
              value={filterBatch}
              onChange={(e) => setFilterBatch(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-3 py-2.5 text-xs outline-none focus:border-primary-500 dark:text-slate-200"
            >
              <option value="">All Academic Batches</option>
              {availableBatches.map(batch => (
                <option key={batch} value={batch}>{batch}</option>
              ))}
            </select>

            {/* Section filter */}
            <select
              value={filterSec}
              onChange={(e) => setFilterSec(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-3 py-2.5 text-xs outline-none focus:border-primary-500 dark:text-slate-200"
            >
              <option value="">All Sections</option>
              {availableSections.map(sec => (
                <option key={sec} value={sec}>Section {sec}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-3 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-gradient-to-br from-primary-50/80 to-white dark:from-primary-950/30 dark:to-slate-900 p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">Unified competitive programming overview</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Students are ranked by contest performance while also showing their connected platforms.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-primary-200 bg-white/80 px-3 py-1 font-semibold text-primary-700 dark:border-primary-900/50 dark:bg-slate-900/70 dark:text-primary-400">
                    {coverageSummary?.multiPlatformProfiles || 0} multi-platform profiles
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                    Avg. {coverageSummary?.averagePlatformCount || '0.0'} platforms per student
                  </span>
                </div>
              </div>
            </div>

          {/* Top Performers Leaderboard */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Trophy className="h-5 w-5 text-amber-500" />
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white">Top Performers Leaderboard</h3>
                <p className="text-xs text-slate-400">Ranked by contest strength and platform coverage.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2.5">Rank</th>
                    <th>Name / Roll</th>
                    <th>Department</th>
                    <th className="text-center">Attended</th>
                    <th className="text-right">Current Rating</th>
                    <th className="text-right">Best Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                  {filteredTopPerformers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-slate-400">No participation records yet. Sync data to begin.</td>
                    </tr>
                  ) : (
                    filteredTopPerformers.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="py-3 font-extrabold text-slate-400">
                          {idx === 0 ? '🏆 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                        </td>
                        <td>
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">{p.name}</span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wide">{p.register_number} • {p.leetcode_username || 'No LeetCode handle'}</span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {p.platforms?.length ? p.platforms.map((platform) => (
                              <span key={`${p.id}-${platform.platform}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {formatPlatformLabel(platform.platform)}
                              </span>
                            )) : (
                              <span className="text-[10px] text-slate-400">LeetCode-only profile</span>
                            )}
                          </div>
                        </td>
                        <td className="text-slate-500">{p.department}</td>
                        <td className="text-center font-semibold text-slate-600 dark:text-slate-300">{p.contests_attended}</td>
                        <td className="text-right font-extrabold text-primary-600 dark:text-primary-400">{p.current_rating}</td>
                        <td className="text-right font-semibold text-slate-500">{p.best_rating}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            {/* Top Improvers */}
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Flame className="h-5 w-5 text-rose-500 animate-pulse" />
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">Top Rating Improvers</h3>
                  <p className="text-xs text-slate-400">Highest net rating gains.</p>
                </div>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {topImprovers.length === 0 ? (
                  <p className="text-center py-6 text-slate-400 text-xs">No rating gains recorded yet.</p>
                ) : (
                  topImprovers.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 block">{item.name}</span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">{item.department}</span>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-extrabold">
                          <ArrowUpRight className="h-3.5 w-3.5" /> +{item.rating_gain}
                        </span>
                        <span className="text-[10px] text-slate-400 block">{item.initial_rating} → {item.current_rating}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Most Consistent */}
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Calendar className="h-5 w-5 text-indigo-500" />
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">Most Consistent</h3>
                  <p className="text-xs text-slate-400">Highest attendance rates.</p>
                </div>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {mostConsistent.length === 0 ? (
                  <p className="text-center py-6 text-slate-400 text-xs">No consistency data yet.</p>
                ) : (
                  mostConsistent.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 block">{item.name}</span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">{item.register_number} • {item.department}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-indigo-600 dark:text-indigo-400 block">{item.attendance_percentage}%</span>
                        <span className="text-[10px] text-slate-400">{item.present_count} / {item.total_contests} Contests</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Average Ratings Chart */}
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-1.5">
                <Building2 className="h-4.5 w-4.5 text-primary-500" /> Average Competitive Programming Rating by Department
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200, 200, 200, 0.15)" />
                    <XAxis dataKey="department" tick={{ fontSize: 9 }} stroke="rgba(150, 150, 150, 0.7)" />
                    <YAxis domain={[1000, 'auto']} tick={{ fontSize: 10 }} stroke="rgba(150, 150, 150, 0.7)" />
                    <RechartsTooltip />
                    <Bar dataKey="average_rating" name="Avg Rating" radius={[6, 6, 0, 0]}>
                      {departmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Problems Solved Chart */}
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-1.5">
                <Sparkles className="h-4.5 w-4.5 text-indigo-500" /> Average Problems Solved Per Contest
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200, 200, 200, 0.15)" />
                    <XAxis dataKey="department" tick={{ fontSize: 9 }} stroke="rgba(150, 150, 150, 0.7)" />
                    <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} tick={{ fontSize: 10 }} stroke="rgba(150, 150, 150, 0.7)" />
                    <RechartsTooltip />
                    <Bar dataKey="average_problems_solved" name="Avg Problems Solved" radius={[6, 6, 0, 0]}>
                      {departmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Department Analytics Table */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
              Comparative Metrics Summary
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2.5">Department</th>
                    <th className="text-center">Total Students</th>
                    <th className="text-center">Attendance %</th>
                    <th className="text-right">Avg Rating</th>
                    <th className="text-right">Peak Rating</th>
                    <th className="text-right">Avg Problems Solved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                  {departmentData.map((d, index) => (
                    <tr key={d.department} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="py-3.5 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                        {d.department}
                      </td>
                      <td className="text-center font-medium text-slate-600 dark:text-slate-300">{d.total_students}</td>
                      <td className="text-center font-bold text-primary-600 dark:text-primary-400">{d.attendance_percentage}%</td>
                      <td className="text-right font-semibold text-slate-700 dark:text-slate-300">{d.average_rating}</td>
                      <td className="text-right font-bold text-indigo-600 dark:text-indigo-400">{d.peak_rating}</td>
                      <td className="text-right font-medium text-slate-600 dark:text-slate-300">{d.average_problems_solved} / 4</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Analytics;
