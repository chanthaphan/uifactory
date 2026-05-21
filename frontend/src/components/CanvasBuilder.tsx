import { useRef, useState } from 'react';
import {
  Box, Divider, FormControlLabel, IconButton, MenuItem, Paper, Stack, Switch, TextField, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { CanvasLayout, ComponentType, UiComponent } from '../api/client';
import { COMPONENT_CATALOG, newComponent } from './layout-compiler';

interface Props {
  layout: CanvasLayout;
  onChange: (layout: CanvasLayout) => void;
  actions: { name: string }[];
  fieldOptions: string[];
}

type DragPayload = { kind: 'new'; type: ComponentType } | { kind: 'move'; id: string };
type DropTarget = { parentId: string | null; index: number };

function removeById(comps: UiComponent[], id: string): [UiComponent[], UiComponent | null] {
  let removed: UiComponent | null = null;
  const walk = (list: UiComponent[]): UiComponent[] => {
    const out: UiComponent[] = [];
    for (const c of list) {
      if (c.id === id) { removed = c; continue; }
      out.push(c.children ? { ...c, children: walk(c.children) } : c);
    }
    return out;
  };
  return [walk(comps), removed];
}

function insertInto(comps: UiComponent[], parentId: string | null, index: number, comp: UiComponent): UiComponent[] {
  if (parentId == null) {
    const out = [...comps];
    out.splice(Math.max(0, Math.min(index, out.length)), 0, comp);
    return out;
  }
  return comps.map((c) => {
    if (c.id !== parentId) return c;
    const ch = [...(c.children || [])];
    ch.splice(Math.max(0, Math.min(index, ch.length)), 0, comp);
    return { ...c, children: ch };
  });
}

function findById(comps: UiComponent[], id: string): UiComponent | null {
  for (const c of comps) {
    if (c.id === id) return c;
    if (c.children) { const f = findById(c.children, id); if (f) return f; }
  }
  return null;
}

function updateById(comps: UiComponent[], id: string, patch: Partial<UiComponent>): UiComponent[] {
  return comps.map((c) => {
    if (c.id === id) return { ...c, ...patch, props: { ...c.props, ...(patch.props || {}) } };
    if (c.children) return { ...c, children: updateById(c.children, id, patch) };
    return c;
  });
}

export default function CanvasBuilder({ layout, onChange, actions, fieldOptions }: Props) {
  const components = layout?.components || [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragPayload = useRef<DragPayload | null>(null);

  const setComponents = (next: UiComponent[]) => onChange({ components: next });

  const handleDrop = (target: DropTarget) => {
    const payload = dragPayload.current;
    dragPayload.current = null;
    setDragOver(null);
    if (!payload) return;
    if (payload.kind === 'new') {
      const comp = newComponent(payload.type);
      if (target.parentId != null && comp.type === 'container') return; // no nested containers
      setComponents(insertInto(components, target.parentId, target.index, comp));
      setSelectedId(comp.id);
      return;
    }
    if (payload.id === target.parentId) return;
    const [tree, removed] = removeById(components, payload.id);
    if (!removed) return;
    if (target.parentId != null && removed.type === 'container') return;
    setComponents(insertInto(tree, target.parentId, target.index, removed));
  };

  const remove = (id: string) => {
    const [tree] = removeById(components, id);
    setComponents(tree);
    if (selectedId === id) setSelectedId(null);
  };

  const DropZone = ({ target }: { target: DropTarget }) => {
    const key = `${target.parentId ?? 'root'}:${target.index}`;
    return (
      <Box
        onDragOver={(e) => { e.preventDefault(); setDragOver(key); }}
        onDragLeave={() => setDragOver((k) => (k === key ? null : k))}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDrop(target); }}
        sx={{
          height: dragOver === key ? 28 : 8,
          my: 0.25, borderRadius: 1,
          bgcolor: dragOver === key ? 'primary.light' : 'transparent',
          border: dragOver === key ? '1px dashed' : '1px dashed transparent',
          borderColor: dragOver === key ? 'primary.main' : 'transparent',
          transition: 'all .1s',
        }}
      />
    );
  };

  const Block = ({ comp }: { comp: UiComponent }) => {
    const isContainer = comp.type === 'container';
    const selected = selectedId === comp.id;
    return (
      <Paper
        variant="outlined"
        draggable
        onDragStart={(e) => { e.stopPropagation(); dragPayload.current = { kind: 'move', id: comp.id }; }}
        onClick={(e) => { e.stopPropagation(); setSelectedId(comp.id); }}
        sx={{
          p: 1, cursor: 'pointer',
          borderColor: selected ? 'primary.main' : 'divider',
          borderWidth: selected ? 2 : 1,
          bgcolor: selected ? 'rgba(37,99,235,0.04)' : '#fff',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled' }} />
          <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary' }}>
            {COMPONENT_CATALOG.find((c) => c.type === comp.type)?.label || comp.type}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1, ml: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {summarize(comp)}
          </Typography>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); remove(comp.id); }}><DeleteOutlineIcon fontSize="small" /></IconButton>
        </Stack>
        {isContainer && (
          <Box sx={{ mt: 1, pl: 2, borderLeft: '2px solid', borderColor: 'divider' }}>
            <DropZone target={{ parentId: comp.id, index: 0 }} />
            {(comp.children || []).map((child, i) => (
              <Box key={child.id}>
                <Block comp={child} />
                <DropZone target={{ parentId: comp.id, index: i + 1 }} />
              </Box>
            ))}
            {(comp.children || []).length === 0 && (
              <Typography variant="caption" color="text.disabled">Drop components here</Typography>
            )}
          </Box>
        )}
      </Paper>
    );
  };

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ height: '100%' }}>
      {/* palette */}
      <Box sx={{ width: { md: 168 }, flexShrink: 0 }}>
        <Typography variant="overline" color="primary">Components</Typography>
        <Stack spacing={0.75}>
          {COMPONENT_CATALOG.map((c) => (
            <Paper
              key={c.type}
              variant="outlined"
              draggable
              onDragStart={() => { dragPayload.current = { kind: 'new', type: c.type }; }}
              onDoubleClick={() => { const comp = newComponent(c.type); setComponents([...components, comp]); setSelectedId(comp.id); }}
              title={`${c.hint} — drag onto the canvas (or double-click to append)`}
              sx={{ px: 1, py: 0.75, cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
            >
              <Typography variant="body2" fontWeight={600}>{c.label}</Typography>
            </Paper>
          ))}
        </Stack>
      </Box>

      {/* canvas */}
      <Box
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleDrop({ parentId: null, index: components.length }); }}
        sx={{ flexGrow: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: '#fafafa', overflow: 'auto', minHeight: 360 }}
      >
        <DropZone target={{ parentId: null, index: 0 }} />
        {components.map((comp, i) => (
          <Box key={comp.id}>
            <Block comp={comp} />
            <DropZone target={{ parentId: null, index: i + 1 }} />
          </Box>
        ))}
        {components.length === 0 && (
          <Box sx={{ display: 'grid', placeItems: 'center', height: 300, color: 'text.secondary', textAlign: 'center' }}>
            <Typography variant="body2">Drag components from the left (or double-click them) to build your page.</Typography>
          </Box>
        )}
      </Box>

      {/* properties */}
      <Box sx={{ width: { md: 240 }, flexShrink: 0 }}>
        <Typography variant="overline" color="secondary">Properties</Typography>
        {(() => {
          const selected = selectedId ? findById(components, selectedId) : null;
          if (!selected) return <Typography variant="caption" color="text.secondary">Select a component to edit it.</Typography>;
          const patch = (props: Record<string, unknown>) => setComponents(updateById(components, selected.id, { props }));
          return <PropsEditor comp={selected} patch={patch} actions={actions} fieldOptions={fieldOptions} />;
        })()}
      </Box>
    </Stack>
  );
}

function summarize(c: UiComponent): string {
  const p = c.props || {};
  switch (c.type) {
    case 'heading': case 'text': return String(p.text || '');
    case 'metric': return `${p.label || ''} · ${p.source || ''}`;
    case 'button': return p.action ? `→ ${p.action}` : 'no action';
    case 'chart': return `${p.chartType || 'bar'} ${p.labelField || '?'}/${p.valueField || '?'}`;
    case 'table': return p.columns && (p.columns as string[]).length ? (p.columns as string[]).join(', ') : 'auto columns';
    case 'textInput': case 'fileUpload': return `→ form.${p.key || ''}`;
    case 'container': return `${p.columns || 2} columns`;
    default: return '';
  }
}

function PropsEditor({ comp, patch, actions, fieldOptions }: {
  comp: UiComponent; patch: (props: Record<string, unknown>) => void; actions: { name: string }[]; fieldOptions: string[];
}) {
  const p = comp.props || {};
  const text = (k: string, label: string, opts: { multiline?: boolean } = {}) => (
    <TextField size="small" label={label} value={(p[k] as string) || ''} onChange={(e) => patch({ [k]: e.target.value })} multiline={opts.multiline} minRows={opts.multiline ? 2 : undefined} fullWidth />
  );
  const fieldSelect = (k: string, label: string) => (
    <TextField select size="small" label={label} value={(p[k] as string) || ''} onChange={(e) => patch({ [k]: e.target.value })} fullWidth>
      <MenuItem value="">(choose field)</MenuItem>
      {fieldOptions.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
    </TextField>
  );

  return (
    <Stack spacing={1.25} mt={1}>
      <Typography variant="caption" color="text.secondary">{COMPONENT_CATALOG.find((c) => c.type === comp.type)?.hint}</Typography>
      <Divider />
      {comp.type === 'heading' && <>
        {text('text', 'Text')}
        <TextField select size="small" label="Level" value={p.level || 2} onChange={(e) => patch({ level: Number(e.target.value) })}>
          {[1, 2, 3].map((l) => <MenuItem key={l} value={l}>H{l}</MenuItem>)}
        </TextField>
      </>}
      {comp.type === 'text' && text('text', 'Text', { multiline: true })}
      {comp.type === 'metric' && <>
        {text('label', 'Label')}
        <TextField select size="small" label="Source" value={p.source || 'count'} onChange={(e) => patch({ source: e.target.value })}>
          <MenuItem value="count">Row count</MenuItem>
          <MenuItem value="sum">Sum of field</MenuItem>
          <MenuItem value="avg">Average of field</MenuItem>
          <MenuItem value="field">First row's field</MenuItem>
          <MenuItem value="static">Static value</MenuItem>
        </TextField>
        {p.source !== 'count' && p.source !== 'static' && fieldSelect('field', 'Field')}
        {p.source === 'static' && text('value', 'Value')}
      </>}
      {comp.type === 'table' && <>
        <FormControlLabel control={<Switch checked={p.filter !== false} onChange={(e) => patch({ filter: e.target.checked })} />} label="Filter box" />
        <TextField size="small" label="Columns (comma-sep, blank = auto)" value={Array.isArray(p.columns) ? (p.columns as string[]).join(', ') : ''} onChange={(e) => patch({ columns: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} fullWidth />
      </>}
      {comp.type === 'chart' && <>
        {text('title', 'Title')}
        <TextField select size="small" label="Chart type" value={p.chartType || 'bar'} onChange={(e) => patch({ chartType: e.target.value })}>
          {['bar', 'line', 'pie'].map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
        {fieldSelect('labelField', 'Label field')}
        {fieldSelect('valueField', 'Value field')}
      </>}
      {comp.type === 'textInput' && <>
        {text('label', 'Label')}
        {text('key', 'Form key')}
        {text('placeholder', 'Placeholder')}
      </>}
      {comp.type === 'fileUpload' && <>
        {text('label', 'Label')}
        {text('key', 'Form key')}
        {text('accept', 'Accept (e.g. .csv,image/*)')}
      </>}
      {comp.type === 'button' && <>
        {text('label', 'Label')}
        <TextField select size="small" label="Action" value={(p.action as string) || ''} onChange={(e) => patch({ action: e.target.value })} fullWidth helperText={actions.length ? 'Defined in Actions below the editor' : 'Add an action first (Actions panel)'}>
          <MenuItem value="">(none)</MenuItem>
          {actions.map((a) => <MenuItem key={a.name} value={a.name}>{a.name}</MenuItem>)}
        </TextField>
        {text('paramsJson', 'Extra params (JSON)', { multiline: true })}
        {text('successMsg', 'Success message')}
      </>}
      {comp.type === 'image' && <>
        {text('src', 'Image URL')}
        {text('alt', 'Alt text')}
        <TextField size="small" type="number" label="Max width (px)" value={p.width || 240} onChange={(e) => patch({ width: Number(e.target.value) })} />
      </>}
      {comp.type === 'container' && <>
        {text('title', 'Title')}
        <TextField select size="small" label="Columns" value={p.columns || 2} onChange={(e) => patch({ columns: Number(e.target.value) })}>
          {[1, 2, 3, 4].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
        </TextField>
      </>}
      {comp.type === 'divider' && <Typography variant="caption" color="text.secondary">No options.</Typography>}
    </Stack>
  );
}
