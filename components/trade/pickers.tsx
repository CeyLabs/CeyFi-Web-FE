"use client";

import { Plus } from "lucide-react";
import { Avatar, ButtonLink, Empty, ListPanel, Stat, Vh, Xl, col, listRow, listRowAction, listRowEnd } from "../ui";
import { cn } from "cn";
import { PNAME, type Tab } from "@/lib/config";
import { fmt, initials, mask } from "@/lib/format";
import { monthSpent } from "@/lib/backend";
import { accountUrl, tradeUrl } from "@/lib/params";
import { activeAccount, activePayee, commit, payeesFor, useApp } from "@/lib/store";

/** Choose where the rupees go. */
export function PayeePicker({ tab, onDone }: { tab: Tab; onDone: () => void }) {
  const self = tab === "sell";
  const { db, draft } = useApp();
  const l = payeesFor(db, tab);
  const cur = activePayee(db, draft, tab);

  return (
    <div className={col}>
      <Vh title={self ? "Pay out to" : "Send to"} sub={self ? "Your bank accounts" : "Your recipients"} to={onDone} />
      <ListPanel>
        {l.length ? (
          l.map((p) => (
            <button
              key={p.id}
              className={cn(listRow, listRowAction)}
              onClick={() => {
                commit((_, d) => void (d.payee[tab] = p.id));
                onDone();
              }}
            >
              <Avatar>{initials(p.account_name)}</Avatar>
              <div>
                <b>{self ? p.bank_name : p.nickname || p.account_name}</b>
                <small>{self ? mask(p.account_number) : `${p.bank_name} ${mask(p.account_number)} · ${p.relationship}`}</small>
              </div>
              <div className={listRowEnd}>{cur?.id === p.id && <Stat>Selected</Stat>}</div>
            </button>
          ))
        ) : (
          <Empty>None yet</Empty>
        )}
      </ListPanel>
      <ButtonLink size="lg" className="mt-3" href={accountUrl({ flow: "payee", self, ret: tradeUrl({ tab }) })}>
        <Plus size={18} /> {self ? "Add bank account" : "Add recipient"}
      </ButtonLink>
    </div>
  );
}

/** Choose which exchange account pays. */
export function AccountPicker({ tab, onDone }: { tab: Tab; onDone: () => void }) {
  const { db, draft } = useApp();
  const cur = activeAccount(db, draft);

  return (
    <div className={col}>
      <Vh title="Pay from" sub="Exchange accounts with a CeyPay Direct Debit contract" to={onDone} />
      <ListPanel>
        {db.accounts.map((a) => (
          <button
            key={a.id}
            className={cn(listRow, listRowAction)}
            onClick={() => {
              commit((_, d) => void (d.account = a.id));
              onDone();
            }}
          >
            <Xl p={a.provider} />
            <div>
              <b>{a.label}</b>
              <small>
                {PNAME[a.provider]} · {fmt(monthSpent(db, a), 0)}/{a.monthly_limit} USDT this month
              </small>
            </div>
            <div className={listRowEnd}>{cur?.id === a.id && <Stat>Selected</Stat>}</div>
          </button>
        ))}
      </ListPanel>
      <ButtonLink size="lg" className="mt-3" href={accountUrl({ flow: "link", ret: tradeUrl({ tab }) })}>
        <Plus size={18} /> Link an exchange account
      </ButtonLink>
    </div>
  );
}
