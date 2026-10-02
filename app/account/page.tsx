"use client";

import { LogOut, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { Button, ButtonLink, ConfirmButton, CpLogo, Empty, Kv, LRow, Legal, ListPanel, NavKv, PageHead, Pad, Panel, SectionTitle, Stat, TitleLink, TwoCol, col } from "@/components/ui";
import { AddPayee, Verify } from "@/components/account/flows";
import { CFG, bankShort } from "@/lib/config";
import { fmt, initials, mask } from "@/lib/format";
import { daySpent, type SignInVia } from "@/lib/backend";
import { commit, resetAll, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { accountParams, accountUrl, infoUrl } from "@/lib/params";

const PROVIDERS: [SignInVia, string][] = [
  ["google", "Google"],
  ["apple", "Apple"],
  ["binance", "Binance"],
  ["phone", "Mobile number"],
  ["email", "Email"],
];

function Overview() {
  const router = useRouter();
  const { db } = useApp();
  const u = db.user!;

  return (
    <>
      <PageHead title="Account" />
      <Pad>
        <div className={col}>
          <Panel className="flex items-center gap-3.5">
            <span className="grid size-[52px] flex-none place-items-center rounded-full bg-brand text-lg font-semibold text-white">{initials(u.name)}</span>
            <div>
              <b className="text-[17px] font-medium text-ink">{u.name}</b>
              <div className="text-[12.5px] text-muted">
                {u.email}
                {u.phone && ` · ${u.phone}`}
              </div>
            </div>
          </Panel>

          <SectionTitle>Sign-in methods</SectionTitle>
          <Panel className="py-1">
            {PROVIDERS.map(([k, l]) => {
              const on = u.providers.includes(k) || (k === "email" && !!u.email && u.via === "email") || (k === "phone" && !!u.phone);
              return (
                <Kv key={k} label={l}>
                  {on ? (
                    <Stat>Connected</Stat>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        commit(() => void u.providers.push(k));
                        toast("Connected");
                      }}
                    >
                      Connect
                    </Button>
                  )}
                </Kv>
              );
            })}
          </Panel>

          <SectionTitle>Verification &amp; limits</SectionTitle>
          <Panel className="py-1">
            <Kv label="Identity">
              {db.kyc === "verified" ? (
                <Stat>Verified</Stat>
              ) : (
                <ButtonLink size="sm" href={accountUrl({ flow: "verify", ret: "/account" })}>
                  Verify now
                </ButtonLink>
              )}
            </Kv>
            <Kv label="Daily limit">
              {fmt(daySpent(db))} / {CFG.daily_limit_usdt.toLocaleString()} USDT
            </Kv>
            <Kv label="Bank accounts &amp; recipients">{db.payees.length}</Kv>
          </Panel>

          <SectionTitle
            action={
              <TitleLink href={accountUrl({ flow: "payee" })}>
                <Plus size={14} /> Add
              </TitleLink>
            }
          >
            Bank accounts &amp; recipients
          </SectionTitle>
          <ListPanel>
            {db.payees.length ? (
              db.payees.map((p) => (
                <LRow
                  key={p.id}
                  variant="w3"
                  as="div"
                  logo={<CpLogo cp={{ kind: "person", name: p.account_name }} />}
                  title={p.is_self ? "My " + bankShort(p.bank_name) : p.nickname || p.account_name}
                  sub={`${p.bank_name} ${mask(p.account_number)} · ${p.relationship}`}
                  end={
                    <ConfirmButton
                      variant="danger"
                      size="sm"
                      className="font-sans"
                      label="Remove"
                      armedLabel="Confirm"
                      onConfirm={() => commit((db) => void (db.payees = db.payees.filter((x) => x.id !== p.id)))}
                    />
                  }
                />
              ))
            ) : (
              <Empty className="py-[22px]">None yet</Empty>
            )}
          </ListPanel>

          <SectionTitle>Help</SectionTitle>
          <Panel className="py-1">
            <NavKv href="/rates" label="Exchange rates" />
            <NavKv href={infoUrl("safety")} label="Safety & compliance" />
            <NavKv href={infoUrl("fees")} label="Fees & limits" />
            <NavKv href={infoUrl("faq")} label="Help & complaints" />
          </Panel>

          <TwoCol className="mt-4">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                commit((db) => void (db.user = null));
                router.push("/signin");
              }}
            >
              <LogOut /> Sign out
            </Button>
            <ConfirmButton
              variant="danger"
              size="lg"
              label="Reset demo"
              armedLabel="Tap again"
              onConfirm={() => {
                resetAll();
                router.push("/signin");
              }}
            />
          </TwoCol>
          <Legal />
        </div>
      </Pad>
    </>
  );
}

/** Account overview, or a setup flow via `?flow=verify|payee&ret=…`. */
export default function AccountPage() {
  const [{ flow, ret, self }] = useQueryStates(accountParams);
  if (flow === "verify") return <Verify ret={ret} />;
  if (flow === "payee") return <AddPayee ret={ret} self={self} />;
  return <Overview />;
}
