"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import {
  Avatar,
  Button,
  ButtonLink,
  ConfirmButton,
  Empty,
  Kv,
  Legal,
  ListPanel,
  NavKv,
  Panel,
  SectionTitle,
  Stat,
  TitleLink,
  TwoCol,
  Vh,
  Xl,
  col,
  listRow,
  listRowEnd,
} from "@/components/ui";
import { AddPayee, LinkExchange, SignIn, Verify } from "@/components/account/flows";
import { CFG, PNAME } from "@/lib/config";
import { fmt, initials, mask } from "@/lib/format";
import { daySpent, monthSpent } from "@/lib/backend";
import { activeAccount, commit, resetAll, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { accountParams, accountUrl, infoUrl } from "@/lib/params";

const HelpLinks = ({ safetyLabel = "Safety" }: { safetyLabel?: string }) => (
  <>
    <NavKv href={infoUrl("safety")} label={safetyLabel} />
    <NavKv href={infoUrl("fees")} label="Fees & limits" />
    <NavKv href={infoUrl("faq")} label="Help & complaints" />
  </>
);

/** Thin usage bar. */
const Bar = ({ pct }: { pct: number }) => (
  <div className="mt-2 h-[5px] overflow-hidden rounded-[5px] bg-line-subtle">
    <i className="block h-full bg-brand" style={{ width: `${Math.min(100, pct)}%` }} />
  </div>
);

function PayeeList({ self }: { self: boolean }) {
  const { db } = useApp();
  const l = db.payees.filter((p) => p.is_self === self);
  if (!l.length) return <Empty className="py-[22px]">{self ? "No bank account yet" : "No recipients yet"}</Empty>;
  return l.map((p) => (
    <div className={listRow} key={p.id}>
      <Avatar>{initials(self ? p.bank_name : p.account_name)}</Avatar>
      <div>
        <b>{self ? p.bank_name : p.nickname || p.account_name}</b>
        <small>{self ? mask(p.account_number) : `${p.bank_name} ${mask(p.account_number)} · ${p.relationship}`}</small>
      </div>
      <div className={listRowEnd}>
        <ConfirmButton
          variant="danger"
          size="sm"
          label="Remove"
          armedLabel="Confirm remove"
          onConfirm={() => {
            commit((db) => void (db.payees = db.payees.filter((x) => x.id !== p.id)));
            toast("Removed");
          }}
        />
      </div>
    </div>
  ));
}

function Overview() {
  const router = useRouter();
  const { db, draft } = useApp();

  if (!db.user)
    return (
      <div className={col}>
        <Vh title="Account" to={false} />
        <Panel>
          <Empty title="You’re not signed in">
            Sign in to sell, send and manage your accounts.
            <br />
            <ButtonLink className="mt-3" href={accountUrl({ flow: "signin" })}>
              Sign in
            </ButtonLink>
          </Empty>
        </Panel>
        <Panel>
          <HelpLinks />
        </Panel>
        <Legal />
      </div>
    );

  const used = daySpent(db);
  const def = activeAccount(db, draft);

  return (
    <div className={col}>
      <Vh title={db.user.name} sub={db.user.email} to={false} />
      <Panel>
        <Kv label="Identity">
          {db.kyc === "verified" ? (
            <Stat>Verified</Stat>
          ) : (
            <ButtonLink size="sm" href={accountUrl({ flow: "verify" })}>
              Verify now
            </ButtonLink>
          )}
        </Kv>
        <div className="mt-2.5">
          <div className="flex justify-between text-[13px] text-muted">
            <span>Daily limit</span>
            <b className="font-medium text-ink">
              {fmt(used)} / {CFG.daily_limit_usdt.toLocaleString()} USDT
            </b>
          </div>
          <Bar pct={(used / CFG.daily_limit_usdt) * 100} />
        </div>
      </Panel>

      <SectionTitle
        action={
          <TitleLink href={accountUrl({ flow: "link" })}>
            <Plus size={14} /> Link
          </TitleLink>
        }
      >
        Exchange accounts
      </SectionTitle>
      <ListPanel>
        {db.accounts.length ? (
          db.accounts.map((a) => {
            const m = monthSpent(db, a);
            return (
              <div className={listRow} key={a.id}>
                <Xl p={a.provider} />
                <div className="flex-1">
                  <b className="flex! items-center gap-1.5">
                    {a.label} {def?.id === a.id && <Stat>Default</Stat>}
                  </b>
                  <small>
                    {PNAME[a.provider]} · ≤ {a.per_txn_limit} USDT per transfer
                  </small>
                  <Bar pct={(m / a.monthly_limit) * 100} />
                  <small>
                    {fmt(m, 0)} / {a.monthly_limit} USDT this month
                  </small>
                </div>
                <div className={listRowEnd}>
                  {def?.id !== a.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        commit((_, d) => void (d.account = a.id));
                        toast("Default updated");
                      }}
                    >
                      Make default
                    </Button>
                  )}
                  <ConfirmButton
                    variant="danger"
                    size="sm"
                    label="Remove"
                    armedLabel="Confirm remove"
                    onConfirm={() => {
                      commit((db) => void (db.accounts = db.accounts.filter((x) => x.id !== a.id)));
                      toast("Exchange account removed");
                    }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <Empty title="No exchange linked">
            <ButtonLink className="mt-2.5" href={accountUrl({ flow: "link" })}>
              Link Binance, Bybit or KuCoin
            </ButtonLink>
          </Empty>
        )}
      </ListPanel>

      <SectionTitle
        action={
          <TitleLink href={accountUrl({ flow: "payee", self: true })}>
            <Plus size={14} /> Add
          </TitleLink>
        }
      >
        My bank accounts
      </SectionTitle>
      <ListPanel>
        <PayeeList self />
      </ListPanel>
      <SectionTitle
        action={
          <TitleLink href={accountUrl({ flow: "payee" })}>
            <Plus size={14} /> Add
          </TitleLink>
        }
      >
        Recipients
      </SectionTitle>
      <ListPanel>
        <PayeeList self={false} />
      </ListPanel>
      <SectionTitle>Help</SectionTitle>
      <ListPanel className="py-1">
        <HelpLinks safetyLabel="Safety & compliance" />
      </ListPanel>
      <TwoCol className="mt-4">
        <Button
          variant="ghost"
          size="lg"
          onClick={() => {
            commit((db) => void (db.user = null));
            toast("Signed out");
            router.push("/");
          }}
        >
          Sign out
        </Button>
        <ConfirmButton
          variant="danger"
          size="lg"
          label="Reset demo"
          armedLabel="Tap again to reset"
          onConfirm={() => {
            resetAll();
            router.push("/");
          }}
        />
      </TwoCol>
      <Legal />
    </div>
  );
}

/** Account overview, or a setup flow via `?flow=signin|verify|link|payee&ret=…`. */
export default function AccountPage() {
  const [{ flow, ret, self }] = useQueryStates(accountParams);
  const { db } = useApp();
  if (flow && !db.user) return <SignIn ret={ret} />;
  if (flow === "signin") return <SignIn ret={ret} />;
  if (flow === "verify") return <Verify ret={ret} />;
  if (flow === "link") return <LinkExchange ret={ret} />;
  if (flow === "payee") return <AddPayee ret={ret} self={self} />;
  return <Overview />;
}
