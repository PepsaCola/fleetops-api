import { describe, expect, it } from 'vitest'

import { transliterate } from './transliterate.ts'

describe('transliterate', () => {
  // Examples from the official 2010 transliteration table
  it.each([
    ['Олексій Шевченко', 'Oleksii Shevchenko'],
    ['Єнакієве', 'Yenakiieve'],
    ['Їжакевич', 'Yizhakevych'],
    ['Юрій', 'Yurii'],
    ['Яготин', 'Yahotyn'],
    ['Костянтин', 'Kostiantyn'],
    ['Щербухи', 'Shcherbukhy'],
    ['Згорани', 'Zghorany'],
    ['Розгон', 'Rozghon'],
    ["Знам'янка", 'Znamianka'],
    ['Короп’є', 'Koropie'],
    ['Гайова', 'Haiova'],
  ])('%s → %s', (ukrainian, latin) => {
    expect(transliterate(ukrainian)).toBe(latin)
  })

  it('leaves Latin letters, digits and punctuation alone', () => {
    expect(transliterate('Kyiv-2, корпус Б')).toBe('Kyiv-2, korpus B')
  })
})
