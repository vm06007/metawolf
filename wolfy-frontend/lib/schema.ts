import { z } from "zod";

export const newsletterSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required." })
    .email({ message: "Invalid email." }),
});

export type NewsletterSchema = z.infer<typeof newsletterSchema>;
