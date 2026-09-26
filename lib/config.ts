export const CFG = {
  fee_pct: 1.5,
  min_usdt: 5,
  daily_limit_usdt: 2000,
  tol_pct: 0.5,
  base_rate: 300,
  company: "CeylonCash PVT LTD",
  reg_no: "[PV 000000]",
  reg_status: "[to be confirmed under Sri Lanka’s VASP framework]",
  support: "support@ceypay.io",
  relationships: ["Family", "Spouse", "Parent", "Child", "Sibling", "Friend", "Employee", "Business", "Other"],
  purposes: ["Family support", "Education", "Medical", "Savings", "Salary", "Business payment", "Gift", "Other"],
};

export type Provider = "binance" | "bybit" | "kucoin";
export const PNAME: Record<Provider, string> = { binance: "Binance", bybit: "Bybit", kucoin: "KuCoin" };

export type Bank = { code: number; name: string };
export const BANKS: Bank[] = [
  { code: 7010, name: "Bank of Ceylon" },
  { code: 7056, name: "Commercial Bank PLC" },
  { code: 7083, name: "Hatton National Bank PLC" },
  { code: 7135, name: "People's Bank" },
  { code: 7278, name: "Sampath Bank PLC" },
  { code: 7287, name: "Seylan Bank PLC" },
  { code: 7162, name: "Nations Trust Bank PLC" },
  { code: 7454, name: "DFCC Bank PLC" },
  { code: 7214, name: "National Development Bank PLC" },
  { code: 7719, name: "National Savings Bank" },
  { code: 7311, name: "Pan Asia Banking Corporation PLC" },
  { code: 7302, name: "Union Bank of Colombo PLC" },
].sort((a, b) => a.name.localeCompare(b.name));

export type Tab = "sell" | "send";
export const COPY = {
  sell: { title: "Sell USDT", sub: "To your own bank account", inL: "You sell", outL: "You receive", cu: [50, 100, 250, 500], cl: [10000, 25000, 50000, 100000] },
  send: { title: "Send money", sub: "To any Sri Lankan bank account", inL: "You send", outL: "They receive", cu: [50, 100, 200, 500], cl: [10000, 25000, 50000, 100000] },
} as const;

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const MOBILE_RE = /^(\+94|0)7\d{8}$/;
