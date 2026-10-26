import { describe, expect, it } from 'vitest'

import { parseEwkbPoint } from './columns.ts'

// Hex values exactly as PostGIS returns them for the Brovary depot
const BROVARY_WITH_SRID = '0101000020E61000000AD7A3703DCA3E40C520B07268414940'
const BROVARY_WITHOUT_SRID = '01010000000AD7A3703DCA3E40C520B07268414940'
const LINE =
  '0102000020E6100000020000000000000000003E4000000000000049400000000000003F400000000000804940'

describe('parseEwkbPoint', () => {
  it('reads longitude and latitude of a point with SRID 4326', () => {
    expect(parseEwkbPoint(BROVARY_WITH_SRID)).toEqual({ lng: 30.79, lat: 50.511 })
  })

  it('reads a point stored without an SRID too', () => {
    expect(parseEwkbPoint(BROVARY_WITHOUT_SRID)).toEqual({ lng: 30.79, lat: 50.511 })
  })

  it('refuses geometries that are not points', () => {
    expect(() => parseEwkbPoint(LINE)).toThrow('Expected a POINT geometry')
  })
})
