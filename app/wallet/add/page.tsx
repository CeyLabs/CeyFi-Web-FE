"use client";

import Link from "next/link";
import { useQueryState } from "nuqs";
import { Kv, PageHead, Pad, Panel, Pmi, col, tile } from "@/components/ui";
import { addMethodUrl, retParams } from "@/lib/params";

export default function AddMethodPage() {
  const [ret] = useQueryState("ret", retParams.ret);
  return (
    <>
      <PageHead title="Add payment method" back={ret ?? "/wallet"} />
      <Pad>
        <div className={col}>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <Link className={tile} href={addMethodUrl("exchange", ret)}>
              <span className="flex flex-wrap gap-1.5">
                <Pmi k="binance">B</Pmi>
                <Pmi k="bybit">B</Pmi>
                <Pmi k="kucoin">K</Pmi>
              </span>
              <b>Exchange account</b>
              <small>Binance, Bybit or KuCoin. Sell, send and pay in USDT.</small>
            </Link>
            <Link className={tile} href={addMethodUrl("justpay", ret)}>
              <span className="flex flex-wrap gap-1.5">
                <Pmi k="justpay">JustPay</Pmi>
              </span>
              <b>Bank account</b>
              <small>Connect your bank with JustPay. Pay bills in rupees, with no card needed.</small>
            </Link>
            <Link className={tile} href={addMethodUrl("card", ret)}>
              <span className="flex flex-wrap gap-1.5">
                <Pmi k="visa">VISA</Pmi>
                <Pmi k="mastercard">MC</Pmi>
                <Pmi k="amex">AMEX</Pmi>
              </span>
              <b>Debit or credit card</b>
              <small>Visa, Mastercard or Amex, for bills and reloads.</small>
            </Link>
          </div>
          <Panel className="mt-3.5 py-1.5">
            <Kv label="Sell or send USDT">Exchange account</Kv>
            <Kv label="Pay bills and reloads">Any method</Kv>
            <Kv label="Buy USDT (coming soon)">JustPay bank account only</Kv>
          </Panel>
        </div>
      </Pad>
    </>
  );
}
