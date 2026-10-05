"use client";

import { Plus } from "lucide-react";
import { Button, CpLogo, Empty, LRow, ListPanel, PageHead, Pad, SectionTitle, Stat, col } from "../ui";
import { Pending } from "../bills/shared";
import { BANK_STATUS, bankLabel } from "@/lib/api/sell";
import { useSelectedBank } from "@/hooks/sell";
import { tradeUrl } from "@/lib/params";
import { openAddBank } from "@/lib/add-bank";

/** Choose which of your bank accounts the rupees go to. */
export function BankPicker({ onDone }: { onDone: () => void }) {
  const { data, error, refetch, bank: cur, select } = useSelectedBank();

  return (
    <>
      <PageHead title="Pay out to" back={tradeUrl({ tab: "sell" })} />
      {!data ? (
        <Pending error={error} onRetry={() => refetch()} label="Loading your bank accounts" />
      ) : (
        <Pad>
          <div className={col}>
            <ListPanel>
              {data.length ? (
                data.map((b) => {
                  const st = BANK_STATUS[b.status];
                  return (
                    <LRow
                      key={b.id}
                      variant="w3"
                      onClick={() => {
                        select(b.id);
                        onDone();
                      }}
                      logo={<CpLogo cp={{ kind: "person", name: b.accountName }} />}
                      title={b.bankName ?? "Bank"}
                      sub={b.status === "REJECTED" && b.rejectionReason ? b.rejectionReason : bankLabel(b)}
                      end={
                        st ? (
                          <Stat tone={st.tone} className="font-sans">
                            {st.label}
                          </Stat>
                        ) : (
                          cur?.id === b.id && <Stat className="font-sans">Selected</Stat>
                        )
                      }
                    />
                  );
                })
              ) : (
                <Empty>None yet</Empty>
              )}
            </ListPanel>
            <SectionTitle>Or add new</SectionTitle>
            <Button size="lg" onClick={openAddBank}>
              <Plus /> Add bank account
            </Button>
          </div>
        </Pad>
      )}
    </>
  );
}
