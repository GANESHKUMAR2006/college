import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Self-register the required chart elements
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * Line Chart for Rating Trend
 */
export const RatingTrendChart = React.memo(function RatingTrendChart({ data = [], label = 'Rating', color = '#3b82f6' }) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-xs text-center p-4">
        No rating history available
      </div>
    );
  }

  const chartData = React.useMemo(() => ({
    labels: data.map((d, i) => d.date ? new Date(d.date).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) : `C#${i+1}`),
    datasets: [
      {
        label: label,
        data: data.map(d => d.rating),
        borderColor: color,
        backgroundColor: `${color}15`,
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: color,
        pointHoverRadius: 6
      }
    ]
  }), [data, label, color]);

  const options = React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `Rating: ${ctx.parsed.y}`
        }
      }
    },
    scales: {
      y: {
        grid: { color: 'rgba(200, 200, 200, 0.05)' },
        ticks: { font: { size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 9 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 8 }
      }
    }
  }), []);

  return <Line data={chartData} options={options} />;
});

/**
 * Bar Chart for Topic Distribution
 */
export const TopicDistributionChart = React.memo(function TopicDistributionChart({ data = [], color = '#6366f1' }) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-xs text-center p-4">
        No topic distribution data
      </div>
    );
  }

  const chartData = React.useMemo(() => ({
    labels: data.map(d => d.name),
    datasets: [
      {
        label: 'Solved',
        data: data.map(d => d.value),
        backgroundColor: color,
        borderRadius: 4,
        hoverBackgroundColor: `${color}dd`
      }
    ]
  }), [data, color]);

  const options = React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(200, 200, 200, 0.05)' },
        ticks: { font: { size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 9 }, autoSkip: false }
      }
    }
  }), []);

  return <Bar data={chartData} options={options} />;
});

/**
 * Doughnut Chart for Language Distribution
 */
export const LanguageDoughnutChart = React.memo(function LanguageDoughnutChart({ data = [] }) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-xs text-center p-4">
        No language usage data
      </div>
    );
  }

  const colors = React.useMemo(() => ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'], []);

  const chartData = React.useMemo(() => ({
    labels: data.map(d => d.name),
    datasets: [
      {
        data: data.map(d => d.value),
        backgroundColor: colors.slice(0, data.length),
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.05)'
      }
    ]
  }), [data, colors]);

  const options = React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 10,
          font: { size: 9 },
          color: '#94a3b8'
        }
      }
    },
    cutout: '60%'
  }), []);

  return <Doughnut data={chartData} options={options} />;
});

/**
 * Custom Heatmap for Submission History (GitHub Style Grid)
 */
export const SubmissionHeatmap = React.memo(function SubmissionHeatmap({ data = {} }) {
  const columns = 53; // 53 weeks (approximately 365 days)

  // Normalize data keys (both Unix timestamps in seconds and YYYY-MM-DD strings)
  const normalizedData = React.useMemo(() => {
    if (!data) return {};
    const normalized = {};
    Object.entries(data).forEach(([key, val]) => {
      const timestamp = Number(key);
      if (!isNaN(timestamp) && timestamp > 1000000) {
        const date = new Date(timestamp * 1000);
        const dateStr = date.toISOString().split('T')[0];
        normalized[dateStr] = (normalized[dateStr] || 0) + val;
      } else {
        normalized[key] = val;
      }
    });
    return normalized;
  }, [data]);

  const hasHistory = React.useMemo(() => {
    return Object.keys(normalizedData).length > 0 && Object.values(normalizedData).some(v => v > 0);
  }, [normalizedData]);

  const weeks = React.useMemo(() => {
    if (!hasHistory) return [];
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - (columns * 7) + 1);

    // Align startDate to the start of the week (Sunday)
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    const generatedWeeks = [];
    let currentDate = new Date(startDate);

    for (let w = 0; w < columns; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const count = normalizedData[dateStr] || 0;
        days.push({ date: new Date(currentDate), dateStr, count });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      generatedWeeks.push(days);
    }
    return generatedWeeks;
  }, [normalizedData, hasHistory]);

  const getIntensityClass = React.useCallback((count) => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800/40';
    if (count <= 2) return 'bg-emerald-200 dark:bg-emerald-900/30';
    if (count <= 4) return 'bg-emerald-400 dark:bg-emerald-700/50';
    if (count <= 8) return 'bg-emerald-600 dark:bg-emerald-600';
    return 'bg-emerald-800 dark:bg-emerald-400';
  }, []);

  if (!hasHistory) {
    return (
      <div className="h-28 flex items-center justify-center text-slate-400 text-xs text-center p-4 w-full">
        No submission history available
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      <div className="flex gap-[3px] overflow-x-auto w-full pb-2">
        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="flex flex-col gap-[3px] flex-shrink-0">
            {week.map((day, dIdx) => (
              <div
                key={dIdx}
                className={`h-[9.5px] w-[9.5px] rounded-[1.5px] transition-all hover:scale-125 ${getIntensityClass(day.count)}`}
                title={`${day.count} submissions on ${day.date.toLocaleDateString()}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end w-full gap-1.5 mt-1 text-[9px] text-slate-400">
        <span>Less</span>
        <div className="h-[8px] w-[8px] rounded-[1px] bg-slate-100 dark:bg-slate-800/40" />
        <div className="h-[8px] w-[8px] rounded-[1px] bg-emerald-200 dark:bg-emerald-900/30" />
        <div className="h-[8px] w-[8px] rounded-[1px] bg-emerald-400 dark:bg-emerald-700/50" />
        <div className="h-[8px] w-[8px] rounded-[1px] bg-emerald-600 dark:bg-emerald-600" />
        <div className="h-[8px] w-[8px] rounded-[1px] bg-emerald-800 dark:bg-emerald-400" />
        <span>More</span>
      </div>
    </div>
  );
});
