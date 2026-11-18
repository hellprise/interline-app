import z from "zod";

export const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});
export type Env = z.infer<typeof EnvSchema>;
