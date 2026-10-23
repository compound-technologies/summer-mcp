import {z} from "zod";
export const OPERATOR_GUIDANCE_LIMIT=8000;
export const operatorGuidance=z.string().trim().max(OPERATOR_GUIDANCE_LIMIT);
export const workflowSaveInput=z.object({id:z.uuid(),expected_revision:z.number().int().min(0),name:z.string().trim().min(1).max(80),description:z.string().trim().max(500),instructions:z.string().trim().min(1).max(6000),retired:z.boolean(),reason:z.string().trim().min(1).max(500)}).strict();
export const workflowRequestInput=z.object({id:z.string().min(1).max(100),expected_revision:z.number().int().positive(),feedback:operatorGuidance.default("")}).strict();
