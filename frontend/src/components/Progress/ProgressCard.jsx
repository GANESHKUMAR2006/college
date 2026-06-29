import React from 'react';

export default function ProgressCard({ children, className = '', title, headerRight }) {
  return (
    <div className={`rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300/80 dark:hover:border-slate-700/80 hover:-translate-y-0.5 ${className}`}>
      {(title || headerRight) && (
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3.5 mb-4">
          {title && (
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              {title}
            </h3>
          )}
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
