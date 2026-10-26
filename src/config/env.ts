import { z } from 'zod'

const LOCAL_DATABASE_URL = 'postgres://fleetops:fleetops@localhost:5432/fleetops'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('localhost'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url().default(LOCAL_DATABASE_URL),
})

/** Reads and validates the environment once at startup; a bad value stops the process right away. */
export function loadConfig(source: Record<string, string | undefined> = process.env) {
  const result = EnvSchema.safeParse(source)
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`)
  }

  const env = result.data
  return {
    env: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
  } as const
}

export type Config = ReturnType<typeof loadConfig>
