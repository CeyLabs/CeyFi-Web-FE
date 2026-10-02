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
export const mask4 = (a: string) => String(a).slice(-4);
export const mask = (a: string) => "•••" + mask4(a);
/** "0771234567" → "077 123 4567" */
export const phone = (m: string) => m.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3");
/** Stable hue for a name, for generated avatars. */
export const hue = (s: string) => {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

export const dLong = (t: number | string) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
export const dShort = (t: number | string) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
export const dTime = (t: number | string) =>
  new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
export const dMonth = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", year: "numeric" });
