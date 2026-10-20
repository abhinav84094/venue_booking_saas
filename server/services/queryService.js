import { z } from "zod";
import { AuditLog } from "../models/venueModels.js";

export const pageQuery = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z.string().max(30).optional(),
    reference: z
      .string()
      .regex(/^VB-[A-F0-9]{16}$/)
      .optional(),
  })
  .strict();
export async function paginated(model, filter, query, populates = []) {
  const { page, limit } = pageQuery.parse(query);
  let request = model
    .find(filter)
    .sort(model === AuditLog ? { at: -1, _id: -1 } : { createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  for (const [path, select] of populates) request = request.populate(path, select);
  const [items, total] = await Promise.all([request.lean(), model.countDocuments(filter)]);
  return { items, total, page, limit };
}
