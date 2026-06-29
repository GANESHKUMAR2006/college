import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  CloudUpload, 
  Search, 
  Check, 
  X, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Filter, 
  ChevronRight, 
  ChevronDown, 
  User, 
  ClipboardCheck, 
  ExternalLink,
  Trophy,
  Crown,
  BookOpen,
  RefreshCw
} from 'lucide-react';

function Attendance() {
  const [activeTab, setActiveTab] = useState('sheet');
  const [systemHealth, setSystemHealth] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState(0);
  const [backfillMessage, setBackfillMessage] = useState('');

  const [contests, setContests] = useState([]);
  const [selectedContestId, setSelectedContestId] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [students, setStudents] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  
  // Dynamic filter states
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [availableDepts, setAvailableDepts] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [availableBatches, setAvailableBatches] = useState([]);
  
  // Upload states
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Override modal states
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideStudent, setOverrideStudent] = useState(null);
  const [overrideStatus, setOverrideStatus] = useState('present');
  const [overrideRemarks, setOverrideRemarks] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  const fetchSystemHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await axios.get('/api/health');
      setSystemHealth(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHealth(false);
    }
  };

  const fetchJobs = async () => {
    setLoadingJobs(true);
    try {
      const res = await axios.get('/api/jobs');
      if (res.data.success) {
        setJobs(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleTriggerSync = async () => {
    setError('');
    setSuccess('');
    try {
      const res = await axios.post('/api/jobs/sync');
      if (res.data.success) {
        setSuccess('Manual platform synchronization enqueued successfully.');
        fetchJobs();
      }
    } catch (e) {
      setError('Failed to trigger synchronization: ' + (e.response?.data?.message || e.message));
    }
  };

  const handleTriggerBackfill = async () => {
    setError('');
    setSuccess('');
    setIsBackfilling(true);
    setBackfillProgress(5);
    setBackfillMessage('Enqueuing attendance backfill job...');
    try {
      const res = await axios.post('/api/jobs/backfill');
      if (res.data.success) {
        const jobId = res.data.jobId;
        const poll = setInterval(async () => {
          try {
            const jobRes = await axios.get(`/api/jobs/${jobId}`);
            const job = jobRes.data.data;
            if (job) {
              setBackfillProgress(job.progress || 5);
              setBackfillMessage(job.message || 'Processing...');
              if (job.status === 'COMPLETED') {
                clearInterval(poll);
                setIsBackfilling(false);
                setSuccess('Attendance backfilled successfully!');
                setBackfillProgress(100);
                setTimeout(() => setBackfillProgress(0), 4000);
                fetchAttendanceList();
              } else if (job.status === 'FAILED') {
                clearInterval(poll);
                setIsBackfilling(false);
                setError('Backfill failed: ' + job.error);
                setBackfillProgress(0);
              }
            }
          } catch (e) {
            // ignore
          }
        }, 2000);
      }
    } catch (err) {
      setIsBackfilling(false);
      setError('Failed to trigger backfill: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleInvalidateCache = async () => {
    setError('');
    setSuccess('');
    try {
      await axios.post('/api/jobs/cache/invalidate');
      setSuccess('Analytics cache cleared successfully.');
      fetchSystemHealth();
    } catch (e) {
      setError('Failed to clear cache.');
    }
  };

  useEffect(() => {
    if (activeTab === 'sync' || activeTab === 'health') {
      fetchSystemHealth();
      fetchJobs();
      const interval = setInterval(() => {
        fetchSystemHealth();
        fetchJobs();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Fetch contests list, departments, and batches on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [contestsRes, deptsRes, batchesRes] = await Promise.all([
          axios.get('/api/contests'),
          axios.get('/api/departments?status=active'),
          axios.get('/api/students/batches')
        ]);
        if (contestsRes.data.success) {
          setContests(contestsRes.data.data);
          if (contestsRes.data.data.length > 0) {
            setSelectedContestId(contestsRes.data.data[0].id); // select latest by default
          }
        }
        if (deptsRes.data.success) {
          setAvailableDepts(deptsRes.data.data);
        }
        if (batchesRes.data.success) {
          setAvailableBatches(batchesRes.data.data);
        }
      } catch (err) {
        setError('Failed to fetch initial configuration data.');
      }
    };
    fetchInitialData();
  }, []);

  // Fetch available sections dynamically when department or batch changes
  useEffect(() => {
    const fetchAvailableSections = async () => {
      try {
        const params = { status: 'active' };
        if (selectedDept) params.department = selectedDept;
        if (selectedBatch) params.academicBatch = selectedBatch;
        const res = await axios.get('/api/students/sections', { params });
        if (res.data.success) {
          const sections = res.data.data;
          setAvailableSections(sections);
          if (selectedSection && !sections.includes(selectedSection)) {
            setSelectedSection('');
          }
        }
      } catch (err) {
        console.error('Failed to fetch sections:', err);
      }
    };
    fetchAvailableSections();
  }, [selectedDept, selectedBatch]);

  // Fetch attendance list when selected contest changes or filters change
  const fetchAttendanceList = useCallback(async () => {
    if (!selectedContestId) return;
    setLoadingList(true);
    setUploadSummary(null);
    try {
      const params = {};
      if (selectedBatch) params.batch = selectedBatch;
      if (selectedDept) params.department = selectedDept;
      if (selectedSection) params.section = selectedSection;
      const res = await axios.get(`/api/attendance/contest/${selectedContestId}`, { params });
      if (res.data.success) {
        setStudents(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch attendance sheet.');
    } finally {
      setLoadingList(false);
    }
  }, [selectedContestId, selectedBatch, selectedDept, selectedSection]);

  useEffect(() => {
    fetchAttendanceList();
  }, [fetchAttendanceList]);

  // Upload backup match list
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile || !selectedContestId) return;

    setUploading(true);
    setUploadSummary(null);
    setError('');
    setSuccess('');

    const form = new FormData();
    form.append('file', uploadFile);
    form.append('contestId', selectedContestId);

    try {
      const res = await axios.post('/api/attendance/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setSuccess('Attendance sheet imported successfully!');
        setUploadSummary(res.data);
        setUploadFile(null);
        fetchAttendanceList();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process bulk attendance file.');
    } finally {
      setUploading(false);
    }
  };

  // Open override modal
  const openOverride = (student) => {
    setOverrideStudent(student);
    setOverrideStatus(student.status === 'present' ? 'absent' : 'present');
    setOverrideRemarks('');
    setShowOverrideModal(true);
  };

  // Submit override
  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!overrideStudent || !selectedContestId) return;

    setSavingOverride(true);
    try {
      const res = await axios.post('/api/attendance/override', {
        studentId: overrideStudent.student_id,
        contestId: selectedContestId,
        status: overrideStatus,
        remarks: overrideRemarks
      });
      if (res.data.success) {
        setShowOverrideModal(false);
        setSuccess(`Successfully marked ${overrideStudent.name} as ${overrideStatus.toUpperCase()}.`);
        fetchAttendanceList();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError('Failed to save manual override.');
    } finally {
      setSavingOverride(false);
    }
  };

  // Filter students by search input and status filter
  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
                          s.register_number.includes(search) ||
                          s.leetcode_username.toLowerCase().includes(search.toLowerCase());
    
    let matchesStatus = true;
    if (filterStatus) {
      matchesStatus = s.status === filterStatus.toLowerCase();
    }
    
    return matchesSearch && matchesStatus;
  });

  const selectedContest = contests.find(c => c.id === Number(selectedContestId)) || contests.find(c => c.id === selectedContestId);
  
  // Contest Analytics Calculations
  const totalStudentsInBatch = students.length;
  const totalPresent = students.filter(s => s.status === 'present' || s.status === 'unrated contest').length;
  const attendanceRate = totalStudentsInBatch > 0 ? Math.round((totalPresent / totalStudentsInBatch) * 100) : 0;
  const averageRating = totalStudentsInBatch > 0 
    ? Math.round(students.reduce((acc, s) => acc + Number(s.current_rating || 1500), 0) / totalStudentsInBatch) 
    : 0;

  // Contest Leaderboard Calculations (Ranked by LeetCode current rating)
  const leaderboardData = students
    .filter(s => s.status === 'present' || s.status === 'unrated contest')
    .sort((a, b) => Number(b.current_rating || 1500) - Number(a.current_rating || 1500))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('sheet')}
          className={`px-4 py-2 text-sm font-semibold transition-all rounded-xl ${
            activeTab === 'sheet'
              ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Attendance Sheets
        </button>
        <button
          onClick={() => setActiveTab('sync')}
          className={`px-4 py-2 text-sm font-semibold transition-all rounded-xl ${
            activeTab === 'sync'
              ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Sync Control Dashboard
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`px-4 py-2 text-sm font-semibold transition-all rounded-xl ${
            activeTab === 'health'
              ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          System Health & Metrics
        </button>
      </div>

      {activeTab === 'sheet' && (
        <>
      {/* Header with Contest and Batch Filter Dropdowns */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">EnthraHub Contest Attendance</h1>
          <p className="text-sm text-slate-400">View and manage student registrations, participation logs, and overrides.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Contest Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider hidden md:block">Contest:</label>
            <select
              value={selectedContestId}
              onChange={(e) => setSelectedContestId(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary-500 dark:text-slate-200 shadow-sm"
            >
              {contests.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({new Date(c.date).toLocaleDateString()})</option>
              ))}
            </select>
          </div>

          {/* Department Filter Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider hidden md:block">Dept:</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary-500 dark:text-slate-200 shadow-sm"
            >
              <option value="">All Depts</option>
              {availableDepts.map(d => (
                <option key={d.id} value={d.code}>{d.code}</option>
              ))}
            </select>
          </div>

          {/* Academic Batch Filter Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider hidden md:block">Batch:</label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary-500 dark:text-slate-200 shadow-sm"
            >
              <option value="">All Batches</option>
              {availableBatches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Section Filter Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider hidden md:block">Section:</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary-500 dark:text-slate-200 shadow-sm"
            >
              <option value="">All Sections</option>
              {availableSections.map(sec => (
                <option key={sec} value={sec}>Section {sec}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-4 text-xs font-semibold text-rose-600 dark:text-rose-400 animate-fade-in">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Contest Analytics Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Students in Batch */}
        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <User className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Students in Batch</span>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-white">{totalStudentsInBatch}</span>
          </div>
        </div>

        {/* Card 2: Contest Participants (Attended) */}
        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Check className="h-6 w-6 font-bold" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Contest Participants</span>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-white">{totalPresent}</span>
          </div>
        </div>

        {/* Card 3: Attendance Percentage */}
        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Attendance Percentage</span>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-white">{attendanceRate}%</span>
          </div>
        </div>

        {/* Card 4: Average Rating */}
        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Crown className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Average Rating</span>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-white">{averageRating}</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout: Table on left, Sidebar (Leaderboard & Matcher) on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Student Attendance Record Sheet (Take 2/3) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            {/* Search and Filters inside table */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">Contest Attendance Table</h3>
              <div className="flex w-full sm:w-auto gap-2.5">
                {/* Search input */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute inset-y-0 left-3 my-auto h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, roll, or handle..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 py-2 pl-9 pr-3 text-xs outline-none focus:border-primary-500 dark:text-white"
                  />
                </div>
                {/* Filter select */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-955 px-3 py-2 text-xs font-semibold outline-none focus:border-primary-500 dark:text-slate-200"
                >
                  <option value="">All statuses</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
            </div>

            {/* Table layout */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Roll Number & Student</th>
                    <th className="px-6 py-4">Department & Sec</th>
                    <th className="px-6 py-4">LeetCode Handle</th>
                    <th className="px-6 py-4">Registered?</th>
                    <th className="px-6 py-4">Joined?</th>
                    <th className="px-6 py-4">Attendance Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-600 dark:text-slate-350">
                  {loadingList ? (
                    <tr>
                      <td colSpan="7" className="text-center py-12">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-12 text-slate-400">No student records found.</td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => {
                      const isPresent = s.status === 'present' || s.status === 'unrated contest';
                      const toggleExpand = (studentId) => {
                        setExpandedStudentId(expandedStudentId === studentId ? null : studentId);
                      };
                      return (
                        <React.Fragment key={s.student_id}>
                          <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                            <td className="px-6 py-3.5">
                              <div className="font-bold text-slate-800 dark:text-slate-200">{s.register_number}</div>
                              <div className="font-semibold text-slate-500">{s.name}</div>
                            </td>
                            <td className="px-6 py-3.5">
                              <span className="font-medium">{s.department}</span>
                              <span className="text-[10px] text-slate-450 block">Section {s.section}</span>
                            </td>
                            <td className="px-6 py-3.5">
                              <a 
                                href={`https://leetcode.com/${s.leetcode_username}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-primary-555 hover:underline font-semibold flex items-center gap-1"
                              >
                                {s.leetcode_username} <ExternalLink className="h-3 w-3 inline" />
                              </a>
                            </td>
                            <td className="px-6 py-3.5">
                              {s.registration_time ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 px-2 py-0.5 font-bold">
                                  Registered ✓
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 text-slate-400 dark:bg-slate-850 dark:text-slate-555 px-2 py-0.5 font-semibold">
                                  Not Registered
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-3.5">
                              {s.join_time ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 px-2 py-0.5 font-bold">
                                  Joined ✓
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 text-slate-400 dark:bg-slate-850 dark:text-slate-555 px-2 py-0.5 font-semibold">
                                  No Activity
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-3.5">
                              {(() => {
                                if (s.status === 'present') {
                                  return (
                                    <span className="inline-flex items-center rounded-md px-2.5 py-0.5 font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-450 border border-emerald-200/50 dark:border-emerald-900/30">
                                      Present
                                    </span>
                                  );
                                } else if (s.status === 'absent') {
                                  return (
                                    <span className="inline-flex items-center rounded-md px-2.5 py-0.5 font-bold uppercase bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-450 border border-rose-200/50 dark:border-rose-900/30">
                                      Absent
                                    </span>
                                  );
                                } else if (s.status === 'unrated contest') {
                                  return (
                                    <span className="inline-flex items-center rounded-md px-2.5 py-0.5 font-bold uppercase bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-450 border border-blue-200/50 dark:border-blue-900/30">
                                      Unrated Contest
                                    </span>
                                  );
                                } else if (s.status === 'contest in progress') {
                                  return (
                                    <span className="inline-flex items-center rounded-md px-2.5 py-0.5 font-bold uppercase bg-amber-100 text-amber-805 dark:bg-amber-950/30 dark:text-amber-450 border border-amber-200/50 dark:border-amber-900/30 animate-pulse">
                                      In Progress
                                    </span>
                                  );
                                } else if (s.status === 'waiting for rankings') {
                                  return (
                                    <span className="inline-flex items-center rounded-md px-2.5 py-0.5 font-bold uppercase bg-amber-100 text-amber-805 dark:bg-amber-950/30 dark:text-amber-450 border border-amber-200/50 dark:border-amber-900/30">
                                      Waiting for Rankings
                                    </span>
                                  );
                                } else {
                                  return (
                                    <span className="inline-flex items-center rounded-md px-2.5 py-0.5 font-bold uppercase bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {s.status}
                                    </span>
                                  );
                                }
                              })()}
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openOverride(s)}
                                  className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1 font-bold text-[10px] transition-all hover:scale-[1.02] active:scale-95 ${
                                    isPresent
                                      ? 'border-rose-200 text-rose-600 bg-rose-50/30 hover:bg-rose-50 dark:border-rose-900/30 dark:text-rose-400'
                                      : 'border-emerald-200 text-emerald-600 bg-emerald-50/30 hover:bg-emerald-50 dark:border-emerald-900/30 dark:text-emerald-400'
                                  }`}
                                >
                                  {isPresent ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                                  {isPresent ? 'Mark Absent' : 'Mark Present'}
                                </button>
                                <button
                                  onClick={() => toggleExpand(s.student_id)}
                                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                >
                                  {expandedStudentId === s.student_id ? <ChevronDown className="h-4.5 w-4.5" /> : <ChevronRight className="h-4.5 w-4.5" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedStudentId === s.student_id && (
                            <tr className="bg-slate-50/20 dark:bg-slate-900/10">
                              <td colSpan="7" className="px-6 py-4 border-t border-b border-slate-100 dark:border-slate-800/80">
                                <div className="animate-fade-in text-xs space-y-3">
                                  <h4 className="font-bold text-slate-700 dark:text-slate-300">EnthraHub Activity Log Audit Timeline</h4>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Registration Detail */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-3.5 rounded-xl shadow-sm space-y-1">
                                      <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider block">1. Registration Status</span>
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <div className={`h-2.5 w-2.5 rounded-full ${s.registration_time ? 'bg-blue-500' : 'bg-slate-350'}`}></div>
                                        <span className="font-bold">{s.registration_time ? 'Registered' : 'Not Registered'}</span>
                                      </div>
                                      <p className="text-[11px] text-slate-450 mt-1 flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5 shrink-0" />
                                        {s.registration_time ? new Date(s.registration_time).toLocaleString() : 'No registration timestamp logged.'}
                                      </p>
                                    </div>

                                    {/* Join Platform Detail */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-3.5 rounded-xl shadow-sm space-y-1">
                                      <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider block">2. Activity / Join status</span>
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <div className={`h-2.5 w-2.5 rounded-full ${s.join_time ? 'bg-emerald-500' : 'bg-slate-350'}`}></div>
                                        <span className="font-bold">{s.join_time ? 'Joined Contest' : 'No Join Log Recorded'}</span>
                                      </div>
                                      <p className="text-[11px] text-slate-450 mt-1 flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5 shrink-0" />
                                        {s.join_time ? new Date(s.join_time).toLocaleString() : 'No join click logged for this student.'}
                                      </p>
                                    </div>

                                    {/* Decision Audit */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-3.5 rounded-xl shadow-sm space-y-1">
                                      <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider block">3. Final Decision</span>
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <div className={`h-2.5 w-2.5 rounded-full ${isPresent ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                        <span className="font-bold">{isPresent ? 'Present' : 'Absent'}</span>
                                        <span className="text-[10px] text-slate-400">({s.marked_by === 'faculty' ? 'Manual Override' : 'System Auto'})</span>
                                      </div>
                                      <p className="text-[11px] text-slate-450 mt-1 flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5 shrink-0" />
                                        Updated: {s.last_updated ? new Date(s.last_updated).toLocaleString() : '—'}
                                      </p>
                                    </div>
                                  </div>

                                  {s.remarks && (
                                    <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100/60 dark:border-amber-900/30 rounded-xl p-3 text-[11px] text-amber-800 dark:text-amber-450">
                                      <span className="font-bold uppercase tracking-wider text-[9px] block mb-0.5">Faculty adjustment Remarks:</span>
                                      "{s.remarks}"
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
          </div>
        </div>

        {/* Right Column: Leaderboard & Matching engine backup (Take 1/3) */}
        <div className="space-y-6">
          {/* Contest Leaderboard Widget */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Trophy className="h-5 w-5 text-amber-500 animate-bounce" />
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white">Contest Leaderboard</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  {selectedBatch ? `Batch ${selectedBatch} Rankings` : 'All Batches combined'}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2 pl-1">Rank</th>
                    <th>Student</th>
                    <th className="text-right">Rating</th>
                    <th className="text-center pr-1">Contests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                  {leaderboardData.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-6 text-slate-400 italic">No rankings available.</td>
                    </tr>
                  ) : (
                    leaderboardData.map((item, idx) => (
                      <tr key={item.student_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="py-3 pl-1 font-extrabold text-slate-400">
                          {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                        </td>
                        <td>
                          <span className="font-bold text-slate-800 dark:text-slate-200 block truncate max-w-[120px]" title={item.name}>{item.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{item.register_number}</span>
                        </td>
                        <td className="text-right font-extrabold text-primary-600 dark:text-primary-400">
                          {Math.round(item.current_rating || 1500)}
                        </td>
                        <td className="text-center font-semibold text-slate-500 pr-1">
                          {item.contests_attended || 0}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Backup Log Upload Form */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white">Auto-Matching Engine</h3>
              <p className="text-xs text-slate-400 mt-1 leading-normal">
                Upload a LeetCode Contest Ranking CSV/Excel log to backfill attendance matches for registered students.
              </p>
            </div>
            
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors">
                <CloudUpload className="h-6 w-6 text-slate-400 mb-1.5" />
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  required
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="hidden"
                  id="backup-log-file-picker"
                />
                <label 
                  htmlFor="backup-log-file-picker" 
                  className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer truncate max-w-[180px] block"
                >
                  {uploadFile ? uploadFile.name : 'Select ranking sheet'}
                </label>
              </div>
              
              <button
                type="submit"
                disabled={uploading || !uploadFile}
                className="w-full rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold py-2 text-xs transition-all shadow-md shadow-primary-500/10 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {uploading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                ) : (
                  <span>Upload & Match</span>
                )}
              </button>
            </form>

            {uploadSummary && (
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2 animate-fade-in text-[11px]">
                <h4 className="font-bold text-slate-700 dark:text-slate-350">Last Upload Summary:</h4>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Eligible:</span>
                  <span className="font-semibold">{uploadSummary.summary.totalEligibleStudents}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-500 font-semibold">Matched Present:</span>
                  <span className="font-bold text-emerald-600">{uploadSummary.summary.present}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-500 font-semibold">Absent (Unmatched):</span>
                  <span className="font-bold text-rose-600">{uploadSummary.summary.absent}</span>
                </div>
                {uploadSummary.summary.unmatchedCount > 0 && (
                  <div className="space-y-1 mt-2">
                    <span className="font-bold text-amber-500 block">Unmatched Handles ({uploadSummary.summary.unmatchedCount}):</span>
                    <div className="max-h-24 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 p-2 font-mono text-[9px] text-slate-500 dark:text-slate-400 break-all leading-normal">
                      {uploadSummary.summary.unmatchedHandles.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
        </>
      )}

      {activeTab === 'sync' && (
        <div className="space-y-6">
          {/* Sync Trigger Widgets */}
          <div className="grid gap-6 md:grid-cols-3 animate-fade-in">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Platform Synchronization</h3>
              <p className="text-xs text-slate-400 mt-1">Triggers a background job to fetch latest profile ratings and contest logs from LeetCode, CodeChef, Codeforces, and HackerRank.</p>
              <button
                onClick={handleTriggerSync}
                className="mt-4 w-full rounded-xl bg-primary-600 hover:bg-primary-500 py-2.5 text-xs font-bold text-white shadow-sm transition-all"
              >
                Sync Platform Data
              </button>
            </div>
            
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Attendance Backfill</h3>
              <p className="text-xs text-slate-400 mt-1">Scans existing platform contest history logs to dynamically backfill and correct missed or unrecorded student attendance.</p>
              <button
                onClick={handleTriggerBackfill}
                disabled={isBackfilling}
                className="mt-4 w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-2.5 text-xs font-bold text-white shadow-sm transition-all disabled:opacity-50"
              >
                {isBackfilling ? `Backfilling (${backfillProgress}%)` : 'Run Attendance Backfill'}
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Cache & Optimization</h3>
              <p className="text-xs text-slate-400 mt-1">Clears the Analytics Cache Layer immediately. The next dashboard or report load will pull fresh database computations.</p>
              <button
                onClick={handleInvalidateCache}
                className="mt-4 w-full rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 transition-all"
              >
                Clear Analytics Cache
              </button>
            </div>
          </div>

          {isBackfilling && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-2 animate-fade-in">
              <div className="flex justify-between text-xs font-semibold text-slate-500">
                <span>{backfillMessage}</span>
                <span>{backfillProgress}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-primary-600 transition-all duration-300" style={{ width: `${backfillProgress}%` }} />
              </div>
            </div>
          )}

          {/* Job Queue Status Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden animate-fade-in">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Recent Background Jobs</h3>
                <p className="text-xs text-slate-400">View progress, execution duration, and retries of background enqueued tasks.</p>
              </div>
              <button onClick={fetchJobs} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                <RefreshCw className={`h-4.5 w-4.5 ${loadingJobs ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-500">
                <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Job ID / Type</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Progress</th>
                    <th className="px-5 py-3">Created / Completed</th>
                    <th className="px-5 py-3 text-right">Retries</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-5 py-8 text-center text-slate-400 font-semibold">No recent jobs enqueued.</td>
                    </tr>
                  ) : (
                    jobs.map(j => (
                      <tr key={j.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-300">
                          <div>#{j.id} - <span className="uppercase text-[10px] tracking-wide text-primary-500">{j.type}</span></div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">{j.message}</div>
                          {j.error && <div className="text-[10px] text-rose-500 font-medium mt-0.5">{j.error}</div>}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            j.status === 'COMPLETED' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600' :
                            j.status === 'FAILED' ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-600' :
                            j.status === 'RUNNING' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 animate-pulse' :
                            'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}>
                            {j.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 max-w-[120px]">
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-primary-600 transition-all duration-300" style={{ width: `${j.progress}%` }} />
                            </div>
                            <span className="font-semibold text-slate-600 dark:text-slate-300">{j.progress}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-400">
                          <div>S: {new Date(j.createdAt).toLocaleTimeString()}</div>
                          {j.completedAt && <div>E: {new Date(j.completedAt).toLocaleTimeString()}</div>}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-600 dark:text-slate-300">
                          {j.retryCount || 0}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'health' && systemHealth && (
        <div className="space-y-6 animate-fade-in">
          {/* Health Stats Grid */}
          <div className="grid gap-6 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">System Uptime</h4>
              <p className="text-2xl font-extrabold text-slate-850 dark:text-white mt-1">{(systemHealth.uptime / 3600).toFixed(1)} hrs</p>
              <div className="text-[10px] text-slate-400 mt-2 font-medium">Uptime duration of Node backend.</div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">CPU Usage</h4>
              <p className="text-2xl font-extrabold text-slate-850 dark:text-white mt-1">{systemHealth.cpu?.usagePercent || '0.00'}%</p>
              <div className="text-[10px] text-slate-400 mt-2 font-medium">Average CPU load of process.</div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Memory RSS</h4>
              <p className="text-2xl font-extrabold text-slate-850 dark:text-white mt-1">{systemHealth.memory?.rss || 'N/A'}</p>
              <div className="text-[10px] text-slate-400 mt-2 font-medium">Heap Used: {systemHealth.memory?.heapUsed || 'N/A'}.</div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cache Hit Rate</h4>
              <p className="text-2xl font-extrabold text-slate-850 dark:text-white mt-1">{systemHealth.cache?.hitRate || '0'}%</p>
              <div className="text-[10px] text-slate-400 mt-2 font-medium">Hits: {systemHealth.cache?.hits || 0} / Misses: {systemHealth.cache?.misses || 0}.</div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Database & Latency */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Database Performance</h3>
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2 text-xs">
                <span className="text-slate-400">Database Connection</span>
                <span className={`font-bold ${systemHealth.database?.healthy ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {systemHealth.database?.healthy ? 'HEALTHY' : 'UNHEALTHY'}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2 text-xs">
                <span className="text-slate-400">Query Latency</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{systemHealth.database?.queryLatencyMs || 0} ms</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">DB Reconnects / Retries</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{systemHealth.database?.retryCount || 0}</span>
              </div>
            </div>

            {/* Platform API Latencies */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Platform API Health & Latency</h3>
              {Object.entries(systemHealth.platforms || {}).map(([platform, data]) => (
                <div key={platform} className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2 text-xs last:border-0 last:pb-0">
                  <span className="text-slate-400 uppercase font-semibold">{platform}</span>
                  <div className="flex items-center gap-4">
                    <span className={`font-bold ${data.status === 'healthy' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {data.status.toUpperCase()}
                    </span>
                    <span className="text-slate-500 font-semibold">{data.avg_latency_ms || 0} ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual Adjustment Remarks Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-5">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                Manual Attendance Override
              </h3>
              <button 
                onClick={() => setShowOverrideModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                You are marking <b>{overrideStudent.name}</b> ({overrideStudent.register_number}) as <b className={overrideStatus === 'present' ? 'text-emerald-500' : 'text-rose-500'}>{overrideStatus.toUpperCase()}</b> for {selectedContest?.name || 'this contest'}. Please state the reason for manual override.
              </p>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reason / Remarks</label>
                <textarea
                  required
                  rows="3"
                  value={overrideRemarks}
                  onChange={(e) => setOverrideRemarks(e.target.value)}
                  placeholder="e.g., Sick leave approved, Registered late but attended, Special coordinator permission..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 p-3 text-xs outline-none focus:border-primary-500 dark:text-white"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-355"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOverride || !overrideRemarks.trim()}
                  className={`rounded-xl px-5 py-2 text-xs font-semibold text-white shadow-sm flex items-center gap-1.5 ${
                    overrideStatus === 'present' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {savingOverride ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  ) : (
                    <span>Save Override</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Attendance;
