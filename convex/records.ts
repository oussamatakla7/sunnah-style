import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const read = internalQuery({
  args: { key: v.string() },
  returns: v.union(v.null(), v.object({ url: v.string(), etag: v.string() })),
  handler: async (ctx, { key }) => {
    const record = await ctx.db.query("records").withIndex("by_key", q => q.eq("key", key)).unique();
    if (!record) return null;
    const url = await ctx.storage.getUrl(record.blob);
    if (!url) throw new Error("Missing record contents");
    return { url, etag: record.etag };
  },
});

export const write = internalMutation({
  args: { key: v.string(), blob: v.id("_storage"), etag: v.string(), match: v.optional(v.string()), absent: v.boolean() },
  returns: v.boolean(),
  handler: async (ctx, { key, blob, etag, match, absent }) => {
    const record = await ctx.db.query("records").withIndex("by_key", q => q.eq("key", key)).unique();
    if ((absent && record) || (match !== undefined && record?.etag !== match)) {
      await ctx.storage.delete(blob);
      return false;
    }
    if (record) {
      await ctx.db.patch(record._id, { blob, etag });
      await ctx.storage.delete(record.blob);
    } else await ctx.db.insert("records", { key, blob, etag });
    return true;
  },
});

export const remove = internalMutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, { key }) => {
    const record = await ctx.db.query("records").withIndex("by_key", q => q.eq("key", key)).unique();
    if (record) {
      await ctx.db.delete(record._id);
      await ctx.storage.delete(record.blob);
    }
    return null;
  },
});

export const listOrders = internalQuery({
  args: { after: v.string() },
  returns: v.array(v.string()),
  handler: async (ctx, { after }) => {
    const records = await ctx.db.query("records")
      .withIndex("by_key", q => q.gt("key", after).lt("key", "orders0")).take(21);
    return records.map(record => record.key);
  },
});
