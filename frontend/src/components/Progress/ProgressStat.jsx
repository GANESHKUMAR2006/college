import React, { useState, useEffect } from 'react';

function AnimatedCounter({ value, duration = 800 }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (typeof value !== 'number') {
      setCount(value);
      return;
    }

    let startTimestamp = null;
    const startValue = 0;
    const endValue = value;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * (endValue - startValue) + startValue));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCount(endValue);
      }
    };

    window.requestAnimationFrame(step);
  }, [value, duration]);

  return <span>{count}</span>;
}

export default function ProgressStat({ label, value, icon, subtext, color = 'primary' }) {
  const colorClasses = {
    primary: 'bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400',
    blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
  };

  const bgIconClass = colorClasses[color] || colorClasses.primary;

  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 p-4 transition-all hover:scale-[1.01]">
      {icon && (
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${bgIconClass}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
          {label}
        </span>
        <span className="text-xl font-extrabold text-slate-800 dark:text-white block mt-0.5">
          {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
        </span>
        {subtext && (
          <span className="text-[10px] text-slate-400 block mt-0.5 truncate">{subtext}</span>
        )}
      </div>
    </div>
  );
}
