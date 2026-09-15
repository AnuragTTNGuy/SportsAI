import { z } from "zod";

export const sportSlugSchema = z.enum(["football", "basketball"]);

export const sportSummarySchema = z.object({
  slug: sportSlugSchema,
  name: z.string(),
  description: z.string(),
  competitionCount: z.number().optional(),
});

export const sportsCatalogResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  sports: z.array(sportSummarySchema),
});

export type SportSlug = z.infer<typeof sportSlugSchema>;
export type SportSummary = z.infer<typeof sportSummarySchema>;
export type SportsCatalogResponse = z.infer<typeof sportsCatalogResponseSchema>;

export const SPORTS = {
  football: {
    slug: "football" as const,
    name: "Football",
    description: "Soccer competitions, form, H2H, and betting insights",
  },
  basketball: {
    slug: "basketball" as const,
    name: "Basketball",
    description: "NBA team form, player spotlight, totals, and game preview",
  },
} as const;
