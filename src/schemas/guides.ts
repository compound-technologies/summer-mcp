import { z } from "zod";
import { GUIDE_MAX_BYTES, GUIDE_MEDIA_TYPES } from "./media.ts";

export const guideId = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/).max(100);
export const guideSlug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
const reason = z.string().trim().min(1).max(2000);
const version = z.number().int().min(0);
const publicUrl = z.union([z.literal(""), z.url().max(1000).refine(value => {
  const u = new URL(value);
  return u.protocol === "https:" && !u.username && !u.password;
}, "Use an HTTPS URL without credentials")]);
export const guideSettings = z.object({
  slug: guideSlug, title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  hero_background: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  portal_url: publicUrl, logo_asset_id: z.uuid().nullable().optional(),
}).strict();
export const saveGuideInput = z.object({ expected_version: version, settings: guideSettings, reason }).strict();
export const saveArticleInput = z.object({
  expected_revision: version, slug: guideSlug, title: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(1000), topic: z.string().trim().min(1).max(100),
  content: z.string().trim().min(1).max(500000), asset_ids: z.array(z.uuid()).max(100),
  source_url: publicUrl, verified_at: z.iso.datetime({ offset: true }).nullable().default(null), reason,
}).strict();
export const publishGuideInput = z.object({
  expected_version: version, articles: z.array(z.object({ id: guideId, revision: z.number().int().positive() }).strict()).min(1).max(200), reason,
}).strict();
export const unpublishGuideInput = z.object({ expected_version: version, reason }).strict();
export const createAssetInput = z.object({
  id: z.uuid(), filename: z.string().trim().min(1).max(200).refine(v => !/[\x00-\x1f/\\]/.test(v), "Use a file name, not a path"),
  media_type: z.enum(GUIDE_MEDIA_TYPES), byte_length: z.number().int().min(1).max(GUIDE_MAX_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), alt_text: z.string().trim().max(500),
  caption: z.string().trim().max(2000), provenance: z.string().trim().min(1).max(2000),
  transcript: z.string().max(100000).default(""), poster_asset_id: z.uuid().nullable().default(null),
}).strict();
export const editAssetInput = z.object({
  expected_version: version, alt_text: z.string().trim().max(500), caption: z.string().trim().max(2000),
  provenance: z.string().trim().min(1).max(2000), transcript: z.string().max(100000).default(""),
  poster_asset_id: z.uuid().nullable().default(null), retired: z.boolean().default(false), reason,
}).strict();
export const saveHostingInput = z.object({
  expected_version: version,
  hostname: z.string().trim().toLowerCase().regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/).nullable(),
}).strict();
export const verifyHostingInput = z.object({ expected_version: version }).strict();
