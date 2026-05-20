import { Box } from '@mui/material';

export default function JsonView({ value, maxHeight = 320 }: { value: unknown; maxHeight?: number | string }) {
  let text: string;
  try {
    text = JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 1.5,
        bgcolor: '#0f172a',
        color: '#e2e8f0',
        borderRadius: 1,
        fontSize: 12.5,
        lineHeight: 1.5,
        overflow: 'auto',
        maxHeight,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      {text}
    </Box>
  );
}
