import { useEffect, useState } from 'react';
import {
  Autocomplete, Box, Chip, FormControl, FormControlLabel, IconButton, MenuItem, Radio, RadioGroup,
  Select, Stack, TextField, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { api, OrgMember, Visibility } from '../api/client';

export interface ShareMember {
  email: string;
  role: 'editor' | 'viewer';
}

interface Props {
  visibility: Visibility;
  members: ShareMember[];
  ownerEmail: string;
  onChange: (next: { visibility: Visibility; members: ShareMember[] }) => void;
}

export default function ShareSettings({ visibility, members, ownerEmail, onChange }: Props) {
  const [options, setOptions] = useState<OrgMember[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => api.searchOrg(query).then(setOptions).catch(() => setOptions([])), 200);
    return () => clearTimeout(t);
  }, [query]);

  const addMember = (email: string) => {
    const e = email.toLowerCase().trim();
    if (!e || e === ownerEmail.toLowerCase() || members.some((m) => m.email.toLowerCase() === e)) return;
    onChange({ visibility, members: [...members, { email: e, role: 'viewer' }] });
  };
  const setRole = (email: string, role: 'editor' | 'viewer') =>
    onChange({ visibility, members: members.map((m) => (m.email === email ? { ...m, role } : m)) });
  const removeMember = (email: string) =>
    onChange({ visibility, members: members.filter((m) => m.email !== email) });

  return (
    <Stack spacing={2}>
      <FormControl>
        <Typography variant="subtitle2" gutterBottom>Visibility</Typography>
        <RadioGroup value={visibility} onChange={(e) => onChange({ visibility: e.target.value as Visibility, members })}>
          <FormControlLabel value="private" control={<Radio size="small" />} label="Private — only people you add below" />
          <FormControlLabel value="org" control={<Radio size="small" />} label="Organization — anyone signed in can use it" />
          <FormControlLabel value="public" control={<Radio size="small" />} label="Public — listed for everyone" />
        </RadioGroup>
      </FormControl>

      <Box>
        <Typography variant="subtitle2" gutterBottom>Share with specific people</Typography>
        <Autocomplete
          freeSolo
          options={options}
          getOptionLabel={(o) => (typeof o === 'string' ? o : `${o.name} <${o.email}>`)}
          inputValue={query}
          onInputChange={(_, v) => setQuery(v)}
          onChange={(_, v) => {
            if (v && typeof v !== 'string') addMember(v.email);
            else if (typeof v === 'string') addMember(v);
            setQuery('');
          }}
          renderInput={(params) => <TextField {...params} size="small" placeholder="Search org members by name or email…" />}
        />
        <Stack spacing={1} mt={1.5}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Chip size="small" label="owner" color="primary" />
            <Typography variant="body2">{ownerEmail}</Typography>
          </Stack>
          {members.map((m) => (
            <Stack key={m.email} direction="row" alignItems="center" spacing={1}>
              <Select size="small" value={m.role} onChange={(e) => setRole(m.email, e.target.value as 'editor' | 'viewer')} sx={{ width: 110 }}>
                <MenuItem value="viewer">viewer</MenuItem>
                <MenuItem value="editor">editor</MenuItem>
              </Select>
              <Typography variant="body2" sx={{ flexGrow: 1 }}>{m.email}</Typography>
              <IconButton size="small" onClick={() => removeMember(m.email)}><DeleteOutlineIcon fontSize="small" /></IconButton>
            </Stack>
          ))}
          {members.length === 0 && <Typography variant="caption" color="text.secondary">No individual members added.</Typography>}
        </Stack>
      </Box>
    </Stack>
  );
}
