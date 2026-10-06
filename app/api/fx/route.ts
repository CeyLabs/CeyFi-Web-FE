import { FX_BASE } from "@/lib/api/fx";

/* Server-side proxy for the FX feed, which doesn't allow browser (CORS) requests. */

// Run per request, but share the upstream response for 5 minutes through the data cache.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(FX_BASE + "/currencies", { signal: AbortSignal.timeout(5000), next: { revalidate: 300 } });
    if (!res.ok) return Response.json({ message: `FX feed returned ${res.status}` }, { status: 502 });
    return Response.json(await res.json());
  } catch {
    return Response.json({ message: "FX feed unreachable" }, { status: 502 });
  }
}
