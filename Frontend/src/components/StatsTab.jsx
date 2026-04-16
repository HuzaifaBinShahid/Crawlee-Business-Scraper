import React, { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { getStats } from '../api/client';
import { QualitySummary } from './QualitySummary';
import { Card } from './Card';
import { SectionHeading } from './SectionHeading';
import { useTheme } from '../theme/ThemeProvider';

// Rich palette tuned for both light and dark backgrounds
const PALETTE = [
  '#5e6ad2', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#0ea5e9', '#14b8a6', '#f97316',
  '#a855f7', '#ef4444', '#06b6d4', '#eab308',
];

function toEntries(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).map(([name, count]) => ({ name, value: Number(count) }));
}

function ChartCard({ title, subtitle, children, empty }) {
  return (
    <Card>
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>
      </div>
      {empty ? (
        <div className="h-64 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
          {empty}
        </div>
      ) : children}
    </Card>
  );
}

export function StatsTab() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    setLoading(true);
    getStats()
      .then(setStats)
      .catch((err) => { setError(err.message || 'Failed to load stats'); setStats({}); })
      .finally(() => setLoading(false));
  }, []);

  const byCategory = useMemo(() => toEntries(stats.byCategory).sort((a, b) => b.value - a.value), [stats.byCategory]);
  const byCountry  = useMemo(() => toEntries(stats.byCountry),  [stats.byCountry]);
  const byType     = useMemo(() => toEntries(stats.byType),     [stats.byType]);
  const bySources  = useMemo(() => toEntries(stats.bySources),  [stats.bySources]);
  const hasData = byCategory.length + byCountry.length + byType.length + bySources.length > 0;

  // Shared theming — ECharts reads computed style vars at render time
  const axisColor = isDark ? '#a1a1aa' : '#71717a';
  const gridColor = isDark ? '#1f1f23' : '#e4e4e7';
  const tooltipBg = isDark ? '#111113' : '#ffffff';
  const tooltipBorder = isDark ? '#2a2a2f' : '#e4e4e7';
  const tooltipText = isDark ? '#fafafa' : '#09090b';

  const commonTooltip = {
    backgroundColor: tooltipBg,
    borderColor: tooltipBorder,
    borderWidth: 1,
    textStyle: { color: tooltipText, fontSize: 12, fontFamily: 'DM Sans, system-ui' },
    extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 8px;',
    padding: [8, 12],
  };

  // ─── "By category" — horizontal bars with gradient and rounded corners ────
  const categoryOption = {
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...commonTooltip },
    grid: { left: 8, right: 40, top: 10, bottom: 10, containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
      axisLabel: { color: axisColor, fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: byCategory.map((d) => d.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: axisColor, fontSize: 11 },
    },
    series: [{
      type: 'bar',
      data: byCategory.map((d, i) => ({
        value: d.value,
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: {
            type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: PALETTE[i % PALETTE.length] + 'cc' },
              { offset: 1, color: PALETTE[i % PALETTE.length] },
            ],
          },
        },
      })),
      barMaxWidth: 22,
      label: {
        show: true, position: 'right',
        color: axisColor, fontSize: 11, fontWeight: 600,
      },
      emphasis: {
        itemStyle: { shadowBlur: 14, shadowColor: 'rgba(94, 106, 210, 0.35)' },
      },
    }],
  };

  // ─── "By country" — donut chart with outside labels ────────────────────────
  const countryOption = {
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    tooltip: { trigger: 'item', formatter: '{b}: <b>{c}</b> ({d}%)', ...commonTooltip },
    legend: {
      bottom: 0, itemWidth: 10, itemHeight: 10, icon: 'circle',
      textStyle: { color: axisColor, fontSize: 11 },
    },
    series: [{
      type: 'pie',
      radius: ['55%', '78%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: true,
      padAngle: 2,
      itemStyle: { borderRadius: 6, borderColor: tooltipBg, borderWidth: 2 },
      label: {
        show: true,
        formatter: '{b}\n{d}%',
        color: axisColor, fontSize: 11, lineHeight: 14,
      },
      labelLine: { length: 10, length2: 6, lineStyle: { color: gridColor } },
      data: byCountry.map((d, i) => ({ ...d, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
      emphasis: {
        scale: true, scaleSize: 6,
        itemStyle: { shadowBlur: 18, shadowColor: 'rgba(0,0,0,0.18)' },
      },
    }],
  };

  // ─── "Chain vs Independent" — donut with center number ────────────────────
  const total = byType.reduce((a, b) => a + b.value, 0);
  const typeOption = {
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    tooltip: { trigger: 'item', formatter: '{b}: <b>{c}</b> ({d}%)', ...commonTooltip },
    legend: {
      bottom: 0, itemWidth: 10, itemHeight: 10, icon: 'circle',
      textStyle: { color: axisColor, fontSize: 11 },
    },
    graphic: total > 0 ? [{
      type: 'text',
      left: 'center', top: '36%',
      style: { text: String(total), fill: tooltipText, fontSize: 28, fontWeight: 600, fontFamily: 'DM Sans, system-ui' },
    }, {
      type: 'text',
      left: 'center', top: '50%',
      style: { text: 'TOTAL', fill: axisColor, fontSize: 10, fontWeight: 600, fontFamily: 'DM Sans, system-ui' },
    }] : undefined,
    series: [{
      type: 'pie',
      radius: ['55%', '78%'],
      center: ['50%', '45%'],
      padAngle: 2,
      itemStyle: { borderRadius: 6, borderColor: tooltipBg, borderWidth: 2 },
      label: { show: false },
      data: byType.map((d, i) => ({ ...d, itemStyle: { color: PALETTE[(i + 2) % PALETTE.length] } })),
      emphasis: { scale: true, scaleSize: 6 },
    }],
  };

  // ─── "By source" — horizontal bars, consistent with category ──────────────
  const sourceOption = {
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...commonTooltip },
    grid: { left: 8, right: 40, top: 10, bottom: 10, containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { show: false }, axisTick: { show: false },
      splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
      axisLabel: { color: axisColor, fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: bySources.map((d) => d.name),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: axisColor, fontSize: 11 },
    },
    series: [{
      type: 'bar',
      data: bySources.map((d, i) => ({
        value: d.value,
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: {
            type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: PALETTE[(i + 4) % PALETTE.length] + 'cc' },
              { offset: 1, color: PALETTE[(i + 4) % PALETTE.length] },
            ],
          },
        },
      })),
      barMaxWidth: 28,
      label: { show: true, position: 'right', color: axisColor, fontSize: 11, fontWeight: 600 },
    }],
  };

  const chartStyle = { height: '280px', width: '100%' };
  const chartOpts = { renderer: 'svg' };

  return (
    <div className="py-8 px-6 md:px-8 animate-fade-in">
      <SectionHeading
        eyebrow="Analytics · Overview"
        title="Stats"
        subtitle="Aggregate metrics across collected records."
      />

      <div className="mb-6">
        <QualitySummary />
      </div>

      {loading && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>}
      {error && (
        <div
          className="px-4 py-3 rounded-md text-sm"
          style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
        >
          {error}
        </div>
      )}
      {!loading && !error && !hasData && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No stats yet. Run the scraper to see statistics.
        </p>
      )}

      {hasData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard
            title="By category"
            subtitle={`${byCategory.length} categor${byCategory.length === 1 ? 'y' : 'ies'}`}
            empty={byCategory.length === 0 ? 'No category data' : null}
          >
            {byCategory.length > 0 && (
              <ReactECharts
                key={`cat-${theme}-${byCategory.length}`}
                option={categoryOption}
                style={{ height: Math.max(200, byCategory.length * 32 + 40) + 'px' }}
                opts={chartOpts}
                notMerge
                lazyUpdate
              />
            )}
          </ChartCard>

          <ChartCard
            title="By country"
            subtitle={`${byCountry.length} countr${byCountry.length === 1 ? 'y' : 'ies'}`}
            empty={byCountry.length === 0 ? 'No country data' : null}
          >
            {byCountry.length > 0 && (
              <ReactECharts
                key={`ctry-${theme}-${byCountry.length}`}
                option={countryOption}
                style={chartStyle}
                opts={chartOpts}
                notMerge
                lazyUpdate
              />
            )}
          </ChartCard>

          <ChartCard
            title="Chain vs Independent"
            subtitle="Business type breakdown"
            empty={byType.length === 0 ? 'No business-type data' : null}
          >
            {byType.length > 0 && (
              <ReactECharts
                key={`type-${theme}-${byType.length}`}
                option={typeOption}
                style={chartStyle}
                opts={chartOpts}
                notMerge
                lazyUpdate
              />
            )}
          </ChartCard>

          <ChartCard
            title="By source"
            subtitle={`${bySources.length} source${bySources.length === 1 ? '' : 's'}`}
            empty={bySources.length === 0 ? 'No source data' : null}
          >
            {bySources.length > 0 && (
              <ReactECharts
                key={`src-${theme}-${bySources.length}`}
                option={sourceOption}
                style={chartStyle}
                opts={chartOpts}
                notMerge
                lazyUpdate
              />
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
}
