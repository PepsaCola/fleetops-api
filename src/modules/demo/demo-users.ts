/**
 * Demo sign-ins, one per role. The login page offers them to every visitor, so the password
 * is no secret: it only keeps the demo from being entirely open.
 */
export const DEMO_PASSWORD = 'fleetops-demo'

export const DEMO_USERS = [
  { email: 'dispatcher@fleetops.demo', name: 'Demo Dispatcher', role: 'dispatcher' },
  { email: 'viewer@fleetops.demo', name: 'Demo Viewer', role: 'viewer' },
] as const
