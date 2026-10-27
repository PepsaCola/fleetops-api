import { writeFile } from 'node:fs/promises'

import { buildApp } from '../src/build-app.ts'
import { loadConfig } from '../src/config/env.ts'

// The frontend generates its API client from this file, so it is committed with the code
const app = await buildApp(loadConfig({ NODE_ENV: 'test' }))
await app.ready()

const target = new URL('../openapi.json', import.meta.url)
await writeFile(target, `${JSON.stringify(app.swagger(), null, 2)}\n`)
await app.close()

console.log('openapi.json updated')
