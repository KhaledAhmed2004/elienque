import { z } from 'zod';

const createPostSchema = z.object({
  body: z.object({
    content: z.string().max(1000).optional(),
    image: z.string().url().optional(),
  }).refine((data) => data.content || data.image, {
    message: 'Either content or image must be provided',
    path: ['content'],
  }),
});

const createCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(500),
  }),
});

export const PostValidation = {
  createPostSchema,
  createCommentSchema,
};
