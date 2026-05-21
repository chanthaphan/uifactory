import { Alert, MenuItem, Stack, TextField } from '@mui/material';
import { AppAiConfig } from '../api/client';

interface Props {
  value: AppAiConfig;
  onChange: (cfg: AppAiConfig) => void;
}

/** Editor for an app's LLM connection: the platform default provider, or the app's own provider key.
 * (External agent APIs are configured as AGENT connectors and selected per chat page.) */
export default function AiConnectionForm({ value, onChange }: Props) {
  const mode = value.mode || 'platform';

  return (
    <Stack spacing={2}>
      <TextField select size="small" label="AI connection" value={mode} onChange={(e) => onChange({ ...value, mode: e.target.value as AppAiConfig['mode'] })}>
        <MenuItem value="platform">Platform default (uses server-configured provider)</MenuItem>
        <MenuItem value="provider">This app's own provider key</MenuItem>
      </TextField>

      {mode === 'platform' && (
        <Alert severity="info">Chat &amp; AI features use whatever provider the platform administrator configured on the server.</Alert>
      )}

      {mode === 'provider' && (
        <>
          <TextField select size="small" label="Provider" value={value.provider?.name || 'openai'} onChange={(e) => onChange({ ...value, provider: { ...value.provider, name: e.target.value as never } })}>
            <MenuItem value="anthropic">Anthropic (Claude)</MenuItem>
            <MenuItem value="openai">OpenAI</MenuItem>
            <MenuItem value="azure-openai">Azure OpenAI</MenuItem>
          </TextField>
          <TextField size="small" label="API key" type="password" placeholder="leave blank to keep existing" value={value.provider?.apiKey || ''} onChange={(e) => onChange({ ...value, provider: { ...value.provider!, apiKey: e.target.value } })} />
          <TextField size="small" label="Model / deployment" placeholder="e.g. gpt-4o or claude-sonnet-4-6" value={value.provider?.model || ''} onChange={(e) => onChange({ ...value, provider: { ...value.provider!, model: e.target.value } })} />
          {value.provider?.name === 'azure-openai' && (
            <TextField size="small" label="Azure endpoint" placeholder="https://<resource>.openai.azure.com" value={value.provider?.endpoint || ''} onChange={(e) => onChange({ ...value, provider: { ...value.provider!, endpoint: e.target.value } })} />
          )}
        </>
      )}
    </Stack>
  );
}
