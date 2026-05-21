import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Row = Record<string, unknown>;

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Auto bar chart from tabular rows. Isolated in its own chunk so recharts loads on demand. */
export default function ResultChart({ rows }: { rows: Row[] }) {
  const { xKey, yKey, chartData } = useMemo(() => {
    const cols = Object.keys(rows[0] ?? {});
    const numericKey = cols.find((c) => rows.every((r) => r[c] == null || typeof r[c] === 'number'));
    const labelKey = cols.find((c) => c !== numericKey);
    const data = numericKey
      ? rows.slice(0, 30).map((r) => ({ name: cellText(labelKey ? r[labelKey] : ''), value: Number(r[numericKey] ?? 0) }))
      : [];
    return { xKey: labelKey, yKey: numericKey, chartData: data };
  }, [rows]);

  if (!yKey) {
    return <Typography color="text.secondary" sx={{ p: 2 }}>No numeric column to chart.</Typography>;
  }
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {yKey} by {xKey}
      </Typography>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" fill="#3a64f0" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
