import { z } from 'zod';

/** Hard ceiling on page size so a client cannot ask for the whole collection. */
export const MAX_PAGE_SIZE = 50;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const idParamSchema = z.object({ id: objectIdSchema });

export type IdParam = z.infer<typeof idParamSchema>;
