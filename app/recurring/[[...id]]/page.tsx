"use client";

import { CirclePause, CirclePlay, CircleX, FileText, Headset, Plus, Zap } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useRef } from "react";
import { ActivityTabs } from "@/components/activity";
import { Alert, Button, ButtonLink, CpLogo, DAct, DCard, DGroup, DRow, DetailHead, Empty, LRow, ListGroup, MasterDetail, PageHead, Stat, useArmed } from "@/components/ui";
import { cn } from "cn";
import { CFG } from "@/lib/config";
import { dLong, dShort, lkr } from "@/lib/format";
import { M, USES, amountDue, isExpired, mActive, mName, newTx, nextRun, recUse, type Recurring } from "@/lib/backend";
import { activityUrl, infoUrl, recNewUrl, tradeUrl } from "@/lib/params";
import { commit, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";

const recAmt = (x: Recurring) => (x.amount ? lkr(x.amount) : "Varies with bill");

export default function RecurringPage() {
  const { id: [id] = [] } = useParams<{ id?: string[] }>();
  const { db } = useApp();
  const active = db.recurring.filter((x) => x.status !== "canceled"),
    inactive = db.recurring.filter((x) => x.status === "canceled");
  const x = id ? db.recurring.find((r) => r.id === id) : undefined;

  const row = (r: Recurring) => {
    const when = r.status === "canceled" ? "Canceled" : r.status === "paused" ? "Paused" : dShort(nextRun(r));
    return (
      <LRow
        key={r.id}
        variant="r4"
        href={`/recurring/${r.id}`}
        selected={r.id === id}
        logo={<CpLogo cp={r.cp} />}
        title={r.name}
        sub={`${when} · ${mName(M(db, r.method_id))}`}
        c2={r.status === "paused" ? <Stat tone="paused">Paused</Stat> : when}
        end={r.amount ? lkr(r.amount) : "Varies"}
      />
    );
  };

  return (
    <>
      <PageHead
        title="Activity"
        back={id ? "/recurring" : undefined}
        right={
          <ButtonLink href="/recurring/new">
            <Plus /> New
          </ButtonLink>
        }
      />
      <MasterDetail
        selected={!!x}
        placeholder="Select a recurring payment to see the details"
        list={
          <>
          <ActivityTabs on="recurring" />
          {db.recurring.length ? (
            <>
              <ListGroup>Active</ListGroup>
              {active.length ? active.map(row) : <div className="px-4 py-2 text-[12.5px] text-muted">None</div>}
              {inactive.length > 0 && (
                <>
                  <ListGroup>Inactive</ListGroup>
                  {inactive.map(row)}
                </>
              )}
            </>
          ) : (
            <Empty title="No recurring payments">
              Autopay your bills, top up a mobile every month, or send money home on a schedule.
              <br />
              <ButtonLink href="/recurring/new" className="mt-3">
                Set up recurring
              </ButtonLink>
            </Empty>
          )}
          </>
        }
        detail={x && <RecDetail key={x.id} x={x} />}
      />
    </>
  );
}

function RecDetail({ x }: { x: Recurring }) {
  const router = useRouter();
  const { db } = useApp();
  const m = M(db, x.method_id);
  const runs = db.tx.filter((t) => t.recurring_id === x.id).length;
  const opts = db.methods.filter((pm) => USES[pm.type].includes(recUse(x)));
  const canceled = x.status === "canceled";
  const select = useRef<HTMLSelectElement>(null);
  const [armed, cancel] = useArmed(() => {
    commit(() => {
      x.status = "canceled";
      x.canceled = Date.now();
    });
    toast("Canceled");
  });

  const payNow = () => {
    if (!m || !mActive(m)) return toast("Choose a valid payment method first");
    if (x.type === "remit") {
      commit((_, d) => {
        d.incur = "LKR";
        d.amount = String(x.amount);
        d.payee.send = x.payee_id || null;
        d.account = m.id;
        d.q = null;
      });
      router.push(tradeUrl({ tab: "send" }));
      return;
    }
    const amt = amountDue(x);
    const t = commit((db) =>
      newTx(db, { kind: "reload", cp: x.cp, method_id: m.id, lkr: amt, fee_lkr: CFG.reload_fee, account: x.account, state: "processing", recurring_id: x.id }),
    )!;
    router.push(`/activity/${t.id}`);
  };

  return (
    <>
      <DetailHead logo={<CpLogo cp={x.cp} big />} title={x.name} sub={x.plan} />
      {m && isExpired(m) && !canceled && (
        <Alert
          action={
            <Button size="sm" className="bg-err hover:bg-err" onClick={() => select.current?.focus()}>
              Change
            </Button>
          }
        >
          The card for this payment has expired
        </Alert>
      )}
      <DCard>
        <DRow label={canceled ? "Status" : "Expected on"}>
          {canceled ? `Canceled ${x.canceled ? dShort(x.canceled) : ""}` : x.status === "paused" ? "Paused" : dLong(nextRun(x))}
        </DRow>
        <DRow label="Details">
          {x.amount ? `${lkr(x.amount)} ${x.freq === "weekly" ? "weekly" : "monthly"}` : `Varies with usage${x.cap ? ` · up to ${lkr(x.cap)}` : ""}`}
        </DRow>
        {x.account && (
          <DRow label={x.type === "reload" ? "Mobile" : "Account"}>
            <span className="font-mono">{x.account}</span>
          </DRow>
        )}
        <DRow label="Payment">
          {canceled ? (
            mName(m)
          ) : (
            <select
              ref={select}
              className="select-chevron h-8 max-w-[210px] rounded-[10px] border border-line bg-field py-0 pr-7 pl-2 text-[13px] text-ink focus:border-brand focus:outline-none"
              value={x.method_id}
              aria-label="Payment method"
              onChange={(e) => {
                commit(() => void (x.method_id = e.target.value));
                toast("Payment method updated");
              }}
            >
              {opts.map((pm) => (
                <option key={pm.id} value={pm.id} disabled={!mActive(pm)}>
                  {mName(pm)}
                  {mActive(pm) ? "" : " (expired)"}
                </option>
              ))}
            </select>
          )}
        </DRow>
      </DCard>
      {canceled ? (
        <DAct icon={<Plus />} href={recNewUrl(x.type)}>
          Set up again
        </DAct>
      ) : (
        <>
          <DAct icon={<Zap />} onClick={payNow} right={recAmt(x)}>
            Pay now
          </DAct>
          <DGroup>
            <DAct
              icon={x.status === "paused" ? <CirclePlay /> : <CirclePause />}
              onClick={() => {
                commit(() => void (x.status = x.status === "paused" ? "active" : "paused"));
                toast(x.status === "paused" ? "Paused" : "Resumed");
              }}
            >
              {x.status === "paused" ? "Resume" : "Pause"}
            </DAct>
            <DAct icon={<CircleX />} danger onClick={cancel}>
              <span className={cn(armed && "font-medium")}>{armed ? "Tap again to cancel" : "Cancel recurring payment"}</span>
            </DAct>
          </DGroup>
        </>
      )}
      <DAct icon={<FileText />} href={activityUrl(x.name)} right={`${runs} payment${runs === 1 ? "" : "s"}`} chevron>
        History
      </DAct>
      <DAct icon={<Headset />} href={infoUrl("faq")} chevron>
        Contact support
      </DAct>
    </>
  );
}
