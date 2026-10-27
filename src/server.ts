import type { FastifyListenOptions } from 'fastify'

import { buildApp } from './build-app.ts'
import { loadConfig } from './config/env.ts'

// The process entrypoint, locally and on Vercel. Vercel runs the first of src/{app,index,server}.ts
// that imports 'fastify': hence the type import above, and the app factory living in build-app.ts.

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

const listenOptions: FastifyListenOptions = { host: config.host, port: config.port }

// Not awaited: on Vercel, listen() only hands the server over to the platform and never reports
// back, so awaiting it would keep this module from ever finishing loading
app.listen(listenOptions).catch((error: unknown) => {
  app.log.error(error)
  process.exit(1)
})
