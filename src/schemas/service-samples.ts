import {z} from "zod";
export const serviceMeasures=["handled","approved","approvedCompleted","fullyAutomatic","incoming","resolved","inbound","answered","unanswered","response","firstReply","resolution"] as const;
export const serviceSampleQuery=z.object({
 measure:z.enum(serviceMeasures),from:z.iso.date().optional(),through:z.iso.date().optional(),
 channel:z.string().trim().min(1).max(80).optional(),weekday:z.coerce.number().int().min(0).max(6).optional(),hour:z.coerce.number().int().min(0).max(23).optional(),
 observedAt:z.iso.datetime({offset:true}).optional(),limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).max(100000).default(0),
}).strict().refine(q=>!q.from||!q.through||q.from<=q.through,"Choose dates in order.");
export type ServiceSampleQuery=z.infer<typeof serviceSampleQuery>;
