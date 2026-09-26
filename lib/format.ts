export const fmt = (n: number | undefined | null, d = 2) =>
  Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: d, maximumFractionDigits: d });
export const lkr = (n: number | undefined | null) => "LKR " + fmt(n);
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const initials = (n: string | undefined | null) =>
  String(n || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
export const uid = (p: string) => p + Math.random().toString(16).slice(2, 12).toUpperCase();
export const mask = (a: string) => "•••" + String(a).slice(-4);

