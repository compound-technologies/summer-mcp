// Private report requests. No caller-supplied actor, source records or model output.
import { z } from "zod";
export const themePeriodInput=z.object({request_id:z.uuid(),from:z.iso.datetime({offset:true}),to:z.iso.datetime({offset:true})}).strict().refine(v=>Date.parse(v.to)>Date.parse(v.from)&&Date.parse(v.to)-Date.parse(v.from)<=90*86400000,"Choose an ordered period of at most 90 days.");
export const themeReviewInput=z.object({expected_revision:z.number().int().nonnegative(),theme:z.number().int().nonnegative(),disposition:z.enum(["useful","dismissed","needs_investigation"]),reason:z.string().trim().min(1).max(2000)}).strict();
