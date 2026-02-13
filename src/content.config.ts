import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    date: z.string(),
    tags: z.array(z.string()).optional(),
    description: z.string().optional(),
    thumbnail: z.string().optional(),
    heroImage: z.object({
      src: image(),
      alt: z.string(),
      credit: z.string().optional(),
      creditUrl: z.string().optional(),
    }).optional(),
  }),
});

export const collections = { blog };
