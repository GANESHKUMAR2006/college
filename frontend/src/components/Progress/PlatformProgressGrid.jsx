import React, { Suspense } from 'react';
import { platformRegistry } from './platformRegistry';
import ErrorBoundary from '../common/ErrorBoundary';
import { useStudentProgress } from './StudentProgressContext';

function ProgressSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm animate-pulse space-y-4">
      <div className="flex gap-4">
        <div className="h-12 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-xl w-1/3" />
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-xl w-1/4" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
      <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
    </div>
  );
}

export default function PlatformProgressGrid() {
  const { selectedStudent } = useStudentProgress();
  const resetKey = selectedStudent?.id || '';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {platformRegistry.map((platform) => {
        const Component = platform.component;
        return (
          <ErrorBoundary key={platform.id} name={platform.title} resetKey={resetKey}>
            <Suspense fallback={<ProgressSkeleton />}>
              <Component />
            </Suspense>
          </ErrorBoundary>
        );
      })}
    </div>
  );
}
