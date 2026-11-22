import { z } from 'zod';
export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your first name.').max(40),
  need: z.string().trim().min(8, 'Add a little more detail about the help you need.').max(500),
  offer: z.string().trim().min(8, 'Add a little more detail about what you can offer.').max(500),
  recognition: z.string().trim().max(140).default('')
});
export const messageSchema = z.string().trim().min(1, 'Write a message first.').max(2000, 'Keep messages under 2,000 characters.');
export const topicSchema = z.object({
  topic: z.string().min(2).max(80), summary: z.string().min(1).max(200),
  evidence: z.string().min(3).max(300), specific: z.boolean()
});
export const extractionSchema = z.object({ needs: z.array(topicSchema).max(5), offers: z.array(topicSchema).max(5) });
