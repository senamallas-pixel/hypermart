// Strip any junk prefixed before a Cloudinary URL (legacy double-prefixed data).
export function fixImageUrl(url) {
  if (!url) return url;
  const idx = url.indexOf('https://res.cloudinary.com');
  if (idx > 0) return url.slice(idx);
  return url;
}

export default fixImageUrl;
