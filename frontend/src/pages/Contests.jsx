import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Plus,
  Calendar,
  Trash2,
  Edit,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Download,
  Activity,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Filter,
  BarChart3,
  TrendingUp,
  Lock,
  Unlock,
  Users,
  Target,
  Trophy,
  Zap,
  Eye,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  Area,
  AreaChart,
  Line,
  LineChart,
} from 'recharts';

/* ─────────────────────────── helpers ─────────────────────────── */
const BATCH_OPTIONS = ['2023-2027', '2024-2028', '2025-2029', '2026-2030'];

const getContestTiming = (contestDate) => {
  const cDate = new Date(contestDate).getTime();
  const now = Date.now();
  const duration = 1.5 * 60 * 60 * 1000;
  if (cDate > now) return 'upcoming';
  if (now - cDate < duration) return 'active';
  return 'past';
};

/* ── Stat Card ── */
function StatCard({ icon: Icon, label, value, sub, colorClass, bgClass, trend }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-4 shadow-sm hover:shadow-md transition-all duration-200 group`}>
      <div className="flex items-start justify-between">
        <div className={`h-10 w-10 rounded-xl ${bgClass} flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-200`}>
          <Icon className={`h-5 w-5 ${colorClass}`} />
        </div>
        {trend !== undefined && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${trend >= 0 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'text-rose-500 bg-rose-50 dark:bg-rose-950/30'}`}>
            <ArrowUpRight className={`h-3 w-3 ${trend < 0 ? 'rotate-180' : ''}`} />
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-black mt-0.5 ${colorClass}`}>{value}</p>
        {sub && <p className="text-[10px] text-slate-400 font-medium mt-0.5">{sub}</p>}
      </div>
      <div className={`absolute -bottom-3 -right-3 h-14 w-14 rounded-full ${bgClass} opacity-20`} />
    </div>
  );
}

/* ── Badge helpers ── */
function TypeBadge({ type }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
      type === 'weekly'
        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
        : 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400'
    }`}>
      {type === 'weekly' ? <Zap className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
      {type === 'weekly' ? 'Weekly' : 'Biweekly'}
    </span>
  );
}

function AttendanceBadge({ contest }) {
  const timing = getContestTiming(contest.date);
  const isOngoing = timing === 'active';
  const isUnrated = contest.status?.toLowerCase() === 'unrated' || contest.contest_status?.toLowerCase() === 'unrated' || contest.attendance_status === 'UNRATED';
  const isPresent = contest.is_joined || contest.attendance_status === 'PRESENT';

  if (isOngoing) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-extrabold bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
        🔵 Ongoing
      </span>
    );
  }

  if (isUnrated) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-extrabold bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        🟡 Unrated
      </span>
    );
  }

  if (isPresent) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-extrabold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        🟢 Present
      </span>
    );
  }

  if (timing === 'upcoming') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-extrabold bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-450 border border-blue-100 dark:border-blue-900/30">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
        Registered
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-extrabold bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
      🔴 Absent
    </span>
  );
}

function TimingBadge({ timing }) {
  const map = {
    active: 'bg-amber-400 text-white animate-pulse',
    upcoming: 'bg-sky-500 text-white',
    past: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  };
  return (
    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-extrabold capitalize ${map[timing]}`}>
      {timing}
    </span>
  );
}

/* ── Tooltip for charts ── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 shadow-xl text-white text-xs">
      <p className="font-bold text-slate-300 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <span className="font-black">{p.value}%</span></p>
      ))}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════ */
function Contests() {
  /* ── state ── */
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [adminMode, setAdminMode] = useState(false);
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedContest, setSelectedContest] = useState(null);

  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('all');
  const [studentSearch, setStudentSearch] = useState('');

  const [contestReports, setContestReports] = useState([]);
  const [studentSummaries, setStudentSummaries] = useState([]);
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState('trend');
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [expandedContestId, setExpandedContestId] = useState(null);
  const [contestParticipants, setContestParticipants] = useState({});
  const [loadingParticipants, setLoadingParticipants] = useState({});

  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideContest, setOverrideContest] = useState(null);
  const [overrideStatus, setOverrideStatus] = useState('present');
  const [overrideRemarks, setOverrideRemarks] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  const [formData, setFormData] = useState({ contestId: '', name: '', date: '', type: 'weekly' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const selectedStudentInfo = students.find(s => s.id === parseInt(selectedStudentId));

  /* ── fetch students ── */
  useEffect(() => {
    axios.get('/api/students?status=active')
      .then(res => { if (res.data.success) setStudents(res.data.data || []); })
      .catch(() => {});
  }, []);

  /* ── fetch contests ── */
  const fetchContests = async () => {
    setLoading(true);
    try {
      let url = '/api/contests';
      let params = { type: filterType };
      
      if (selectedStudentId !== 'all') {
        url = `/api/attendance/student/${selectedStudentId}`;
        params = {};
      } else {
        params.userId = '';
      }
      
      const res = await axios.get(url, { params });
      if (res.data.success) {
        if (selectedStudentId !== 'all') {
          // Map student attendance records to contests shape
          const mapped = (res.data.data || []).map(c => ({
            id: c.contest_id,
            contest_id: c.contest_slug,
            name: c.contest_name,
            date: c.contest_date,
            type: c.contest_type ? c.contest_type.toLowerCase() : 'weekly',
            status: c.contest_status ? c.contest_status.toUpperCase() : 'RATED',
            is_registered: !!c.is_registered,
            is_joined: c.attendance_status === 'PRESENT',
            eligibility_status: c.eligibility_status,
            attendance_status: c.attendance_status,
            problems_solved: c.problems_solved,
            total_problems: c.total_problems,
            rating: c.rating,
            rating_change: c.rating_change,
            global_rank: c.global_rank
          }));
          
          // Apply type filter on frontend
          const filtered = filterType 
            ? mapped.filter(c => c.type === filterType.toLowerCase())
            : mapped;
            
          setContests(filtered);
        } else {
          setContests(res.data.data || []);
        }
      }
    } catch {
      setError('Failed to fetch contests.');
    } finally {
      setLoading(false);
    }
  };

  /* ── fetch analytics ── */
  const fetchAnalyticsReports = async () => {
    try {
      const [r1, r2] = await Promise.all([
        axios.get('/api/reports/contests', { params: { batch: selectedBatch } }),
        axios.get('/api/reports/students'),
      ]);
      if (r1.data.success) setContestReports(r1.data.data || []);
      if (r2.data.success) setStudentSummaries(r2.data.data || []);
    } catch {}
  };

  useEffect(() => { fetchContests(); }, [filterType, selectedStudentId]);
  useEffect(() => { fetchAnalyticsReports(); }, [selectedBatch]);
  useEffect(() => { setCurrentPage(1); setExpandedContestId(null); }, [selectedStudentId, selectedBatch, filterType, filterStatus]);

  /* ── form handlers ── */
  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const openAddModal = () => {
    setModalMode('add');
    setFormData({ contestId: '', name: '', date: new Date().toISOString().split('T')[0], type: 'weekly' });
    setFormError('');
    setIsOpenModal(true);
  };

  const openEditModal = (c) => {
    setModalMode('edit');
    setSelectedContest(c);
    setFormData({ contestId: c.contest_id, name: c.name, date: new Date(c.date).toISOString().split('T')[0], type: c.type });
    setFormError('');
    setIsOpenModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      const res = modalMode === 'add'
        ? await axios.post('/api/contests', formData)
        : await axios.put(`/api/contests/${selectedContest.id}`, formData);
      if (res.data.success) {
        setIsOpenModal(false);
        setSuccessMsg(modalMode === 'add' ? 'Contest created successfully.' : 'Contest updated successfully.');
        fetchContests();
        fetchAnalyticsReports();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Error saving contest.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteContest = async (id) => {
    if (!window.confirm('Delete this contest? All attendance records will be permanently removed.')) return;
    try {
      const res = await axios.delete(`/api/contests/${id}`);
      if (res.data.success) {
        setSuccessMsg('Contest deleted.');
        fetchContests();
        fetchAnalyticsReports();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch {
      setError('Failed to delete contest.');
    }
  };

  const handleRegister = async (contestId) => {
    try {
      const res = await axios.post('/api/contests/register', { userId: selectedStudentId, contestId });
      if (res.data.success) { setSuccessMsg('Registered!'); fetchContests(); setTimeout(() => setSuccessMsg(''), 3000); }
    } catch { setError('Failed to register.'); }
  };

  const handleJoin = async (contestId) => {
    try {
      const res = await axios.post('/api/contests/join', { userId: selectedStudentId, contestId });
      if (res.data.success) { setSuccessMsg('Joined & marked present!'); fetchContests(); setTimeout(() => setSuccessMsg(''), 3000); }
    } catch { setError('Failed to join.'); }
  };

  const openOverride = (c) => {
    setOverrideContest(c);
    setOverrideStatus(c.is_joined ? 'absent' : 'present');
    setOverrideRemarks('');
    setShowOverrideModal(true);
  };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!overrideContest || selectedStudentId === 'all') return;
    setSavingOverride(true);
    try {
      const res = await axios.post('/api/attendance/override', {
        studentId: selectedStudentId,
        contestId: overrideContest.id,
        status: overrideStatus,
        remarks: overrideRemarks,
      });
      if (res.data.success) {
        setShowOverrideModal(false);
        setSuccessMsg(`Override saved for ${overrideContest.name}.`);
        fetchContests();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch { setError('Failed to save override.'); }
    finally { setSavingOverride(false); }
  };

  const fetchParticipants = async (contestId) => {
    if (contestParticipants[contestId]) return;
    setLoadingParticipants(p => ({ ...p, [contestId]: true }));
    try {
      const res = await axios.get(`/api/attendance/contest/${contestId}`);
      if (res.data.success) setContestParticipants(p => ({ ...p, [contestId]: res.data.data || [] }));
    } catch {}
    finally { setLoadingParticipants(p => ({ ...p, [contestId]: false })); }
  };

  /* ── derived data ── */
  const filteredStudents = useMemo(() =>
    students.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.roll_no.includes(studentSearch);
      const matchBatch = selectedBatch ? s.academic_batch === selectedBatch : true;
      return matchSearch && matchBatch;
    }), [students, studentSearch, selectedBatch]);

  const batchDates = useMemo(() => {
    if (!selectedBatch) return null;
    const bs = students.filter(s => s.academic_batch === selectedBatch);
    if (!bs.length) return null;
    const starts = bs.map(s => new Date(s.academic_start_date).getTime()).filter(t => !isNaN(t));
    const ends = bs.map(s => new Date(s.academic_end_date).getTime()).filter(t => !isNaN(t));
    return {
      start: starts.length ? new Date(Math.min(...starts)) : null,
      end: ends.length ? new Date(Math.max(...ends)) : null,
    };
  }, [selectedBatch, students]);

  const getContestStatusHelper = (c) => {
    if (selectedStudentId !== 'all' && c.attendance_status) {
      return c.attendance_status.toLowerCase();
    }
    const timing = getContestTiming(c.date);
    if (timing === 'active') return 'ongoing';
    if (c.status?.toLowerCase() === 'unrated' || c.contest_status?.toLowerCase() === 'unrated') return 'unrated';
    return 'rated';
  };

  const filteredContestsByBatch = useMemo(() => {
    let list = contests;
    if (selectedBatch && batchDates) {
      list = list.filter(c => {
        const t = new Date(c.date).getTime();
        const ok1 = batchDates.start ? t >= batchDates.start.getTime() : true;
        const ok2 = batchDates.end ? t <= batchDates.end.getTime() : true;
        return ok1 && ok2;
      });
    }
    if (filterStatus) {
      list = list.filter(c => {
        const status = getContestStatusHelper(c);
        if (filterStatus === 'present') return status === 'present' || status === 'attended';
        if (filterStatus === 'absent') return status === 'absent' || status === 'not attended';
        return status === filterStatus;
      });
    }
    return list;
  }, [contests, selectedBatch, batchDates, filterStatus, selectedStudentId]);

  const recentActivity = useMemo(() =>
    filteredContestsByBatch.filter(c => getContestTiming(c.date) === 'past').slice(0, 5),
    [filteredContestsByBatch]);

  const batchStudentsCount = useMemo(() => {
    const bs = students.filter(s => selectedBatch ? s.academic_batch === selectedBatch : true);
    return bs.length || 1;
  }, [students, selectedBatch]);

  const eligibleContests = useMemo(() => {
    if (selectedStudentId !== 'all') {
      return contests.filter(c => c.eligibility_status === 'Eligible');
    }
    
    let start = null;
    let end = new Date();
    
    if (selectedBatch && batchDates) {
      if (batchDates.start) start = batchDates.start;
      if (batchDates.end) {
        if (batchDates.end < end) end = batchDates.end;
      }
    } else {
      start = new Date('2023-07-01');
    }
    
    return contests.filter(c => {
      const cDate = new Date(c.date);
      if (isNaN(cDate.getTime())) return false;
      const okStart = start ? cDate >= start : true;
      const okEnd = cDate <= end;
      return okStart && okEnd;
    });
  }, [contests, selectedStudentId, selectedBatch, batchDates]);

  const stats = useMemo(() => {
    const getLocalStatus = (c) => {
      if (selectedStudentId !== 'all' && c.attendance_status) {
        return c.attendance_status; // 'PRESENT', 'ABSENT', 'UNRATED', 'ONGOING', 'NOT_APPLICABLE'
      }
      const timing = getContestTiming(c.date);
      if (timing === 'active') return 'ONGOING';
      if (c.status?.toLowerCase() === 'unrated' || c.contest_status?.toLowerCase() === 'unrated') return 'UNRATED';
      if (timing === 'upcoming') return 'NOT_APPLICABLE';
      return 'RATED';
    };

    const enriched = eligibleContests.map(c => ({
      ...c,
      local_status: getLocalStatus(c)
    }));

    const ratedRecords = enriched.filter(c => c.local_status === 'RATED' || c.local_status === 'PRESENT' || c.local_status === 'ABSENT');
    const ratedTotal = ratedRecords.length;
    const unrated = enriched.filter(c => c.local_status === 'UNRATED').length;
    const ongoing = enriched.filter(c => c.local_status === 'ONGOING').length;

    let attended = 0;
    let label = '';
    
    if (selectedStudentId !== 'all') {
      attended = ratedRecords.filter(c => c.local_status === 'PRESENT').length;
      label = 'Student-specific stats';
    } else {
      const totalAttended = ratedRecords.reduce((acc, c) => acc + (c.attendance_count || 0), 0);
      attended = Math.round(totalAttended / batchStudentsCount);
      label = selectedBatch ? `${selectedBatch} batch averages` : 'System-wide averages';
    }
    
    const missed = Math.max(0, ratedTotal - attended);
    const percentage = ratedTotal > 0 ? parseFloat(((attended / ratedTotal) * 100).toFixed(1)) : 100.0;
    
    return {
      total: ratedTotal,
      attended,
      missed,
      percentage,
      unrated,
      ongoing,
      label
    };
  }, [eligibleContests, selectedStudentId, selectedBatch, batchStudentsCount]);

  const weeklyEligible = useMemo(() => eligibleContests.filter(c => c.type === 'weekly'), [eligibleContests]);
  const biweeklyEligible = useMemo(() => eligibleContests.filter(c => c.type === 'biweekly'), [eligibleContests]);

  const weeklyStats = useMemo(() => {
    const eligibleRecords = weeklyEligible.filter(c => {
      const timing = getContestTiming(c.date);
      const isUnrated = c.status?.toLowerCase() === 'unrated' || c.contest_status?.toLowerCase() === 'unrated' || c.attendance_status === 'UNRATED';
      return timing !== 'active' && timing !== 'upcoming' && !isUnrated;
    });
    const eligible = eligibleRecords.length;
    let attended = 0;
    if (selectedStudentId !== 'all') {
      attended = eligibleRecords.filter(c => c.is_joined || c.attendance_status === 'PRESENT').length;
    } else {
      const totalAttended = eligibleRecords.reduce((acc, c) => acc + (c.attendance_count || 0), 0);
      attended = Math.round(totalAttended / batchStudentsCount);
    }
    const missed = Math.max(0, eligible - attended);
    const rate = eligible > 0 ? parseFloat(((attended / eligible) * 100).toFixed(1)) : 100.0;
    return { eligible, attended, missed, rate };
  }, [weeklyEligible, selectedStudentId, batchStudentsCount]);

  const biweeklyStats = useMemo(() => {
    const eligibleRecords = biweeklyEligible.filter(c => {
      const timing = getContestTiming(c.date);
      const isUnrated = c.status?.toLowerCase() === 'unrated' || c.contest_status?.toLowerCase() === 'unrated' || c.attendance_status === 'UNRATED';
      return timing !== 'active' && timing !== 'upcoming' && !isUnrated;
    });
    const eligible = eligibleRecords.length;
    let attended = 0;
    if (selectedStudentId !== 'all') {
      attended = eligibleRecords.filter(c => c.is_joined || c.attendance_status === 'PRESENT').length;
    } else {
      const totalAttended = eligibleRecords.reduce((acc, c) => acc + (c.attendance_count || 0), 0);
      attended = Math.round(totalAttended / batchStudentsCount);
    }
    const missed = Math.max(0, eligible - attended);
    const rate = eligible > 0 ? parseFloat(((attended / eligible) * 100).toFixed(1)) : 100.0;
    return { eligible, attended, missed, rate };
  }, [biweeklyEligible, selectedStudentId, batchStudentsCount]);

  const monthlyTrendData = useMemo(() => {
    const monthlyGroups = {};
    
    eligibleContests.forEach(item => {
      const d = new Date(item.date);
      if (isNaN(d.getTime())) return;
      
      const year = d.getFullYear();
      const monthVal = d.getMonth();
      const monthKey = `${year}-${String(monthVal + 1).padStart(2, '0')}`;
      
      if (!monthlyGroups[monthKey]) {
        monthlyGroups[monthKey] = {
          key: monthKey,
          monthName: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          present: 0,
          total: 0
        };
      }
      
      const group = monthlyGroups[monthKey];
      
      if (selectedStudentId !== 'all') {
        group.total++;
        if (item.is_joined) {
          group.present++;
        }
      } else {
        group.present += (item.attendance_count || 0);
        group.total += batchStudentsCount;
      }
    });
    
    const result = Object.values(monthlyGroups)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(g => ({
        name: g.monthName,
        rate: g.total > 0 ? Math.round((g.present / g.total) * 100) : 0,
        present: g.present,
        total: g.total
      }));
      
    return result.slice(-24);
  }, [eligibleContests, selectedStudentId, batchStudentsCount]);

  const semesterAnalyticsData = useMemo(() => {
    let startDate = null;
    if (selectedStudentId !== 'all' && selectedStudentInfo?.academic_start_date) {
      startDate = new Date(selectedStudentInfo.academic_start_date);
    } else if (selectedBatch) {
      const startYear = parseInt(selectedBatch.split('-')[0], 10);
      startDate = !isNaN(startYear) ? new Date(`${startYear}-07-01`) : new Date('2024-07-01');
    } else {
      startDate = new Date('2023-07-01');
    }
    
    const semestersData = {};
    for (let i = 1; i <= 8; i++) {
      semestersData[i] = {
        semester: `Semester ${i}`,
        semesterNum: i,
        total: 0,
        present: 0,
        absent: 0
      };
    }
    
    eligibleContests.forEach(item => {
      const d = new Date(item.date);
      if (isNaN(d.getTime())) return;
      
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      const itemYear = d.getFullYear();
      const itemMonth = d.getMonth();
      
      const monthsDiff = (itemYear - startYear) * 12 + (itemMonth - startMonth);
      if (monthsDiff < 0) return;
      
      const sem = Math.floor(monthsDiff / 6) + 1;
      if (sem < 1 || sem > 8) return;
      
      const group = semestersData[sem];
      
      if (selectedStudentId !== 'all') {
        group.total++;
        if (item.is_joined) {
          group.present++;
        } else {
          group.absent++;
        }
      } else {
        group.present += (item.attendance_count || 0);
        group.total += batchStudentsCount;
        group.absent += Math.max(0, batchStudentsCount - (item.attendance_count || 0));
      }
    });
    
    return Object.values(semestersData).map(s => {
      let total = s.total;
      let present = s.present;
      let absent = s.absent;
      
      if (selectedStudentId === 'all') {
        total = Math.round(s.total / batchStudentsCount);
        present = Math.round(s.present / batchStudentsCount);
        absent = Math.round(s.absent / batchStudentsCount);
      }
      
      const rate = total > 0 ? parseFloat(((present / total) * 100).toFixed(1)) : 0;
      
      return {
        semester: s.semester,
        semesterNum: s.semesterNum,
        total,
        present,
        absent,
        rate
      };
    });
  }, [eligibleContests, selectedStudentId, selectedStudentInfo, selectedBatch, batchStudentsCount]);

  const batchComparisonData = useMemo(() => {
    const targetBatches = ['2023-2027', '2024-2028', '2025-2029'];
    return targetBatches.map(b => {
      const batchStudents = studentSummaries.filter(s => s.academic_year === b);
      const totalParticipants = batchStudents.length;
      
      const avgAttendance = totalParticipants > 0
        ? parseFloat((batchStudents.reduce((acc, s) => acc + (s.attendance_percentage || 0), 0) / totalParticipants).toFixed(1))
        : 0;
        
      const avgRating = totalParticipants > 0
        ? Math.round(batchStudents.reduce((acc, s) => acc + (s.current_rating || 1500), 0) / totalParticipants)
        : 1500;
        
      return {
        name: b,
        attendance: avgAttendance,
        rating: avgRating,
        participants: totalParticipants
      };
    });
  }, [studentSummaries]);

  const paginatedContests = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredContestsByBatch.slice(start, start + itemsPerPage);
  }, [filteredContestsByBatch, currentPage]);

  const totalPages = Math.ceil(filteredContestsByBatch.length / itemsPerPage);

  /* ── export ── */
  const handleExportReport = () => {
    let exportData, fileName;
    if (selectedStudentId === 'all') {
      exportData = filteredContestsByBatch.map(c => ({
        'Contest Name': c.name,
        'Type': c.type === 'weekly' ? 'Weekly' : 'Biweekly',
        'Date': new Date(c.date).toLocaleDateString(),
        'Registrations': c.registration_count,
        'Attended': c.attendance_count,
        'Rate': c.registration_count > 0 ? `${Math.round((c.attendance_count / c.registration_count) * 100)}%` : '0%',
      }));
      fileName = selectedBatch ? `${selectedBatch}_contests` : 'all_contests';
    } else {
      const name = students.find(s => s.id === parseInt(selectedStudentId))?.name || 'student';
      exportData = filteredContestsByBatch.map(c => {
        const timing = getContestTiming(c.date);
        let status = 'Did Not Register';
        if (c.is_joined) status = 'Attended';
        else if (c.is_registered) status = timing === 'upcoming' ? 'Registered' : 'Missed';
        return {
          'Contest Name': c.name,
          'Type': c.type === 'weekly' ? 'Weekly' : 'Biweekly',
          'Date': new Date(c.date).toLocaleDateString(),
          'Status': status,
        };
      });
      fileName = `${name.replace(/\s+/g, '_')}_contest_history`;
    }
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ContestReport');
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleToggleExpand = (id) => {
    if (expandedContestId === id) { setExpandedContestId(null); return; }
    setExpandedContestId(id);
    if (selectedStudentId === 'all') fetchParticipants(id);
  };

  /* ════════════════ RENDER ════════════════ */
  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-md shadow-primary-500/20">
              <Trophy className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Contest Management Dashboard</h1>
          </div>
          <p className="text-xs text-slate-400 ml-10">
            Track college-wide LeetCode contest participation · Analyze batch trends · Generate reports
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setAdminMode(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              adminMode
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800/40 shadow-inner'
                : 'bg-white text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 shadow-sm'
            }`}
          >
            {adminMode ? <Unlock className="h-3.5 w-3.5 text-amber-500" /> : <Lock className="h-3.5 w-3.5" />}
            {adminMode ? 'Admin ON' : 'Admin OFF'}
          </button>
          {adminMode && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white text-xs font-bold transition-all shadow-md shadow-primary-500/20"
            >
              <Plus className="h-3.5 w-3.5" /> Create Contest
            </button>
          )}
        </div>
      </div>

      {/* ── TOAST ALERTS ── */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 px-4 py-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />{successMsg}
          <button className="ml-auto" onClick={() => setSuccessMsg('')}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-400 animate-fade-in">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
          <button className="ml-auto" onClick={() => setError('')}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* ── SUMMARY STAT CARDS ── */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Dashboard Metrics</span>
          <span className="text-[10px] italic text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full capitalize font-semibold">{stats.label}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            icon={ClipboardList}
            label="Eligible Rated"
            value={stats.total}
            sub={selectedBatch || 'All batches'}
            colorClass="text-slate-600 dark:text-slate-300"
            bgClass="bg-slate-100 dark:bg-slate-800"
          />
          <StatCard
            icon={CheckCircle2}
            label={selectedStudentId === 'all' ? 'Avg Attended' : 'Attended'}
            value={stats.attended}
            sub="Past contests"
            colorClass="text-emerald-600 dark:text-emerald-450"
            bgClass="bg-emerald-50 dark:bg-emerald-950/40"
          />
          <StatCard
            icon={AlertCircle}
            label={selectedStudentId === 'all' ? 'Avg Missed' : 'Missed'}
            value={stats.missed}
            sub="Past contests"
            colorClass="text-rose-600 dark:text-rose-400"
            bgClass="bg-rose-50 dark:bg-rose-950/40"
          />
          <StatCard
            icon={Target}
            label="Attendance Rate"
            value={`${stats.percentage}%`}
            sub={stats.percentage >= 75 ? '✓ Above threshold' : '⚠ Below 75%'}
            colorClass={stats.percentage >= 75 ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}
            bgClass={stats.percentage >= 75 ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'bg-amber-50 dark:bg-amber-950/40'}
          />
          <StatCard
            icon={Zap}
            label="Unrated Contests"
            value={stats.unrated}
            sub="Excluded from rate"
            colorClass="text-amber-600 dark:text-amber-400"
            bgClass="bg-amber-50 dark:bg-amber-950/40"
          />
          <StatCard
            icon={Activity}
            label="Ongoing Contests"
            value={stats.ongoing}
            sub="Active now"
            colorClass="text-blue-600 dark:text-blue-400"
            bgClass="bg-blue-50 dark:bg-blue-950/40"
          />
        </div>
      </div>

      {/* ── COMPACT TOOLBAR ── */}
      <div className="flex flex-wrap items-center gap-2.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 px-4 py-3 rounded-2xl shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[170px]">
          <Search className="absolute inset-y-0 left-3 my-auto h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={studentSearch}
            onChange={e => setStudentSearch(e.target.value)}
            placeholder="Search student name / roll…"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 py-2 pl-8 pr-3 text-xs outline-none focus:border-primary-400 dark:text-white placeholder:text-slate-400 transition-colors"
          />
        </div>

        {/* Student selector */}
        <div className="relative flex-1 min-w-[180px]">
          <Users className="absolute inset-y-0 left-3 my-auto h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <select
            value={selectedStudentId}
            onChange={e => setSelectedStudentId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 py-2 pl-8 pr-3 text-xs font-semibold outline-none focus:border-primary-400 dark:text-slate-200 transition-colors appearance-none"
          >
            <option value="all">All Students (Batch Overview)</option>
            {filteredStudents.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.roll_no})</option>
            ))}
          </select>
        </div>

        {/* Batch Filter */}
        <div className="relative shrink-0">
          <Filter className="absolute inset-y-0 left-3 my-auto h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <select
            value={selectedBatch}
            onChange={e => setSelectedBatch(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 py-2 pl-8 pr-3 text-xs font-semibold outline-none focus:border-primary-400 dark:text-slate-200 transition-colors appearance-none"
          >
            <option value="">All Batches</option>
            {BATCH_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Contest Type */}
        <div className="relative shrink-0">
          <BarChart3 className="absolute inset-y-0 left-3 my-auto h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 py-2 pl-8 pr-3 text-xs font-semibold outline-none focus:border-primary-400 dark:text-slate-200 transition-colors appearance-none"
          >
            <option value="">All Types</option>
            <option value="weekly">Weekly Only</option>
            <option value="biweekly">Biweekly Only</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="relative shrink-0">
          <Filter className="absolute inset-y-0 left-3 my-auto h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 py-2 pl-8 pr-3 text-xs font-semibold outline-none focus:border-primary-400 dark:text-slate-200 transition-colors appearance-none"
          >
            <option value="">All Statuses</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="unrated">Unrated</option>
            <option value="ongoing">Ongoing</option>
          </select>
        </div>

        {/* Divider */}
        <div className="h-7 w-px bg-slate-200 dark:bg-slate-700 shrink-0 hidden sm:block" />

        {/* Toggle Charts */}
        <button
          onClick={() => setShowAnalyticsPanel(p => !p)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 ${
            showAnalyticsPanel
              ? 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-950/30 dark:text-primary-400 dark:border-primary-900/30'
              : 'bg-white text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          {showAnalyticsPanel ? 'Hide Charts' : 'Analytics'}
        </button>

        {/* Export */}
        <button
          onClick={handleExportReport}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 text-xs font-bold transition-all shadow-sm shrink-0 border border-emerald-100 dark:border-emerald-900/30"
        >
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      {/* ── ANALYTICS PANEL ── */}
      {showAnalyticsPanel && (
        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm animate-fade-in space-y-6">
          
          {/* Header block with tab selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <h3 className="text-xs font-extrabold text-slate-700 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary-500" />
              Academic Participation Analytics
            </h3>
            <div className="flex rounded-xl bg-slate-50 dark:bg-slate-800/60 p-1 border border-slate-100 dark:border-slate-700/60 gap-0.5">
              {[
                { id: 'trend', label: 'Monthly Trend' },
                { id: 'semester', label: 'Semester Analytics' },
                { id: 'batch', label: 'Batch Comparison' },
                { id: 'history', label: 'Contest History' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveAnalyticsTab(tab.id)}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                    activeAnalyticsTab === tab.id
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-4">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider block">Total Eligible Contests</span>
              <span className="text-xl font-black text-slate-800 dark:text-white mt-1 block">{stats.total}</span>
            </div>
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-emerald-50/30 dark:bg-emerald-950/10 p-4">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider block">Attended Contests</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{stats.attended}</span>
            </div>
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-rose-50/30 dark:bg-rose-950/10 p-4">
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-500 uppercase tracking-wider block">Missed Contests</span>
              <span className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 block">{stats.missed}</span>
            </div>
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-indigo-50/30 dark:bg-indigo-950/15 p-4">
              <span className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider block">Attendance Rate</span>
              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">{stats.percentage}%</span>
            </div>
          </div>

          {/* Main Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Side Chart/Table Block (2/3 width) */}
            <div className="lg:col-span-2 space-y-4">
              {activeAnalyticsTab === 'trend' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Monthly Attendance Trend</span>
                    <span className="text-[10px] text-slate-400 font-semibold italic">Showing last {monthlyTrendData.length} months</span>
                  </div>
                  <div className="h-64 rounded-xl border border-slate-100 dark:border-slate-850 p-2 bg-slate-50/20 dark:bg-slate-900/10">
                    {monthlyTrendData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400 italic">No monthly data available yet.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="monthlyGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.08)" />
                          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <RechartsTooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="rate" name="Attendance Rate" stroke="#3b82f6" strokeWidth={3} fill="url(#monthlyGrad)" dot={{ r: 4, fill: '#3b82f6', strokeWidth: 1 }} activeDot={{ r: 6 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              )}

              {activeAnalyticsTab === 'semester' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Semester-wise Breakdown</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bar chart */}
                    <div className="h-56 rounded-xl border border-slate-100 dark:border-slate-850 p-2 bg-slate-50/20 dark:bg-slate-900/10">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={semesterAnalyticsData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }} barSize={16}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.08)" />
                          <XAxis dataKey="semester" tickFormatter={(v) => v.replace('Semester ', 'S')} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <RechartsTooltip content={<CustomTooltip />} />
                          <Bar dataKey="rate" name="Attendance Rate" fill="#6366f1" radius={[4, 4, 0, 0]}>
                            {semesterAnalyticsData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.rate >= 75 ? '#10b981' : entry.rate >= 50 ? '#f59e0b' : '#ef4444'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Table */}
                    <div className="border border-slate-150 dark:border-slate-800 rounded-xl overflow-hidden text-xs max-h-56 overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-105 dark:border-slate-850 font-bold text-slate-550">
                            <th className="py-2 px-3">Semester</th>
                            <th className="py-2 px-3 text-right">Eligible</th>
                            <th className="py-2 px-3 text-right">Attended</th>
                            <th className="py-2 px-3 text-right">Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-850/50">
                          {semesterAnalyticsData.map(s => (
                            <tr key={s.semester} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                              <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">{s.semester}</td>
                              <td className="py-2 px-3 text-right font-medium text-slate-505">{s.total}</td>
                              <td className="py-2 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{s.present}</td>
                              <td className="py-2 px-3 text-right font-extrabold text-slate-800 dark:text-slate-200">{s.rate}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeAnalyticsTab === 'batch' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Batch-wise Performance Comparison</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bar Chart comparing attendance */}
                    <div className="h-56 rounded-xl border border-slate-100 dark:border-slate-850 p-2 bg-slate-50/20 dark:bg-slate-900/10">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={batchComparisonData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }} barSize={32}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.08)" />
                          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <RechartsTooltip content={<CustomTooltip />} />
                          <Bar dataKey="attendance" name="Avg Attendance" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Table */}
                    <div className="border border-slate-150 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-850 font-bold text-slate-550">
                            <th className="py-2.5 px-3">Batch</th>
                            <th className="py-2.5 px-3 text-right">Participants</th>
                            <th className="py-2.5 px-3 text-right">Avg Rating</th>
                            <th className="py-2.5 px-3 text-right">Avg Attendance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-850/50">
                          {batchComparisonData.map(b => (
                            <tr key={b.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                              <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">{b.name}</td>
                              <td className="py-2.5 px-3 text-right font-medium text-slate-505">{b.participants}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-indigo-650 dark:text-indigo-400">{b.rating}</td>
                              <td className="py-2.5 px-3 text-right font-extrabold text-cyan-600 dark:text-cyan-400">{b.attendance}%</td>
                            </tr>
                          ))}
                          {selectedStudentId !== 'all' && selectedStudentInfo && (
                            <tr className="bg-primary-50/20 dark:bg-primary-950/15 border-t border-primary-100 dark:border-primary-900/30">
                              <td className="py-2.5 px-3 font-extrabold text-primary-650 dark:text-primary-400 flex items-center gap-1">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary-500 shrink-0" />
                                {selectedStudentInfo.name.split(' ')[0]} (You)
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-400 dark:text-slate-500 font-medium">—</td>
                              <td className="py-2.5 px-3 text-right font-extrabold text-primary-655 dark:text-primary-400">
                                {studentSummaries.find(s => s.id === parseInt(selectedStudentId))?.current_rating || 1500}
                              </td>
                              <td className="py-2.5 px-3 text-right font-extrabold text-primary-655 dark:text-primary-400">
                                {stats.percentage}%
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeAnalyticsTab === 'history' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Contest Participation History</span>
                    <span className="text-[10px] text-slate-400 font-semibold italic">{eligibleContests.length} past contests during academic period</span>
                  </div>
                  <div className="border border-slate-150 dark:border-slate-800 rounded-xl overflow-hidden text-xs max-h-56 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-850 font-bold text-slate-500 sticky top-0 z-10">
                          <th className="py-2 px-4">Contest Name</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-4 text-right">Attendance Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-850/50">
                        {eligibleContests.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center py-10 text-slate-400 italic">No historical contests found.</td>
                          </tr>
                        ) : (
                          eligibleContests.map(c => {
                            const isPresent = selectedStudentId === 'all'
                              ? c.attendance_count > 0
                              : c.is_joined;
                            return (
                              <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                <td className="py-2 px-4 font-semibold text-slate-705 dark:text-slate-300">{c.name}</td>
                                <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                                  {new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="py-2 px-3 uppercase tracking-wide font-extrabold text-[9px]">
                                  <span className={c.type === 'biweekly' ? 'text-purple-600' : 'text-blue-600'}>{c.type}</span>
                                </td>
                                <td className="py-2 px-4 text-right font-extrabold text-[10px]">
                                  {selectedStudentId === 'all' ? (
                                    <span className="text-slate-600 dark:text-slate-400">{c.attendance_count} / {c.registration_count} present</span>
                                  ) : (
                                    <span className={isPresent ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-lg' : 'text-rose-500 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded-lg'}>
                                      {isPresent ? 'Present' : 'Absent'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side Weekly vs Biweekly Breakdown Card (1/3 width) */}
            <div className="lg:col-span-1">
              <div className="rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/10 p-5 space-y-5">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <Calendar className="h-4.5 w-4.5 text-primary-500" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-400">Weekly vs Biweekly Analysis</span>
                </div>

                {/* Weekly stats block */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Weekly Contests</span>
                    <span className="font-extrabold text-blue-600 dark:text-blue-400">{weeklyStats.rate}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${weeklyStats.rate}%` }} />
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-center font-bold mt-1 text-slate-400">
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 py-1 rounded-lg">
                      <span className="block text-slate-700 dark:text-slate-300 text-xs font-black">{weeklyStats.eligible}</span>
                      Eligible
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 py-1 rounded-lg">
                      <span className="block text-emerald-600 dark:text-emerald-450 text-xs font-black">{weeklyStats.attended}</span>
                      Attended
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 py-1 rounded-lg">
                      <span className="block text-rose-500 dark:text-rose-400 text-xs font-black">{weeklyStats.missed}</span>
                      Missed
                    </div>
                  </div>
                </div>

                {/* Biweekly stats block */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Biweekly Contests</span>
                    <span className="font-extrabold text-purple-600 dark:text-purple-400">{biweeklyStats.rate}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-purple-500 transition-all duration-300" style={{ width: `${biweeklyStats.rate}%` }} />
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-center font-bold mt-1 text-slate-400">
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 py-1 rounded-lg">
                      <span className="block text-slate-700 dark:text-slate-300 text-xs font-black">{biweeklyStats.eligible}</span>
                      Eligible
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 py-1 rounded-lg">
                      <span className="block text-emerald-600 dark:text-emerald-450 text-xs font-black">{biweeklyStats.attended}</span>
                      Attended
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 py-1 rounded-lg">
                      <span className="block text-rose-500 dark:text-rose-455 text-xs font-black">{biweeklyStats.missed}</span>
                      Missed
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── RECENT ACTIVITY TIMELINE ── */}
      {selectedStudentId !== 'all' && recentActivity.length > 0 && (
        <div className="bg-gradient-to-r from-slate-50 to-slate-50/60 dark:from-slate-900/60 dark:to-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-3.5 w-3.5 text-primary-500 animate-pulse" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">Recent Activity</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentActivity.map((c) => (
              <div key={c.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-xl px-3 py-2 shadow-sm text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[140px]">{c.name}</span>
                <AttendanceBadge contest={c} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CONTEST TABLE ── */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {/* Table header bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Contest Records
            </span>
            {filteredContestsByBatch.length > 0 && (
              <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full ml-1">
                {filteredContestsByBatch.length}
              </span>
            )}
          </div>
          {selectedStudentInfo && (
            <div className="flex items-center gap-1.5 bg-primary-50 dark:bg-primary-950/30 border border-primary-100 dark:border-primary-900/30 px-3 py-1.5 rounded-xl">
              <Users className="h-3 w-3 text-primary-500" />
              <span className="text-[10px] font-bold text-primary-700 dark:text-primary-400">{selectedStudentInfo.name} · {selectedStudentInfo.roll_no}</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white dark:bg-slate-900 sticky top-0 z-10">
                <th className="px-5 py-3.5 pl-6">Contest Name</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Date</th>
                {selectedStudentId === 'all' ? (
                  <>
                    <th className="px-5 py-3.5">Registrations</th>
                    <th className="px-5 py-3.5">Attended</th>
                    <th className="px-5 py-3.5">Rate</th>
                  </>
                ) : (
                  <>
                    <th className="px-5 py-3.5">Attendance</th>
                    <th className="px-5 py-3.5">Status</th>
                  </>
                )}
                <th className="px-5 py-3.5">Batch</th>
                <th className="px-5 py-3.5 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                      <span className="text-xs text-slate-400 font-medium">Loading contests…</span>
                    </div>
                  </td>
                </tr>
              ) : filteredContestsByBatch.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <ClipboardList className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No contest records available</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          {selectedBatch ? `No contests found for batch ${selectedBatch}.` : 'Try adjusting your filters.'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedContests.map((c) => {
                  const timing = getContestTiming(c.date);
                  const isExpanded = expandedContestId === c.id;
                  const rate = c.registration_count > 0
                    ? Math.round((c.attendance_count / c.registration_count) * 100) : 0;

                  return (
                    <React.Fragment key={c.id}>
                      <tr className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors duration-150 ${isExpanded ? 'bg-primary-50/30 dark:bg-primary-950/10' : ''}`}>
                        {/* Contest Name */}
                        <td className="px-5 py-3.5 pl-6">
                          <div className="flex items-center gap-2">
                            {timing === 'active' && (
                              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                            )}
                            <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">{c.name}</span>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="px-5 py-3.5">
                          <TypeBadge type={c.type} />
                        </td>

                        {/* Date */}
                        <td className="px-5 py-3.5">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            {new Date(c.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>

                        {/* Batch Overview Columns */}
                        {selectedStudentId === 'all' ? (
                          <>
                            <td className="px-5 py-3.5">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{c.registration_count}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{c.attendance_count}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${rate >= 75 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`}
                                    style={{ width: `${rate}%` }}
                                  />
                                </div>
                                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">{rate}%</span>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-5 py-3.5"><AttendanceBadge contest={c} /></td>
                            <td className="px-5 py-3.5"><TimingBadge timing={timing} /></td>
                          </>
                        )}

                        {/* Batch */}
                        <td className="px-5 py-3.5">
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                            {selectedStudentInfo ? selectedStudentInfo.academic_batch : (selectedBatch || 'All')}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 pr-6">
                          <div className="flex items-center justify-end gap-1.5">
                            {!adminMode && (
                              <>
                                <button
                                  onClick={() => handleToggleExpand(c.id)}
                                  className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                >
                                  <Eye className="h-3 w-3" />
                                  {isExpanded ? 'Hide' : 'Details'}
                                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
                                </button>

                                {selectedStudentId === 'all' ? (
                                  <a
                                    href={`/attendance?contestId=${c.id}`}
                                    className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-950/30 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-950/50 transition-all border border-primary-100 dark:border-primary-900/30"
                                  >
                                    <Users className="h-3 w-3" /> Participants
                                  </a>
                                ) : (
                                  <>
                                    {timing === 'upcoming' && !c.is_registered && (
                                      <button
                                        onClick={() => handleRegister(c.id)}
                                        className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-primary-400 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-all"
                                      >
                                        Register
                                      </button>
                                    )}
                                    {timing === 'active' && !c.is_joined && (
                                      <button
                                        onClick={() => handleJoin(c.id)}
                                        className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-500 transition-all shadow-sm"
                                      >
                                        Join Now
                                      </button>
                                    )}
                                    {timing === 'past' && c.status?.toLowerCase() !== 'unrated' && c.contest_status?.toLowerCase() !== 'unrated' && c.attendance_status !== 'UNRATED' && (
                                      <button
                                        onClick={() => openOverride(c)}
                                        className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                                          c.is_joined
                                            ? 'border-rose-200 text-rose-600 hover:bg-rose-50/30 dark:border-rose-900/30 dark:text-rose-400'
                                            : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50/30 dark:border-emerald-900/30 dark:text-emerald-400'
                                        }`}
                                      >
                                        Override
                                      </button>
                                    )}
                                  </>
                                )}
                              </>
                            )}

                            {adminMode && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openEditModal(c)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-all"
                                  title="Edit Contest"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteContest(c.id)}
                                  className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/25 transition-all"
                                  title="Delete Contest"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* ── Expanded Detail Drawer ── */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 dark:bg-slate-800/20">
                          <td colSpan={8} className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="animate-fade-in space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Audit Details</span>
                                <span className="text-[10px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                  Slug: <span className="font-bold text-slate-600 dark:text-slate-300">{c.contest_id}</span>
                                </span>
                              </div>

                              {selectedStudentId === 'all' ? (
                                <div>
                                  <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Participant Log (Top 15)</h5>
                                  {loadingParticipants[c.id] ? (
                                    <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary-500" /></div>
                                  ) : !contestParticipants[c.id] || contestParticipants[c.id].length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No records found for this contest.</p>
                                  ) : (
                                    <>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                                        {contestParticipants[c.id].slice(0, 15).map(p => (
                                          <div key={p.student_id} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 p-2.5 rounded-xl flex items-center justify-between gap-2">
                                            <div>
                                              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs block truncate max-w-[110px]">{p.name}</span>
                                              <span className="text-[9px] text-slate-400 font-mono">{p.register_number}</span>
                                            </div>
                                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-lg uppercase ${
                                              p.status === 'present'
                                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30'
                                                : 'bg-rose-50 text-rose-600 dark:bg-rose-950/30'
                                            }`}>
                                              {p.status === 'present' ? 'Attended' : 'Missed'}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                      {contestParticipants[c.id].length > 15 && (
                                        <p className="text-[10px] text-slate-400 italic text-right mt-1.5">
                                          +{contestParticipants[c.id].length - 15} more records…
                                        </p>
                                      )}
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  {[
                                    { label: '1. Registration', value: c.is_registered ? 'Registered ✓' : 'Not Registered', sub: c.is_registered ? 'Platform verified' : '—', ok: c.is_registered },
                                    { label: '2. Join Activity', value: c.is_joined ? 'Joined ✓' : 'No activity', sub: c.is_joined ? 'Contest Master join' : '—', ok: c.is_joined },
                                    { label: '3. Attendance Record', value: c.is_joined ? 'PRESENT' : 'ABSENT', sub: 'Final status', ok: c.is_joined },
                                  ].map((item, i) => (
                                    <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 p-3 rounded-xl">
                                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">{item.label}</span>
                                      <span className={`text-xs font-extrabold ${item.ok ? 'text-emerald-600' : 'text-rose-500'}`}>{item.value}</span>
                                      <span className="text-[10px] text-slate-400 block mt-0.5">{item.sub}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 px-5 py-3.5">
            <span className="text-[11px] font-semibold text-slate-500">
              Showing <span className="font-extrabold text-slate-700 dark:text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</span>
              –<span className="font-extrabold text-slate-700 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, filteredContestsByBatch.length)}</span>
              {' '}of <span className="font-extrabold text-slate-700 dark:text-slate-200">{filteredContestsByBatch.length}</span> contests
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let page;
                if (totalPages <= 7) {
                  page = i + 1;
                } else if (currentPage <= 4) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  page = totalPages - 6 + i;
                } else {
                  page = currentPage - 3 + i;
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`h-7 w-7 rounded-lg text-[11px] font-bold transition-all border ${
                      page === currentPage
                        ? 'bg-primary-600 text-white border-primary-600 shadow-sm shadow-primary-500/20'
                        : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          OVERRIDE MODAL
      ══════════════════════════════════════════════════════ */}
      {showOverrideModal && overrideContest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Manual Attendance Override</h3>
              <button onClick={() => setShowOverrideModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className={`rounded-xl p-3 mb-4 border text-xs ${overrideStatus === 'present' ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400' : 'bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400'}`}>
              Overriding <strong>{selectedStudentInfo?.name}</strong> ({selectedStudentInfo?.roll_no}) → marking as <strong className="uppercase">{overrideStatus}</strong> for <strong>{overrideContest.name}</strong>.
            </div>

            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reason / Remarks *</label>
                <textarea
                  required
                  rows={3}
                  value={overrideRemarks}
                  onChange={e => setOverrideRemarks(e.target.value)}
                  placeholder="Approved leave, special permission, technical issues…"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs outline-none focus:border-primary-400 dark:text-white resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowOverrideModal(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                  Cancel
                </button>
                <button type="submit" disabled={savingOverride || !overrideRemarks.trim()}
                  className={`rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50 ${overrideStatus === 'present' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'}`}>
                  {savingOverride ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ADD / EDIT CONTEST MODAL
      ══════════════════════════════════════════════════════ */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                {modalMode === 'add' ? '➕ Create Contest' : '✏️ Edit Contest'}
              </h3>
              <button onClick={() => setIsOpenModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-3 text-xs font-semibold text-rose-700 dark:text-rose-400 mb-4">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />{formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contest ID (Slug)</label>
                <input type="text" name="contestId" required value={formData.contestId} onChange={handleInputChange}
                  placeholder="e.g. weekly-contest-390"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-primary-400 dark:text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contest Name</label>
                <input type="text" name="name" required value={formData.name} onChange={handleInputChange}
                  placeholder="e.g. Weekly Contest 390"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-primary-400 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contest Date</label>
                  <input type="date" name="date" required value={formData.date} onChange={handleInputChange}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-primary-400 dark:text-slate-200" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contest Type</label>
                  <select name="type" required value={formData.type} onChange={handleInputChange}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-primary-400 dark:text-slate-200">
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsOpenModal(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                  Cancel
                </button>
                <button type="submit" disabled={formLoading}
                  className="rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white px-5 py-2 text-xs font-bold shadow-md shadow-primary-500/20 flex items-center gap-1.5">
                  {formLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Contest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Contests;
