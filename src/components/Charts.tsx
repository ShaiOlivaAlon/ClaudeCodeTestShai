import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell
} from 'recharts';
import { SleepEntry } from '../types';
import {
  getWeeklyData,
  getTimelineBlocks,
  getDailySummary,
  formatDuration,
} from '../utils/sleepLogic';

type ChartTab = 'timeline' | 'weekly' | 'patterns';

interface ChartsProps {
  entries: SleepEntry[];
}

const TOTAL_SLEEP_TARGET_HOURS = 14;

export default function Charts({ entries }: ChartsProps) {
  const [activeChart, setActiveChart] = useState<ChartTab>('timeline');

  const tabs: { id: ChartTab; label: string }[] = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'patterns', label: 'Patterns' },
  ];

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-12 pb-4 bg-gradient-to-b from-primary-500 to-primary-600">
        <h1 className="text-white font-bold text-xl">Charts</h1>
        <p className="text-white/70 text-sm mt-0.5">Sleep patterns and insights</p>

        {/* Tab switcher inside header */}
        <div className="mt-4 bg-white/20 rounded-xl p-1 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveChart(tab.id)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-150 ${
                activeChart === tab.id
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart content */}
      <div className="flex-1 px-4 py-4">
        {activeChart === 'timeline' && <TimelineChart entries={entries} />}
        {activeChart === 'weekly' && <WeeklyChart entries={entries} />}
        {activeChart === 'patterns' && <PatternsChart entries={entries} />}
      </div>
    </div>
  );
}

// ─── Timeline Chart ───────────────────────────────────────────────────────────

function TimelineChart({ entries }: { entries: SleepEntry[] }) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const days = [
    { date: today, label: 'Today' },
    { date: yesterday, label: 'Yesterday' },
  ];

  return (
    <div className="space-y-4">
      {days.map(({ date, label }) => {
        const blocks = getTimelineBlocks(entries, date);
        const summary = getDailySummary(entries, date);

        return (
          <div key={label} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">{label}</h3>
              <span className="text-sm text-gray-500">
                {formatDuration(summary.totalSleepMs)} total
              </span>
            </div>

            {/* 24-hour timeline */}
            <div className="relative">
              {/* Time labels */}
              <div className="flex justify-between mb-1">
                {[0, 6, 12, 18, 24].map((h) => (
                  <span key={h} className="text-[10px] text-gray-400">
                    {h === 0 ? '12am' : h === 6 ? '6am' : h === 12 ? '12pm' : h === 18 ? '6pm' : '12am'}
                  </span>
                ))}
              </div>

              {/* Track */}
              <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
                {/* Night shading (6pm - 6am) */}
                <div
                  className="absolute top-0 bottom-0 bg-indigo-900/5"
                  style={{ left: 0, width: `${(6 / 24) * 100}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 bg-indigo-900/5"
                  style={{ left: `${(18 / 24) * 100}%`, right: 0 }}
                />

                {/* Sleep blocks */}
                {blocks.map((block, idx) => {
                  const left = (block.startMinute / 1440) * 100;
                  const width = (block.durationMinutes / 1440) * 100;
                  return (
                    <div
                      key={idx}
                      className={`absolute top-1 bottom-1 rounded-full transition-all ${
                        block.type === 'night' ? 'bg-indigo-800' : 'bg-primary-400'
                      }`}
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 0.8)}%`,
                      }}
                      title={`${block.type === 'night' ? 'Night' : 'Nap'}: ${block.label}`}
                    />
                  );
                })}
              </div>

              {/* Hour ticks below */}
              <div className="relative h-2 mt-0.5">
                {[6, 12, 18].map((h) => (
                  <div
                    key={h}
                    className="absolute top-0 w-px h-full bg-gray-200"
                    style={{ left: `${(h / 24) * 100}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-indigo-800" />
                <span className="text-xs text-gray-500">Night</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-primary-400" />
                <span className="text-xs text-gray-500">Nap</span>
              </div>
              {blocks.length === 0 && (
                <span className="text-xs text-gray-400 italic">No sleep logged</span>
              )}
            </div>

            {/* Blocks list */}
            {blocks.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {blocks.map((block, idx) => {
                  const startH = Math.floor(block.startMinute / 60);
                  const startM = block.startMinute % 60;
                  const endMinute = block.startMinute + block.durationMinutes;
                  const endH = Math.floor(endMinute / 60) % 24;
                  const endM = endMinute % 60;
                  const fmtTime = (h: number, m: number) => {
                    const ampm = h >= 12 ? 'pm' : 'am';
                    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
                  };
                  return (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            block.type === 'night' ? 'bg-indigo-800' : 'bg-primary-400'
                          }`}
                        />
                        <span className="text-gray-600 font-medium capitalize">{block.type}</span>
                      </div>
                      <span className="text-gray-400">
                        {fmtTime(startH, startM)} – {fmtTime(endH, endM)}
                      </span>
                      <span className="text-gray-600 font-medium">{block.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Weekly Chart ─────────────────────────────────────────────────────────────

function WeeklyChart({ entries }: { entries: SleepEntry[] }) {
  const data = getWeeklyData(entries);

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    const val = payload[0].value;
    const target = TOTAL_SLEEP_TARGET_HOURS;
    const diff = val - target;
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-sm">
        <div className="font-semibold text-gray-800 mb-1">{label}</div>
        <div className="text-gray-600">{val}h total sleep</div>
        <div className={`text-xs mt-0.5 font-medium ${diff >= 0 ? 'text-green-600' : 'text-amber-600'}`}>
          {diff >= 0 ? `+${diff.toFixed(1)}h vs target` : `${diff.toFixed(1)}h vs target`}
        </div>
      </div>
    );
  };

  return (
    <div className="card p-4">
      <div className="mb-4">
        <h3 className="font-semibold text-gray-800">Last 7 Days</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Total sleep per day · Target: {TOTAL_SLEEP_TARGET_HOURS}h
        </p>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            domain={[0, 18]}
            tickFormatter={(v) => `${v}h`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f5f3ff' }} />
          <ReferenceLine
            y={TOTAL_SLEEP_TARGET_HOURS}
            stroke="#6366f1"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{ value: 'Target', fontSize: 10, fill: '#6366f1', position: 'right' }}
          />
          <Bar dataKey="totalHours" radius={[6, 6, 0, 0]} maxBarSize={40}>
            {data.map((d, idx) => (
              <Cell
                key={idx}
                fill={d.totalHours >= TOTAL_SLEEP_TARGET_HOURS ? '#6366f1' : '#c7d2fe'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mt-2">
        {[
          {
            label: 'Avg/day',
            value: `${(data.reduce((a, d) => a + d.totalHours, 0) / data.filter(d => d.totalHours > 0).length || 0).toFixed(1)}h`,
          },
          {
            label: 'Best day',
            value: `${Math.max(...data.map(d => d.totalHours)).toFixed(1)}h`,
          },
          {
            label: 'On target',
            value: `${data.filter(d => d.totalHours >= TOTAL_SLEEP_TARGET_HOURS).length}/${data.length}d`,
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-50 rounded-xl px-3 py-2 text-center">
            <div className="text-sm font-bold text-gray-800">{stat.value}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Patterns Chart ───────────────────────────────────────────────────────────

function PatternsChart({ entries }: { entries: SleepEntry[] }) {
  const data = getWeeklyData(entries);

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ value: number; name: string; fill: string }>;
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-sm">
        <div className="font-semibold text-gray-800 mb-2">{label}</div>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-gray-600">
            <div className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
            <span>{p.name}: {p.value}h</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="card p-4">
      <div className="mb-4">
        <h3 className="font-semibold text-gray-800">Nap vs Night Sleep</h3>
        <p className="text-xs text-gray-400 mt-0.5">Breakdown by type for last 7 days</p>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            domain={[0, 18]}
            tickFormatter={(v) => `${v}h`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f5f3ff' }} />
          <Bar dataKey="nightHours" name="Night" stackId="a" fill="#312e81" radius={[0, 0, 0, 0]} maxBarSize={40} />
          <Bar dataKey="napHours" name="Naps" stackId="a" fill="#818cf8" radius={[6, 6, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-3 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-indigo-900" />
          <span className="text-xs text-gray-600 font-medium">Night Sleep</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-primary-400" />
          <span className="text-xs text-gray-600 font-medium">Naps</span>
        </div>
      </div>

      {/* Weekly averages */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="bg-indigo-50 rounded-xl px-3 py-2.5">
          <div className="text-sm font-bold text-indigo-900">
            {(data.reduce((a, d) => a + d.nightHours, 0) / 7).toFixed(1)}h
          </div>
          <div className="text-[10px] text-indigo-700/70 mt-0.5">Avg night sleep/day</div>
        </div>
        <div className="bg-primary-50 rounded-xl px-3 py-2.5">
          <div className="text-sm font-bold text-primary-700">
            {(data.reduce((a, d) => a + d.napHours, 0) / 7).toFixed(1)}h
          </div>
          <div className="text-[10px] text-primary-500/70 mt-0.5">Avg nap sleep/day</div>
        </div>
      </div>
    </div>
  );
}
