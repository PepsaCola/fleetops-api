// Ukrainian → Latin by the official national standard (Cabinet of Ministers resolution No. 55, 2010)

const LETTERS: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  "'": '',
  '’': '',
}

/** These letters are spelled one way at the start of a word and another way inside it. */
const POSITIONAL: Record<string, readonly [atStart: string, inside: string]> = {
  є: ['ye', 'ie'],
  ї: ['yi', 'i'],
  й: ['y', 'i'],
  ю: ['yu', 'iu'],
  я: ['ya', 'ia'],
}

// An apostrophe belongs to the word: in "Знам'янка" the "я" is not at a word start
const WORD_CHAR = /[\p{L}'’]/u

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export function transliterate(text: string): string {
  const chars = Array.from(text)
  return chars
    .map((char, index) => {
      const lower = char.toLowerCase()
      const previous = chars[index - 1]?.toLowerCase()
      const atWordStart = previous === undefined || !WORD_CHAR.test(previous)

      const positional = POSITIONAL[lower]
      // "зг" becomes "zgh" so it can't be misread as "ж" (zh)
      const latin =
        lower === 'г' && previous === 'з'
          ? 'gh'
          : positional
            ? positional[atWordStart ? 0 : 1]
            : (LETTERS[lower] ?? char)

      return char === lower ? latin : capitalize(latin)
    })
    .join('')
}
