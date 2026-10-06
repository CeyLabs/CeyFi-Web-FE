"use client";

import { Landmark } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, ErrorBox, Field, Sheet, fine, inputCls, selectCls, useErrors } from "../ui";
import { cn } from "cn";
import { onAddBank } from "@/lib/add-bank";
import { useAddBank, useBankList } from "@/hooks/sell";
import { useApp } from "@/lib/store";
import { toast } from "@/lib/toast";

/** "Add your bank account" dialog, mounted once in the root layout and opened with `openAddBank()`. */
export function AddBankDialog() {
  const [open, setOpen] = useState(false);
  useEffect(() => onAddBank(() => setOpen(true)), []);
  return (
    <Sheet open={open} onClose={() => setOpen(false)} label="Add your bank account">
      {/* Remounts on each open, so the form starts fresh. */}
      {open && <AddBankForm onDone={() => setOpen(false)} />}
    </Sheet>
  );
}

/** The backend matches the holder name to the verified identity; a mismatch goes to review. */
function AddBankForm({ onDone }: { onDone: () => void }) {
  const { db } = useApp();
  const banks = useBankList();
  const add = useAddBank();
  const [bankCode, setBankCode] = useState("");
  const [acct, setAcct] = useState("");
  const [name, setName] = useState(db.user?.name || "");
  const [branch, setBranch] = useState("");
  const { errs, clear, check } = useErrors(["pb", "pa", "pn"] as const);

  const save = () => {
    const num = acct.replace(/[\s-]/g, ""),
      holder = name.trim();
    const ok = check({
      pb: bankCode ? "" : "Choose a bank",
      pa: /^\d{6,20}$/.test(num) ? "" : "Account number should be 6 to 20 digits",
      pn: holder.length >= 3 ? "" : "Enter the account holder’s name",
    });
    if (!ok || add.isPending) return;
    add.mutate(
      { bankCode: Number(bankCode), accountNumber: num, accountName: holder, branch: branch.trim() || undefined },
      {
        onSuccess: (b) => {
          toast(b.status === "VERIFIED" ? "Bank account added" : "Added. We’ll review it, as the name differs from your ID");
          onDone();
        },
      },
    );
  };

  return (
    <>
      <div className="text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-[14px] bg-brand-soft text-brand">
          <Landmark size={22} strokeWidth={1.75} />
        </span>
        <h2 className="mt-3 mb-0 text-xl font-medium tracking-[-.4px] text-ink">Add your bank account</h2>
        <p className={cn(fine, "mx-auto mt-1 max-w-[320px]")}>Rupees from your sales are paid here. It must be your own account.</p>
      </div>
      <Field id="pb" label="Bank" error={errs.pb}>
        <select className={selectCls} id="pb" aria-invalid={!!errs.pb} disabled={!banks.data} value={bankCode} onChange={(e) => (setBankCode(e.target.value), clear("pb"))}>
          <option value="">{banks.data ? "Choose bank" : banks.error ? "Couldn’t load banks" : "Loading banks…"}</option>
          {banks.data?.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id="pa" label="Account number" error={errs.pa}>
        <input className={cn(inputCls, "font-mono")} id="pa" aria-invalid={!!errs.pa} inputMode="numeric" autoComplete="off" value={acct} onChange={(e) => (setAcct(e.target.value), clear("pa"))} />
      </Field>
      <Field id="pn" label="Account holder name" error={errs.pn} hint="As registered with the bank, in the name on your ID.">
        <input className={inputCls} id="pn" aria-invalid={!!errs.pn} maxLength={255} value={name} onChange={(e) => (setName(e.target.value), clear("pn"))} />
      </Field>
      <Field id="pr" label="Branch (optional)">
        <input className={inputCls} id="pr" placeholder="e.g. Colombo 03" maxLength={255} value={branch} onChange={(e) => setBranch(e.target.value)} />
      </Field>
      <Button size="lg" className="mt-4" disabled={add.isPending} onClick={save}>
        {add.isPending ? "Saving…" : "Save"}
      </Button>
      {add.error && <ErrorBox>{add.error.message}</ErrorBox>}
    </>
  );
}
