const isImageUrl = (s?: string | null): boolean => !!s && /^(https?:|\/|data:)/i.test(s.trim());

/** Build an SVG-data-URI favicon: a tinted rounded square with a letter/emoji mark (mirrors BrandLogo). */
function letterFavicon(mark: string, brandColor?: string | null): string {
  const color = (brandColor && brandColor.trim()) || '#3a64f0';
  const text = (mark || 'U').slice(0, 2);
  const fontSize = text.length > 1 ? 28 : 38;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="14" fill="${color}"/>` +
    `<text x="32" y="34" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="${fontSize}" font-weight="800" fill="#ffffff">${text}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Reflect the admin-configured platform name + logo in the browser tab (title + favicon). */
export function applyDocumentBranding(name?: string | null, logo?: string | null, brandColor?: string | null): void {
  const platform = (name && name.trim()) || 'UIFactory';
  document.title = platform;

  const href = isImageUrl(logo) ? (logo as string).trim() : letterFavicon(logo?.trim() || platform, brandColor);
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}
