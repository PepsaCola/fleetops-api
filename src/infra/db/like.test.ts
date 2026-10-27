import { describe, expect, it } from 'vitest'

import { containing } from './like.ts'

describe('containing', () => {
  it('matches the text anywhere', () => {
    expect(containing('volvo')).toBe('%volvo%')
  })

  it('escapes LIKE wildcards and the escape character', () => {
    expect(containing('50%_off\\')).toBe('%50\\%\\_off\\\\%')
  })
})
