import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Users, 
  Award, 
  Percent, 
  TrendingUp, 
  AlertTriangle, 
  Crown, 
  Plus, 
  CalendarClock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [migrationHealth, setMigrationHealth] = useState(null);

  const fetchDashboardData = async () => {
    try {
      const res = await axios.get('/api/reports/dashboard-stats');
      if (res.data.success) {
        setData(res.data);
      } else {
        setError('Failed to fetch dashboard data.');
      }
    } catch (err) {
      setError('Error connecting to the server. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMigrationHealth = async () => {
    try {
      const res = await axios.get('/api/health/migrations');
      if (res.data.success && res.data.migrations.length > 0) {
        setMigrationHealth(res.data.migrations[0]);
      }
    } catch (err) {
      console.error('Failed to fetch migration health:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchMigrationHealth();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage('Fetching contest logs and scanning student histories from LeetCode...');
    try {
      const res = await axios.post('/api/contests/sync');
      if (res.data.success) {
        setSyncMessage(`Successfully synced ${res.data.contestsSynced} contests and ${res.data.studentsProcessed} students!`);
        fetchDashboardData();
        fetchMigrationHealth();
      } else {
        setSyncMessage('Synchronization failed: ' + (res.data.message || 'Unknown error'));
      }
    } catch (err) {
      setSyncMessage('Synchronization failed: ' + (err.response?.data?.message || err.message));
      console.error(err);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(''), 8000);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-950/40 p-6 text-rose-600 dark:text-rose-400">
        <p className="font-semibold">Dashboard error</p>
        <p className="text-sm mt-1">{error || 'Verify database credentials in backend/.env'}</p>
      </div>
    );
  }

  const { stats, departmentStats, weeklyTrend, topStudents, alerts } = data;

  // Chart 1: Weekly Participation Trend
  // Process data: dates or names
  const weeklyLabels = weeklyTrend.map(w => w.name);
  const weeklyPercent = weeklyTrend.map(w => {
    return w.total_students > 0 ? Math.round((w.present_count / w.total_students) * 100) : 0;
  });

  const lineChartData = {
    labels: weeklyLabels,
    datasets: [
      {
        fill: true,
        label: 'Attendance %',
        data: weeklyPercent,
        borderColor: '#4f73ff',
        backgroundColor: 'rgba(79, 115, 255, 0.1)',
        tension: 0.35,
        borderWidth: 2.5,
        pointBackgroundColor: '#4f73ff',
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `Attendance Rate: ${context.parsed.y}%`
        }
      }
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: { stepSize: 20 },
        grid: { color: 'rgba(200, 200, 200, 0.1)' }
      },
      x: {
        grid: { display: false }
      }
    }
  };

  // Chart 2: Department-wise Statistics
  const deptLabels = departmentStats.map(d => d.department);
  const deptRates = departmentStats.map(d => d.attendancePercentage);

  const barChartData = {
    labels: deptLabels,
    datasets: [
      {
        label: 'Attendance Rate',
        data: deptRates,
        backgroundColor: '#7fa0ff',
        borderRadius: 8,
        hoverBackgroundColor: '#4f73ff',
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        grid: { color: 'rgba(200, 200, 200, 0.1)' }
      },
      x: {
        grid: { display: false }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Faculty Portal & Analytics Control</h1>
          <p className="text-sm text-slate-400">Overview of student registrations, participation activity, and LeetCode performance.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleSync}
            disabled={syncing}
            className={`flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all shadow-md shadow-primary-500/10 ${
              syncing 
                ? 'bg-slate-400 cursor-not-allowed' 
                : 'bg-primary-600 hover:bg-primary-500 hover:shadow-primary-500/20'
            }`}
          >
            {syncing ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Syncing Platform...
              </>
            ) : (
              <>
                <CalendarClock className="h-4 w-4" /> Sync Platform Data
              </>
            )}
          </button>
          <Link to="/attendance" className="flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold transition-all">
            Attendance Log
          </Link>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncMessage && (
        <div className={`p-4 rounded-xl border text-xs font-semibold animate-fade-in ${
          syncMessage.includes('failed') || syncMessage.includes('Failed')
            ? 'bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400'
            : syncMessage.includes('Successfully') || syncMessage.includes('success')
            ? 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400'
            : 'bg-primary-50 border-primary-100 text-primary-600 dark:bg-primary-950/20 dark:border-primary-900/50 dark:text-primary-400'
        }`}>
          {syncMessage}
        </div>
      )}

      {/* Migration Health Warning Banner */}
      {migrationHealth && migrationHealth.status !== 'HEALTHY' && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-xs font-semibold animate-fade-in flex flex-col gap-1.5 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5 text-amber-500 animate-pulse" />
            <span className="font-bold text-sm">Migration Health Alert: Warning Status</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            The database migration <strong>{migrationHealth.migration_name}</strong> is currently in a <strong>{migrationHealth.status}</strong> state.
            There are <strong>{migrationHealth.issues_detected}</strong> orphaned logs or invalid records quarantined. 
            Foreign key integrity constraints are partially active. To resolve this, clean up the anomalous data and trigger a repair.
          </p>
          <div className="flex gap-2.5 mt-1">
            <span className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
              Action Required: run `npm run migrate`
            </span>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
        {/* Active Students Card */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Students</span>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-white">{stats.totalActiveStudents}</span>
          </div>
        </div>

        {/* Attendance % Card */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <Percent className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Avg. Attendance</span>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-white">{stats.overallAttendance}%</span>
          </div>
        </div>

        {/* Rated Contests Card */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Rated</span>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-white">{stats.ratedContests}</span>
          </div>
        </div>

        {/* Unrated Contests Card */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Unrated</span>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-white">{stats.unratedContests}</span>
          </div>
        </div>

        {/* Average Rating Card */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-450">
            <Crown className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Avg. Rating</span>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-white">{stats.averageRating}</span>
          </div>
        </div>

        {/* Total Contests Card */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Active</span>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-white">{stats.totalContests}</span>
          </div>
        </div>
      </div>

      {/* Main Charts & Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary-500" />
            <h3 className="font-bold text-slate-800 dark:text-white">Weekly Participation Rate</h3>
          </div>
          <div className="h-72">
            {weeklyLabels.length > 0 ? (
              <Line data={lineChartData} options={lineChartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No contests recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Bar Chart */}
        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-indigo-500" />
            <h3 className="font-bold text-slate-800 dark:text-white">Department comparison</h3>
          </div>
          <div className="h-72">
            {deptLabels.length > 0 ? (
              <Bar data={barChartData} options={barChartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No department stats available.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lower Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Active Students */}
        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
            <Crown className="h-5 w-5 text-amber-500" />
            <h3 className="font-bold text-slate-800 dark:text-white">Top Active Performers</h3>
          </div>
          
          <div className="space-y-4">
            {topStudents.length === 0 ? (
              <p className="text-center py-6 text-sm text-slate-400">No student metrics logged.</p>
            ) : (
              topStudents.map((s, idx) => (
                <div key={s.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950 text-xs font-bold text-amber-600">
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{s.name}</h4>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">{s.register_number} • {s.department}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 text-xs font-bold text-emerald-600">
                      {s.present_count} / {s.total_contests} Contests
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dashboard Alerts / Notifications */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            <h3 className="font-bold text-slate-800 dark:text-white">Faculty Alerts & Notifications</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Low Attendance Block */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Low Attendance (&lt; 10%)</h4>
              {alerts.lowAttendanceStudents.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
                  All students have high participation!
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {alerts.lowAttendanceStudents.map(student => (
                    <div key={student.id} className="flex items-center justify-between p-2.5 rounded-xl border border-amber-100 bg-amber-50/40 dark:border-amber-950/20 dark:bg-amber-950/10 text-xs">
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 block">{student.name}</span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wide">{student.register_number} • {student.department}</span>
                      </div>
                      <span className="font-bold text-amber-600">{student.attendance_percentage}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Missing Uploads Block */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Missing Contest Uploads</h4>
              {alerts.missingUploads.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
                  No missing contest uploads.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {alerts.missingUploads.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2.5 rounded-xl border border-rose-100 bg-rose-50/40 dark:border-rose-950/20 dark:bg-rose-950/10 text-xs">
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 block">{c.name}</span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <CalendarClock className="h-3 w-3" />
                          {new Date(c.date).toLocaleDateString()}
                        </span>
                      </div>
                      <Link to="/attendance" className="text-[10px] font-bold text-rose-600 hover:underline">
                        Upload Now
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
