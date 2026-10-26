/**
 * Architecture rules for src/, checked by `npm run lint:deps`.
 * Docs: https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular imports make modules impossible to reason about and to load in order.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'module-public-api',
      severity: 'error',
      comment:
        'A module is reached only through its index.ts. Table files are the one exception: ' +
        'other modules import them for foreign keys.',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/[^/]+/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$', '\\.table\\.ts$'],
      },
    },
    {
      name: 'shared-stays-generic',
      severity: 'error',
      comment: 'shared/ holds code with no business knowledge, so it must not depend on modules.',
      from: { path: '^src/shared/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'infra-stays-generic',
      severity: 'error',
      comment:
        'infra/ adapts external technology (database, HTTP docs, WebSocket) for modules. ' +
        "The one exception is the schema index, which gathers every module's tables for Drizzle.",
      from: { path: '^src/infra/' },
      to: { path: '^src/modules/', pathNot: '\\.table\\.ts$' },
    },
    {
      name: 'no-test-imports-in-code',
      severity: 'error',
      comment: 'Production code must never import a test file.',
      from: { pathNot: '\\.test\\.ts$' },
      to: { path: '\\.test\\.ts$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.js', '.json'],
    },
  },
}
