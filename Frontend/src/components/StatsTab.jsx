import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { getStats } from '../api/client';

const CHART_COLORS = [
  '#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981',
  '#3b82f6', '#f97316', '#14b8a6', '#a855f7', '#ef4444',
];

const ANIMATION_DURATION = 800;
const ANIMATION_EASING = 'ease-out';

function toChartData(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).map(([name, count]) => ({ name, count: Number(count) }));
}

export function StatsTab() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getStats()
      .then(setStats)
      .catch((err) => {
        setError(err.message || 'Failed to load stats');
        setStats({});
      })
      .finally(() => setLoading(false));
  }, []);

  const byCategory = toChartData(stats.byCategory);
  const byCountry = toChartData(stats.byCountry);
  const byType = toChartData(stats.byType);
  const bySources = toChartData(stats.bySources);

  if (loading) {
    return (
      <div className="animate-fade-in-up">
        <h1 className="text-xl font-semibold text-stone-100 mb-6">Stats</h1>
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in-up">
        <h1 className="text-xl font-semibold text-stone-100 mb-6">Stats</h1>
        <div className="px-4 py-3 rounded-lg bg-red-900/50 text-red-200 border border-red-700">{error}</div>
      </div>
    );
  }

  const hasData = byCategory.length > 0 || byCountry.length > 0 || byType.length > 0 || bySources.length > 0;

  if (!hasData) {
    return (
      <div className="animate-fade-in-up">
        <h1 className="text-xl font-semibold text-stone-100 mb-6">Stats</h1>
        <p className="text-slate-400 text-sm">No stats yet. Run the scraper to see statistics.</p>
      </div>
    );
  }

  const renderBarByIndex = (props) => {
    const { x, y, width, height, index = 0 } = props;
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={CHART_COLORS[index % CHART_COLORS.length]}
        rx={4}
        ry={0}
      />
    );
  };

  return (
    <div className="animate-fade-in-up">
      <h1 className="text-xl font-semibold text-stone-100 mb-6">Stats</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {byCategory.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-600 shadow-card p-6 hover:shadow-card-hover transition-all duration-300 animate-fade-in-up">
            <h2 className="text-base font-semibold text-slate-200 mb-4">By category</h2>
            <div className="min-h-[200px]">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={byCategory}
                  margin={{ top: 8, right: 8, left: 8, bottom: 80 }}
                  style={{ overflow: 'visible' }}
                >
                  <defs>
                    <linearGradient id="areaGradientByCategory" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.9} />
                      <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0.15} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" angle={-35} textAnchor="end" height={80} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Count"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2}
                    fill="url(#areaGradientByCategory)"
                    isAnimationActive
                    animationDuration={ANIMATION_DURATION}
                    animationEasing={ANIMATION_EASING}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {byCountry.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-600 shadow-card p-6 hover:shadow-card-hover transition-all duration-300 animate-fade-in-up">
            <h2 className="text-base font-semibold text-slate-200 mb-4">By country</h2>
            <div className="min-h-[200px]">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={byCountry}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, count }) => `${name}: ${count}`}
                    isAnimationActive
                    animationDuration={ANIMATION_DURATION}
                    animationEasing={ANIMATION_EASING}
                  >
                    {byCountry.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {byType.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-600 shadow-card p-6 hover:shadow-card-hover transition-all duration-300 animate-fade-in-up">
            <h2 className="text-base font-semibold text-slate-200 mb-4">Chain vs Independent</h2>
            <div className="min-h-[200px]">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={byType}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, count }) => `${name}: ${count}`}
                    isAnimationActive
                    animationDuration={ANIMATION_DURATION}
                    animationEasing={ANIMATION_EASING}
                  >
                    {byType.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {bySources.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-600 shadow-card p-6 hover:shadow-card-hover transition-all duration-300 animate-fade-in-up">
            <h2 className="text-base font-semibold text-slate-200 mb-4">By source</h2>
            <div className="min-h-[200px]">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={bySources} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Count"
                    shape={renderBarByIndex}
                    isAnimationActive
                    animationDuration={ANIMATION_DURATION}
                    animationEasing={ANIMATION_EASING}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
