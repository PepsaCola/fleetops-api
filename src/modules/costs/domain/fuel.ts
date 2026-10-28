// What a trip burns. The demo fleet has no fuel cards, so fuel is worked out from the distance
// and what each kind of vehicle usually burns, at one diesel price.

export type VehicleType = 'truck' | 'van' | 'car'

/** Diesel at the pump, in hryvnias per litre: the Ukrainian average in October 2026 (A-95 monitoring) */
export const DIESEL_UAH_PER_LITRE = 98

/** What each kind of vehicle burns, in litres per 100 km */
export const LITRES_PER_100_KM: Record<VehicleType, number> = { truck: 28, van: 11, car: 7 }

/** A trip's distance and fuel: out to the customer and back along the route. */
export function tripFuel(routeLengthKm: number, type: VehicleType) {
  const km = 2 * routeLengthKm
  const litres = (km * LITRES_PER_100_KM[type]) / 100
  return { km, uah: Math.round(litres * DIESEL_UAH_PER_LITRE) }
}
