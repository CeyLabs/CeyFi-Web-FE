"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { ExternalLink, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { ReactNode } from "react";
import { Panel, fine, tile, useNow } from "./ui";
import { cn } from "cn";
import { PNAME, type Provider } from "@/lib/config";
import { checkoutQr, expiresAt } from "@/lib/api/bills";

/* Paying with USDT through an exchange's pay app: picking the exchange, then its checkout. Shared by bills and sell. */

export const PROVIDERS: Provider[] = ["binance", "bybit", "kucoin"];
/** Logos copied from CeyPay-FE. `-dark` has white lettering for the dark theme. */
const PM_LOGO: Record<Provider, string> = { binance: "/pay-methods/binance-pay", bybit: "/pay-methods/bybit-pay", kucoin: "/pay-methods/kucoin-pay" };

/** A pay partner's logo (theme-aware), e.g. in Activity rows. */
export function PayLogo({ provider, className }: { provider: Provider; className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)} title={`${PNAME[provider]} Pay`}>
      {/* eslint-disable @next/next/no-img-element -- static SVG logos; next/image adds nothing here */}
      <img src={`${PM_LOGO[provider]}-dark.svg`} alt={`${PNAME[provider]} Pay`} className="on-dark h-4 w-auto" />
      <img src={`${PM_LOGO[provider]}.svg`} alt={`${PNAME[provider]} Pay`} className="on-light h-4 w-auto" />
      {/* eslint-enable @next/next/no-img-element */}
    </span>
  );
}

/** Binance / Bybit / KuCoin Pay tiles (Base UI RadioGroup: arrow keys move between them). */
export function ProviderPicker({ value, onChange }: { value: Provider; onChange: (p: Provider) => void }) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as Provider)} aria-label="Pay with" className="grid grid-cols-3 gap-2">
      {PROVIDERS.map((k) => (
        <Radio.Root
          key={k}
          value={k}
          aria-label={`${PNAME[k]} Pay`}
          className={cn(
            tile,
            "h-16 cursor-pointer items-center justify-center p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand data-checked:border-brand data-checked:bg-brand-soft",
          )}
        >
          {/* eslint-disable @next/next/no-img-element -- static SVG logos; next/image adds nothing here */}
          <img src={`${PM_LOGO[k]}-dark.svg`} alt="" className="on-dark h-5 w-full object-contain" />
          <img src={`${PM_LOGO[k]}.svg`} alt="" className="on-light h-5 w-full object-contain" />
          {/* eslint-enable @next/next/no-img-element */}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}

type Checkout = { qrContent: string | null; checkoutLink: string | null; deepLink: string | null; expireTime: string | number | null };

/** Waiting for the user to approve in their exchange: QR (on computers), open-app button and a countdown. `children` go below. */
export function CheckoutPanel({ checkout, via, amount, sub, children }: { checkout: Checkout; via: string; amount: ReactNode; sub: ReactNode; children?: ReactNode }) {
  const now = useNow(1000);
  const exp = expiresAt(checkout);
  const left = exp ? Math.max(0, exp - now) : null;
  const mm = left !== null ? `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}` : null;
  const qr = checkoutQr(checkout);

  return (
    <Panel className="text-center">
      <div className={fine}>Approve in {via}</div>
      <div className="mt-1 font-mono text-[28px] tracking-[-.5px] text-ink">{amount}</div>
      <div className={fine}>{sub}</div>
      {qr && (
        // Scanning makes sense on a computer; on a phone the button opens the app directly.
        <div className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3 max-md:hidden">
          {qr.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- inline data URL from the backend; nothing for next/image to optimise
            <img src={qr.src} alt={`${via} QR code`} width={184} height={184} className="block size-[184px]" />
          ) : (
            <QRCodeSVG value={qr.value} size={184} />
          )}
        </div>
      )}
      <p className={cn(fine, "mt-3 max-md:hidden")}>Scan with the {via.replace(" Pay", "")} app, or open checkout below.</p>
      {checkout.checkoutLink && (
        <a
          className="mt-4 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-brand px-3.5 text-base font-medium text-white hover:bg-brand-hover"
          href={checkout.deepLink || checkout.checkoutLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open {via} <ExternalLink size={16} />
        </a>
      )}
      <div className={cn(fine, "mt-3 flex items-center justify-center gap-2")}>
        <Loader2 size={14} className="animate-spin" /> Waiting for your payment{mm && ` · expires in ${mm}`}
      </div>
      {children}
    </Panel>
  );
}
