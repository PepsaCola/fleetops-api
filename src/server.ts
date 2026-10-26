import { buildApp } from './app.ts'
import { loadConfig } from './config/env.ts'

const config = loadConfig()
const app = await buildApp(config)

// Ctrl+C locally or SIGTERM from the hosting platform: finish in-flight requests, then exit
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    app.log.info({ signal }, 'Shutting down')
    await app.close()
    process.exit(0)
  })
}

try {
  await app.listen({ host: config.host, port: config.port })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
