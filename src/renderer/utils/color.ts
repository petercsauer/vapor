export function rgbaToHex(rgba: string): string {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return rgba;
  const r = parseInt(m[1]).toString(16).padStart(2, "0");
  const g = parseInt(m[2]).toString(16).padStart(2, "0");
  const b = parseInt(m[3]).toString(16).padStart(2, "0");
  const a = m[4] !== undefined ? Math.round(parseFloat(m[4]) * 255).toString(16).padStart(2, "0") : "ff";
  return `#${r}${g}${b}${a}`;
}
