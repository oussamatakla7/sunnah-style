import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  records: defineTable({ key: v.string(), blob: v.id("_storage"), etag: v.string() })
    .index("by_key", ["key"]),
});
