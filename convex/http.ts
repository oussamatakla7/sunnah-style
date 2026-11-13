import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();
const path = "/store-record";
for (const method of ["GET", "PUT", "DELETE"] as const) {
  http.route({
    path, method,
    handler: httpAction(async (ctx, request) => {
      const secret = process.env.STORE_BRIDGE_SECRET;
      if (!secret || request.headers.get("Authorization") !== "Bearer " + secret) {
        return new Response(null, { status: 403 });
      }
      const params = new URL(request.url).searchParams;
      const key = params.get("key") || "";
      if (method === "GET" && params.has("after")) {
        const after = params.get("after") || "orders/";
        if (!after.startsWith("orders/")) return new Response(null, { status: 400 });
        return Response.json(await ctx.runQuery(internal.records.listOrders, { after }));
      }
      if (key !== "store-state.json" && !/^orders\/\d{13}-[a-f0-9-]{36}$/.test(key)) {
        return new Response(null, { status: 400 });
      }
      if (method === "DELETE") {
        await ctx.runMutation(internal.records.remove, { key });
        return new Response(null, { status: 204 });
      }
      if (method === "GET") {
        const record = await ctx.runQuery(internal.records.read, { key });
        if (!record) return new Response(null, { status: 404 });
        const result = await fetch(record.url);
        if (!result.ok) return new Response(null, { status: 503 });
        return new Response(result.body, { headers: { ETag: record.etag, "Content-Type": "application/json" } });
      }
      const blob = await ctx.storage.store(await request.blob());
      const etag = crypto.randomUUID();
      const written = await ctx.runMutation(internal.records.write, {
        key, blob, etag, match: request.headers.get("If-Match") ?? undefined,
        absent: request.headers.get("If-None-Match") === "*",
      });
      return new Response(null, { status: written ? 204 : 412 });
    }),
  });
}
export default http;
