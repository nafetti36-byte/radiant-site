"use client";
import { useActionState } from "react";
import { syncIntegration, testIntegration, type ActionState } from "@/app/(app)/actions.ts";

export function IntegrationActions({ provider, brandId, canTest, canSync }: { provider: string; brandId: number; canTest: boolean; canSync: boolean }) {
  const [tState, test, tPending] = useActionState<ActionState, FormData>(testIntegration, null);
  const [sState, sync, sPending] = useActionState<ActionState, FormData>(syncIntegration, null);
  return (
    <div>
      <div className="inline">
        <form action={test}><input type="hidden" name="provider" value={provider} /><button disabled={!canTest || tPending}>{tPending ? "Testing…" : "Test connection"}</button></form>
        {canSync && <form action={sync} className="inline"><input type="hidden" name="provider" value={provider} /><input type="hidden" name="brandId" value={brandId} />
          <select name="days" defaultValue="30"><option value="7">7d</option><option value="30">30d</option><option value="90">90d</option></select>
          <button disabled={sPending}>{sPending ? "Syncing…" : "Sync metrics"}</button></form>}
      </div>
      {[tState, sState].map((s, i) => s && <div key={i} className="small" style={{ color: s.error ? "var(--bad)" : "var(--ok)", marginTop: 6 }}>{s.error ?? s.ok}</div>)}
    </div>
  );
}
