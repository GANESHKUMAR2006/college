import React from 'react';
import { 
  StudentProgressProvider, 
  StudentSelector, 
  PlatformProgressGrid,
  useStudentProgress 
} from '../components/Progress';

function DashboardContent() {
  const { isStudent, selectedStudent } = useStudentProgress();

  return (
    <div className="space-y-6 animate-fade-in">
      {isStudent && (
        <div className="border-b border-slate-200 dark:border-slate-800 pb-5 mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">My Coding Progress</h1>
          <p className="text-sm text-slate-400">Your live statistics, ratings, and submission history across coding platforms.</p>
        </div>
      )}
      <StudentSelector />
      
      {selectedStudent ? (
        <PlatformProgressGrid />
      ) : (
        <div className="py-12 text-center text-slate-400 text-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800">
          No students found or selected.
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  return (
    <StudentProgressProvider>
      <DashboardContent />
    </StudentProgressProvider>
  );
}
