"use client";

import { LogOut, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { Button, ButtonLink, ConfirmButton, CpLogo, Empty, Kv, LRow, Legal, ListPanel, NavKv, PageHead, Pad, Panel, SectionTitle, Stat, TwoCol, col } from "@/components/ui";
import { Verify } from "@/components/account/flows";
import { openAddBank } from "@/lib/add-bank";
import { Pending } from "@/components/bills/shared";
import { initials, lkr } from "@/lib/format";
import { BANK_STATUS, bankLabel } from "@/lib/api/sell";
import { useSignInMethods, useSignOut } from "@/hooks/auth";
import { useBanks, useRemoveBank, useSellLimits, useSetDefaultBank } from "@/hooks/sell";
import { useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { accountParams, accountUrl, infoUrl } from "@/lib/params";

function Overview() {
  const router = useRouter();
  const { db } = useApp();
  const methods = useSignInMethods();
  const { data: limits } = useSellLimits();
  const signOut = useSignOut();
  const u = db.user;
  if (!u) return null; // the frame asks for sign-in first

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
            {methods.map(({ label, linked, link }) => (
              <Kv key={label} label={label}>
                {linked ? (
                  <Stat>Connected</Stat>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => link()}>
                    Connect
                  </Button>
                )}
              </Kv>
            ))}
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
            <Kv label="Per sale">{limits ? `${lkr(limits.min)} – ${lkr(limits.max)}` : "—"}</Kv>
            <Kv label="Left today">{limits ? `${lkr(limits.remaining)} of ${lkr(limits.daily)}` : "—"}</Kv>
          </Panel>

          <BankAccounts />

          <Help />

          <TwoCol className="mt-4">
            <Button
              variant="ghost"
              size="lg"
              onClick={async () => {
                await signOut();
                toast("Signed out");
                router.push("/");
              }}
            >
              <LogOut /> Sign out
            </Button>
            <ConfirmButton
              variant="danger"
              size="lg"
              label="Reset demo"
              armedLabel="Tap again"
              onConfirm={async () => {
                await signOut({ reset: true });
                router.push("/");
              }}
            />
          </TwoCol>
          <Legal />
        </div>
      </Pad>
    </>
  );
}

/** Payout bank accounts, from the backend. Only available once identity is verified. */
function BankAccounts() {
  const { db } = useApp();
  const { data, error, refetch } = useBanks();
  const setDefault = useSetDefaultBank();
  const remove = useRemoveBank();
  const verified = db.kyc === "verified";

  return (
    <>
      <SectionTitle
        action={
          verified && (
            <button className="inline-flex items-center gap-1 font-sans text-[13px] tracking-normal text-brand normal-case" onClick={openAddBank}>
              <Plus size={14} /> Add
            </button>
          )
        }
      >
        Bank accounts
      </SectionTitle>
      <ListPanel>
        {!verified ? (
          <Empty className="py-[22px]">Verify your identity to add a bank account.</Empty>
        ) : !data ? (
          <Pending error={error} onRetry={() => refetch()} label="Loading your bank accounts" />
        ) : data.length ? (
          data.map((b) => {
            const st = BANK_STATUS[b.status];
            return (
              <LRow
                key={b.id}
                variant="w3"
                as="div"
                logo={<CpLogo cp={{ kind: "person", name: b.accountName }} />}
                title={b.accountName}
                sub={b.status === "REJECTED" && b.rejectionReason ? b.rejectionReason : bankLabel(b)}
                end={
                  <span className="flex items-center gap-1.5">
                    {st ? (
                      <Stat tone={st.tone} className="font-sans">
                        {st.label}
                      </Stat>
                    ) : b.isDefault ? (
                      <Stat className="font-sans">Default</Stat>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="font-sans"
                        disabled={setDefault.isPending}
                        onClick={() => setDefault.mutate(b.id, { onError: (e) => toast(e.message) })}
                      >
                        Make default
                      </Button>
                    )}
                    <ConfirmButton
                      variant="danger"
                      size="sm"
                      className="font-sans"
                      label="Remove"
                      armedLabel="Confirm"
                      onConfirm={() => remove.mutate(b.id, { onSuccess: () => toast("Removed"), onError: (e) => toast(e.message) })}
                    />
                  </span>
                }
              />
            );
          })
        ) : (
          <Empty className="py-[22px]">None yet. Add one to sell USDT.</Empty>
        )}
      </ListPanel>
    </>
  );
}

const Help = () => (
  <>
    <SectionTitle>Help</SectionTitle>
    <Panel className="py-1">
      <NavKv href="/rates" label="Exchange rates" />
      <NavKv href={infoUrl("safety")} label="Safety & compliance" />
      <NavKv href={infoUrl("fees")} label="Fees & limits" />
      <NavKv href={infoUrl("faq")} label="Help & complaints" />
    </Panel>
  </>
);

/** Account overview, or a setup flow via `?flow=verify|payee&ret=…`. */
export default function AccountPage() {
  const [{ flow, ret }] = useQueryStates(accountParams);
  if (flow === "verify") return <Verify ret={ret} />;
  return <Overview />;
}
