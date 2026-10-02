"use client";

import { useQueryStates } from "nuqs";
import { useEffect } from "react";
import { AccountStep, FindBiller } from "@/components/bills/find";
import { BillHistory, BillsHome, SavedBillers } from "@/components/bills/home";
import { Paid, PayBill } from "@/components/bills/pay";
import { billsParams } from "@/lib/params";

/** Bill payments on one route: `?step=` picks the screen, the other params say which biller. */
export default function BillsPage() {
  const [{ step, cat, biller, acct, saved, tx }] = useQueryStates(billsParams);

  useEffect(() => {
    scrollTo(0, 0);
  }, [step]);

  switch (step) {
    case "billers":
      return <SavedBillers />;
    case "history":
      return <BillHistory />;
    case "find":
      return <FindBiller cat={cat} />;
    case "account":
      return <AccountStep key={biller} code={biller} />;
    case "pay":
      return <PayBill key={saved || `${biller}:${acct}`} saved={saved} code={biller} acct={acct} />;
    case "paid":
      return <Paid id={tx} />;
    default:
      return <BillsHome />;
  }
}
