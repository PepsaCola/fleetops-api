import { describe, expect, it } from 'vitest'

import { generateDemoData } from './demo-data.ts'

const today = new Date('2026-10-26T09:00:00Z')
const data = generateDemoData({ seed: 42, today })

const daysUntil = (isoDate: string) => (Date.parse(isoDate) - today.getTime()) / 86_400_000
const allUnique = (values: string[]) => new Set(values).size === values.length

describe('generateDemoData', () => {
  it('is the same for the same seed and different for another', () => {
    expect(generateDemoData({ seed: 42, today })).toEqual(data)
    expect(generateDemoData({ seed: 7, today })).not.toEqual(data)
  })

  it('builds a fleet of 40 vehicles and 55 drivers around 3 depots', () => {
    const countByType = Object.groupBy(data.vehicles, (vehicle) => vehicle.type)

    expect(data.depots).toHaveLength(3)
    expect(data.vehicles).toHaveLength(40)
    expect(data.drivers).toHaveLength(55)
    expect(countByType.truck).toHaveLength(16)
    expect(countByType.van).toHaveLength(20)
    expect(countByType.car).toHaveLength(4)
  })

  it('only refers to depots that exist', () => {
    const depotIndexes = [...data.vehicles, ...data.drivers].map((item) => item.depot)

    expect(depotIndexes.every((index) => index >= 0 && index < data.depots.length)).toBe(true)
  })

  it('gives every vehicle a unique Kyiv plate', () => {
    const plates = data.vehicles.map((vehicle) => vehicle.plate)

    expect(allUnique(plates)).toBe(true)
    for (const plate of plates) expect(plate).toMatch(/^(AA|KA|AI|KI) \d{4} [ABCEHIKMOPTX]{2}$/)
  })

  it('creates drivers with Latin names and unique contacts', () => {
    expect(allUnique(data.drivers.map((driver) => driver.phone))).toBe(true)
    expect(allUnique(data.drivers.map((driver) => driver.licenseNumber))).toBe(true)
    for (const driver of data.drivers) {
      expect(`${driver.firstName} ${driver.lastName}`).toMatch(/^[A-Za-z-]+ [A-Za-z-]+$/)
      expect(driver.phone).toMatch(/^\+380\d{9}$/)
    }
  })

  it('has enough CE-licensed drivers for every truck', () => {
    const truckDrivers = data.drivers.filter((driver) => driver.licenseCategories.includes('CE'))

    expect(truckDrivers.length).toBeGreaterThanOrEqual(16)
  })

  it('always has a few documents about to expire, so the dashboard can warn about them', () => {
    const expiringSoon = data.drivers.filter(
      (driver) =>
        daysUntil(driver.licenseExpiresOn) <= 30 || daysUntil(driver.medicalExpiresOn) <= 30,
    )

    expect(expiringSoon.length).toBeGreaterThan(0)
    expect(expiringSoon.length).toBeLessThan(data.drivers.length / 2)
  })
})
