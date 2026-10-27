/**
 * A LIKE/ILIKE pattern matching `text` anywhere in a value. Wildcards in the text are escaped,
 * so searching for "%" finds a percent sign instead of everything.
 */
export const containing = (text: string) => `%${text.replace(/[\\%_]/g, '\\$&')}%`
