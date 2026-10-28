// The fleet runs on Kyiv time: working days, shifts and document expiry all follow the calendar
// and the clocks there, wherever the server happens to run.

export const FLEET_TIME_ZONE = 'Europe/Kyiv'

/** A calendar date, YYYY-MM-DD; such strings sort in date order */
export type IsoDate = string

const MINUTE = 60_000

/** Today's date in the fleet's time zone. */
export function fleetToday(now: Date): IsoDate {
  // The en-CA locale writes dates as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: FLEET_TIME_ZONE }).format(now)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const result = new Date(`${date}T00:00:00Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

/** Every day from `first` to `last`, both included. */
export function daysFrom(first: IsoDate, last: IsoDate): IsoDate[] {
  const days: IsoDate[] = []
  for (let day = first; day <= last; day = addDays(day, 1)) days.push(day)
  return days
}

const fleetClock = new Intl.DateTimeFormat('en-US', {
  timeZone: FLEET_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
})

/** How far the fleet's clocks are ahead of UTC at a moment: 2 hours in winter, 3 in summer */
function offsetAt(at: number): number {
  const parts = fleetClock.formatToParts(at)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((candidate) => candidate.type === type)?.value)
  const shown = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  )
  return shown - (at - (at % 1000))
}

/** The moment the fleet's clocks show `minutes` past midnight on `day`. */
export function fleetInstant(day: IsoDate, minutes: number): Date {
  const shown = Date.parse(`${day}T00:00:00Z`) + minutes * MINUTE
  // The offset depends on the moment itself, so a second pass settles the days clocks change
  const guess = shown - offsetAt(shown)
  return new Date(shown - offsetAt(guess))
}
