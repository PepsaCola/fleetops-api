import { base, Faker, uk } from '@faker-js/faker'

import type { depots } from '../depots/depots.table.ts'
import type { drivers } from '../drivers/drivers.table.ts'
import type { vehicles } from '../vehicles/vehicles.table.ts'
import { transliterate } from './transliterate.ts'

type NewDepot = typeof depots.$inferInsert
/** `depot` is an index into the generated depots; the real id is known only after insert. */
type NewVehicle = Omit<typeof vehicles.$inferInsert, 'homeDepotId'> & { depot: number }
type NewDriver = Omit<typeof drivers.$inferInsert, 'homeDepotId'> & { depot: number }
type VehicleType = NewVehicle['type']

export type DemoData = {
  depots: NewDepot[]
  vehicles: NewVehicle[]
  drivers: NewDriver[]
}

export const DEMO_DEPOTS: NewDepot[] = [
  {
    name: 'Brovary Logistics Park',
    address: 'Kyivska St 300, Brovary, Kyiv region',
    location: { lng: 30.79, lat: 50.511 },
  },
  {
    name: 'Boryspil Cross-Dock',
    address: 'Kyivskyi Shliakh St 2, Boryspil, Kyiv region',
    location: { lng: 30.95, lat: 50.357 },
  },
  {
    name: 'Bila Tserkva Depot',
    address: 'Levanevskoho St 85, Bila Tserkva, Kyiv region',
    location: { lng: 30.115, lat: 49.798 },
  },
]

const FLEET_MIX: Record<VehicleType, number> = { truck: 16, van: 20, car: 4 }
const DRIVER_COUNT = 55

const MODELS: Record<VehicleType, ReadonlyArray<readonly [make: string, model: string]>> = {
  truck: [
    ['Volvo', 'FH 500'],
    ['DAF', 'XF 480'],
    ['MAN', 'TGX 18.510'],
    ['Scania', 'R 450'],
    ['Mercedes-Benz', 'Actros 1845'],
  ],
  van: [
    ['Mercedes-Benz', 'Sprinter 316'],
    ['Ford', 'Transit 350'],
    ['Renault', 'Master'],
    ['Volkswagen', 'Crafter'],
    ['Fiat', 'Ducato'],
  ],
  car: [
    ['Skoda', 'Octavia'],
    ['Toyota', 'Corolla'],
    ['Renault', 'Duster'],
  ],
}

type Range = readonly [min: number, max: number]
const SPECS: Record<
  VehicleType,
  { capacityKg: Range; fuelTankL: Range; ageYears: Range; kmPerYear: Range }
> = {
  truck: {
    capacityKg: [18_000, 24_000],
    fuelTankL: [600, 900],
    ageYears: [1, 10],
    kmPerYear: [90_000, 140_000],
  },
  van: {
    capacityKg: [1_200, 3_500],
    fuelTankL: [70, 90],
    ageYears: [0, 9],
    kmPerYear: [40_000, 70_000],
  },
  car: {
    capacityKg: [350, 450],
    fuelTankL: [50, 55],
    ageYears: [0, 7],
    kmPerYear: [20_000, 35_000],
  },
}

/** Kyiv city (AA, KA) and Kyiv region (AI, KI) plate prefixes */
const PLATE_REGIONS = ['AA', 'KA', 'AI', 'KI']
/** Ukrainian plates only use letters that look the same in Cyrillic and Latin */
const PLATE_LETTERS = 'ABCEHIKMOPTX'
const MOBILE_OPERATOR_CODES = [
  '50',
  '63',
  '66',
  '67',
  '68',
  '73',
  '93',
  '95',
  '96',
  '97',
  '98',
  '99',
]

const LICENSE_PROFILES = [
  { weight: 45, value: ['B', 'C', 'CE'] },
  { weight: 45, value: ['B', 'C1'] },
  { weight: 10, value: ['B'] },
]

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10)

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000)

/** Draws values until one is new, so plates, phones and licence numbers stay unique. */
function uniqueValue(used: Set<string>, draw: () => string) {
  let value = draw()
  while (used.has(value)) value = draw()
  used.add(value)
  return value
}

/**
 * The demo fleet: 3 depots around Kyiv, 40 vehicles and 55 drivers.
 * The same seed always gives the same data; dates are relative to `today`, so some documents
 * are always about to expire and the dashboard has something to warn about.
 */
export function generateDemoData({
  seed = 42,
  today = new Date(),
}: { seed?: number; today?: Date } = {}): DemoData {
  const faker = new Faker({ locale: [uk, base] })
  faker.seed(seed)

  const between = ([min, max]: Range) => faker.number.int({ min, max })
  const usedPlates = new Set<string>()
  const usedPhones = new Set<string>()
  const usedLicenses = new Set<string>()
  const pickDepot = () => faker.number.int({ min: 0, max: DEMO_DEPOTS.length - 1 })

  const vehicles = (Object.keys(FLEET_MIX) as VehicleType[]).flatMap((type) =>
    Array.from({ length: FLEET_MIX[type] }, (): NewVehicle => {
      const spec = SPECS[type]
      const [make, model] = faker.helpers.arrayElement(MODELS[type])
      const age = between(spec.ageYears)
      return {
        plate: uniqueValue(
          usedPlates,
          () =>
            `${faker.helpers.arrayElement(PLATE_REGIONS)} ${faker.string.numeric(4)} ` +
            faker.string.fromCharacters(PLATE_LETTERS, 2),
        ),
        make,
        model,
        year: today.getFullYear() - age,
        type,
        status: faker.helpers.weightedArrayElement([
          { weight: 85, value: 'active' as const },
          { weight: 10, value: 'maintenance' as const },
          { weight: 5, value: 'inactive' as const },
        ]),
        capacityKg: Math.round(between(spec.capacityKg) / 50) * 50,
        fuelTankL: between(spec.fuelTankL),
        odometerKm: Math.round(
          (age + faker.number.float({ min: 0.2, max: 1 })) * between(spec.kmPerYear),
        ),
        depot: pickDepot(),
      }
    }),
  )

  const drivers = Array.from({ length: DRIVER_COUNT }, (): NewDriver => {
    const sex = faker.helpers.weightedArrayElement([
      { weight: 80, value: 'male' as const },
      { weight: 20, value: 'female' as const },
    ])
    // A few documents run out within a month, the rest are valid for a good while
    const licenseDays = faker.datatype.boolean(0.08)
      ? faker.number.int({ min: 3, max: 30 })
      : faker.number.int({ min: 180, max: 8 * 365 })
    const medicalDays = faker.datatype.boolean(0.1)
      ? faker.number.int({ min: 3, max: 30 })
      : faker.number.int({ min: 40, max: 365 })

    return {
      firstName: transliterate(faker.person.firstName(sex)),
      lastName: transliterate(faker.person.lastName(sex)),
      phone: uniqueValue(
        usedPhones,
        () => `+380${faker.helpers.arrayElement(MOBILE_OPERATOR_CODES)}${faker.string.numeric(7)}`,
      ),
      licenseNumber: uniqueValue(
        usedLicenses,
        () => faker.string.fromCharacters(PLATE_LETTERS, 3) + faker.string.numeric(6),
      ),
      licenseCategories: faker.helpers.weightedArrayElement(LICENSE_PROFILES),
      licenseExpiresOn: toIsoDate(addDays(today, licenseDays)),
      medicalExpiresOn: toIsoDate(addDays(today, medicalDays)),
      status: faker.helpers.weightedArrayElement([
        { weight: 90, value: 'active' as const },
        { weight: 7, value: 'on_leave' as const },
        { weight: 3, value: 'inactive' as const },
      ]),
      depot: pickDepot(),
    }
  })

  return { depots: DEMO_DEPOTS, vehicles, drivers }
}
