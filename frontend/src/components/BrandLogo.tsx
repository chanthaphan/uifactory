import { Box } from '@mui/material';

interface Props {
  /** Image URL, or a short letter/emoji used as the mark. */
  logo?: string | null;
  /** Hex color used as the mark background when no image is set. */
  brandColor?: string | null;
  /** Falls back to the first letters of the name when no logo is set. */
  name?: string | null;
  size?: number;
}

const isImageUrl = (s?: string | null): boolean => !!s && /^(https?:|\/|data:)/i.test(s.trim());

/** The platform logo: an image when configured, otherwise a tinted letter/emoji mark. */
export default function BrandLogo({ logo, brandColor, name, size = 30 }: Props) {
  const radius = Math.round(size * 0.4);
  if (isImageUrl(logo)) {
    return (
      <Box
        component="img"
        src={(logo as string).trim()}
        alt={name || 'logo'}
        sx={{ width: size, height: size, borderRadius: `${Math.round(size * 0.2)}px`, objectFit: 'contain', display: 'block', flexShrink: 0 }}
      />
    );
  }
  const mark = (logo?.trim() || name?.trim() || 'U').slice(0, 2);
  return (
    <Box
      sx={{
        width: size, height: size, borderRadius: `${radius}px`, flexShrink: 0,
        background: brandColor?.trim() || 'linear-gradient(135deg,#3a64f0,#7c4dff)',
        color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: Math.round(size * 0.5),
        lineHeight: 1,
      }}
    >
      {mark}
    </Box>
  );
}
