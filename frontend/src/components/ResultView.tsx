import { useMemo, useState } from 'react';
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tab, Tabs, Typography,
} from '@mui/material';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import JsonView from './JsonView';

type Row = Record<string, unknown>;

function extractRows(data: unknown): Row[] | null {
  if (Array.isArray(data)) {
    return data.every((d) => d && typeof d === 'object') ? (data as Row[]) : null;
  }
  if (data && typeof data === 'object') {
    for (const key of ['value', 'data', 'results', 'items', 'rows', 'records']) {
      const v = (data as Row)[key];
      if (Array.isArray(v) && v.every((d) => d && typeof d === 'object')) return v as Row[];
    }
  }
  return null;
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function DataTable({ rows }: { rows: Row[] }) {
  const cols = useMemo(() => Object.keys(rows[0] ?? {}), [rows]);
  const shown = rows.slice(0, 200);
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {cols.map((c) => (
              <TableCell key={c} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                {c}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {shown.map((r, i) => (
            <TableRow key={i} hover>
              {cols.map((c) => (
                <TableCell key={c} sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cellText(r[c])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function AutoChart({ rows }: { rows: Row[] }) {
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

export default function ResultView({ data }: { data: unknown }) {
  const [tab, setTab] = useState(0);
  const rows = useMemo(() => extractRows(data), [data]);

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 36, mb: 1 }}>
        <Tab label="Table" sx={{ minHeight: 36, py: 0 }} disabled={!rows} />
        <Tab label="Chart" sx={{ minHeight: 36, py: 0 }} disabled={!rows} />
        <Tab label="JSON" sx={{ minHeight: 36, py: 0 }} />
      </Tabs>
      {tab === 0 && rows && <DataTable rows={rows} />}
      {tab === 1 && rows && <AutoChart rows={rows} />}
      {tab === 2 && <JsonView value={data} maxHeight={360} />}
      {!rows && tab !== 2 && <JsonView value={data} maxHeight={360} />}
    </Box>
  );
}
