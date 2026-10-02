"use client";

import { Plus } from "lucide-react";
import { ButtonLink, CpLogo, Empty, LRow, ListPanel, PageHead, Pad, SectionTitle, Stat, col } from "../ui";
import type { Tab } from "@/lib/config";
import { mask } from "@/lib/format";
import { accountUrl, tradeUrl } from "@/lib/params";
import { activePayee, commit, payeesFor, useApp } from "@/lib/store";

/** Choose where the rupees go. */
export function PayeePicker({ tab, onDone }: { tab: Tab; onDone: () => void }) {
  const self = tab === "sell";
  const { db, draft } = useApp();
  const l = payeesFor(db, tab);
  const cur = activePayee(db, draft, tab);

  return (
    <>
      <PageHead title={self ? "Pay out to" : "Send to"} back={tradeUrl({ tab })} />
      <Pad>
        <div className={col}>
          <ListPanel>
            {l.length ? (
              l.map((p) => (
                <LRow
                  key={p.id}
                  variant="w3"
                  onClick={() => {
                    commit((_, d) => void (d.payee[tab] = p.id));
                    onDone();
                  }}
                  logo={<CpLogo cp={{ kind: "person", name: p.account_name }} />}
                  title={self ? p.bank_name : p.nickname || p.account_name}
                  sub={self ? mask(p.account_number) : `${p.bank_name} ${mask(p.account_number)} · ${p.relationship}`}
                  end={cur?.id === p.id && <Stat className="font-sans">Selected</Stat>}
                />
              ))
            ) : (
              <Empty>None yet</Empty>
            )}
          </ListPanel>
          <SectionTitle>Or add new</SectionTitle>
          <ButtonLink size="lg" href={accountUrl({ flow: "payee", self, ret: tradeUrl({ tab }) })}>
            <Plus /> {self ? "Add bank account" : "Add recipient"}
          </ButtonLink>
        </div>
      </Pad>
    </>
  );
}
