import React from 'react';
import { useStudentProgress } from './StudentProgressContext';

export default function StudentSelector() {
  const { selectedStudent, setSelectedStudent, students, isStudent, loading } = useStudentProgress();

  if (isStudent || loading || students.length === 0) return null;

  const handleSelectChange = (e) => {
    const student = students.find(s => s.id === parseInt(e.target.value));
    if (student) {
      setSelectedStudent(student);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-5 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Student Progress Dashboard</h1>
        <p className="text-sm text-slate-400">View real-time coding statistics, contest ratings, and verification details per student.</p>
      </div>
      
      <div className="relative min-w-[280px]">
        <select
          value={selectedStudent?.id || ''}
          onChange={handleSelectChange}
          aria-label="Select student to view progress"
          className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl text-slate-700 dark:text-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer shadow-sm"
        >
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name} ({student.roll_no || 'No Roll'})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
