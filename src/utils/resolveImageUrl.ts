export function resolveImageUrl(
  templateImageUrls: Record<string, string>,
  spriteFile: string | undefined | null
): string | null {
  if (!spriteFile) return null;

  const normalized = normalizeImageLookupKey(spriteFile);
  if (!normalized) return null;

  const basename = normalized.split('/').pop() ?? normalized;
  const candidates = [
    normalized,
    basename,
    `entities/${basename}`,
    normalized.startsWith('entities/') ? normalized.slice('entities/'.length) : `entities/${normalized}`,
  ];

  for (const candidate of candidates) {
    const direct = templateImageUrls[candidate] ?? templateImageUrls[candidate.toLowerCase()];
    if (direct) return direct;
  }

  const lowerNormalized = normalized.toLowerCase();
  const lowerBasename = basename.toLowerCase();
  const lowerCandidates = new Set(candidates.map(candidate => candidate.toLowerCase()));

  for (const [key, url] of Object.entries(templateImageUrls)) {
    const normKey = normalizeImageLookupKey(key);
    const lowerKey = normKey.toLowerCase();
    const keyBasename = normKey.split('/').pop()?.toLowerCase() ?? lowerKey;

    if (
      lowerCandidates.has(lowerKey) ||
      lowerKey === lowerNormalized ||
      keyBasename === lowerBasename
    ) {
      return url;
    }
  }

  if (basename && Object.keys(templateImageUrls).length === 0) {
    return `/entities/${basename}`;
  }

  return null;
}

export function normalizeImageLookupKey(value: string): string {
  let key = value.replace(/\\/g, '/').trim();
  key = key.replace(/^(\.\/)+/, '').replace(/^\/+/, '');

  while (key.startsWith('../')) {
    key = key.slice('../'.length);
  }

  while (key.toLowerCase().startsWith('entities/entities/')) {
    key = key.slice('entities/'.length);
  }

  return key;
}
