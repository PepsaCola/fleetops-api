import { defineConfig } from 'drizzle-kit'

import { loadConfig } from './src/config/env.ts'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infra/db/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url: loadConfig().databaseUrl },
  // PostGIS owns some tables (spatial_ref_sys); drizzle-kit must leave them alone
  extensionsFilters: ['postgis'],
  strict: true,
  verbose: true,
})
