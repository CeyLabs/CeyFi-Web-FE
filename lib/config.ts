export const CFG = {
  fee_pct: 1.5,
  min_usdt: 5,
  daily_limit_usdt: 2000,
  tol_pct: 0.5,
  base_rate: 326.25,
  bill_fee: 0,
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

/** "Hatton National Bank PLC" → "HNB", for tight spaces. */
export const bankShort = (n: string) =>
  n
    .replace(/ (PLC|Bank PLC)$/, "")
    .replace(" Bank", "")
    .replace("Hatton National", "HNB")
    .replace("Commercial", "ComBank")
    .replace("National Development", "NDB")
    .replace("Nations Trust", "NTB")
    .replace("National Savings", "NSB");

export type BillCat = "electricity" | "water" | "mobile" | "internet" | "tv" | "gas" | "insurance" | "rates";
/** Bill categories in display order. `short` fits the home grid. */
export const BILL_CATS: Record<BillCat, { label: string; short: string }> = {
  electricity: { label: "Electricity", short: "Electricity" },
  water: { label: "Water", short: "Water" },
  mobile: { label: "Mobile postpaid", short: "Mobile" },
  internet: { label: "Internet", short: "Internet" },
  tv: { label: "Television", short: "TV" },
  gas: { label: "Gas (LPG)", short: "Gas" },
  insurance: { label: "Insurance", short: "Insurance" },
  rates: { label: "Assessment tax", short: "Rates" },
};

export type Biller = { code: string; name: string; cat: BillCat; varies: boolean };
export const BILLERS: Biller[] = [
  { code: "CEB", name: "Ceylon Electricity Board", cat: "electricity", varies: true },
  { code: "LECO", name: "LECO", cat: "electricity", varies: true },
  { code: "NWSDB", name: "National Water Supply", cat: "water", varies: true },
  { code: "DIALOG_PP", name: "Dialog Postpaid", cat: "mobile", varies: true },
  { code: "MOBITEL_PP", name: "Mobitel Postpaid", cat: "mobile", varies: true },
  { code: "AIRTEL_PP", name: "Airtel Postpaid", cat: "mobile", varies: true },
  { code: "HUTCH_PP", name: "Hutch Postpaid", cat: "mobile", varies: true },
  { code: "SLT", name: "SLT Broadband", cat: "internet", varies: true },
  { code: "DIALOG_BB", name: "Dialog Home Broadband", cat: "internet", varies: true },
  { code: "DIALOGTV", name: "Dialog TV", cat: "tv", varies: false },
  { code: "PEOTV", name: "PEOTV", cat: "tv", varies: false },
  { code: "LITRO", name: "Litro Gas", cat: "gas", varies: true },
  { code: "LAUGFS", name: "Laugfs Gas", cat: "gas", varies: true },
  { code: "AIA", name: "AIA Insurance", cat: "insurance", varies: false },
  { code: "SLIC", name: "Sri Lanka Insurance", cat: "insurance", varies: false },
  { code: "CEYLINCO", name: "Ceylinco Life", cat: "insurance", varies: false },
  { code: "CMC", name: "Colombo Municipal Council", cat: "rates", varies: true },
  { code: "KMC", name: "Kandy Municipal Council", cat: "rates", varies: true },
];
export const billerBy = (code: string | null | undefined) => BILLERS.find((b) => b.code === code);

/** Mobile prefix → operator, for reloads. */
export const OPS: Record<string, string> = {
  "070": "Mobitel",
  "071": "Mobitel",
  "072": "Hutch",
  "078": "Hutch",
  "074": "Dialog",
  "076": "Dialog",
  "077": "Dialog",
  "075": "Airtel",
};

export type Tab = "sell" | "send";
export const COPY = {
  sell: { title: "Sell USDT", sub: "To your own bank account", inL: "You sell", outL: "You receive", cu: [50, 100, 250, 500], cl: [10000, 25000, 50000, 100000] },
  send: { title: "Send money", sub: "To any Sri Lankan bank account", inL: "You send", outL: "They receive", cu: [50, 100, 200, 500], cl: [10000, 25000, 50000, 100000] },
} as const;

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const MOBILE_RE = /^(\+94|0)7\d{8}$/;
