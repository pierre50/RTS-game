import type { DayNightColorAdjustment } from '../types/context'

export const DAY_NIGHT_CONFIG = {
  dayLengthMs: 24 * 60 * 1000,
  hoursPerDay: 24,
  newDayHour: 6,
  startHour: 8,
  topbarUpdateMinuteStep: 1,
}

export const DAY_NIGHT_COLOR_TIMELINE: Array<{ hour: number; color: DayNightColorAdjustment }> = [
  {
    hour: 0,
    color: { gamma: 0.98, contrast: 1.02, saturation: 0.68, brightness: 0.82, red: 0.74, green: 0.84, blue: 1.16 },
  },
  {
    hour: 5,
    color: { gamma: 0.98, contrast: 1.02, saturation: 0.7, brightness: 0.82, red: 0.76, green: 0.86, blue: 1.16 },
  },
  {
    hour: 7,
    color: { gamma: 1, contrast: 1.02, saturation: 1.08, brightness: 1.02, red: 1.14, green: 1.02, blue: 0.86 },
  },
  {
    hour: 10,
    color: { gamma: 1, contrast: 1.04, saturation: 1.06, brightness: 1.06, red: 1.03, green: 1.02, blue: 0.98 },
  },
  {
    hour: 16,
    color: { gamma: 1, contrast: 1.04, saturation: 1.04, brightness: 1.04, red: 1.04, green: 1, blue: 0.96 },
  },
  {
    hour: 19,
    color: { gamma: 0.99, contrast: 1.03, saturation: 1.1, brightness: 0.96, red: 1.18, green: 0.94, blue: 0.78 },
  },
  {
    hour: 22,
    color: { gamma: 0.98, contrast: 1.03, saturation: 0.74, brightness: 0.84, red: 0.78, green: 0.86, blue: 1.14 },
  },
  {
    hour: 24,
    color: { gamma: 0.98, contrast: 1.02, saturation: 0.68, brightness: 0.82, red: 0.74, green: 0.84, blue: 1.16 },
  },
]

export const NATURAL_REGROWTH_CONFIG = {
  berryRegrowRatioPerDay: 0.25,
  wheatGrowthFramesPerDay: 1,
  wheatRegrowRatioPerDay: 0.33,
}
