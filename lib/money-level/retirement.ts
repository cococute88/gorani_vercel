export interface RetirementProgress {
  currentMonth: number;
  totalMonths: number;
  remainingMonths: number;
  progress: number;
}

export const MONEY_LEVEL_CAREER_START_DATE = "2019-04-01";

function monthIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

/** Month-only calculation: the employment month is month 1. */
export function calculateRetirementProgress(
  now: Date,
  retirementDate: string,
  startDate = MONEY_LEVEL_CAREER_START_DATE,
): RetirementProgress {
  const start = new Date(`${startDate.slice(0, 7)}-01T00:00:00`);
  const retirement = new Date(`${retirementDate.slice(0, 7)}-01T00:00:00`);
  const currentMonth = Math.max(1, monthIndex(now) - monthIndex(start) + 1);
  const totalMonths = Math.max(1, monthIndex(retirement) - monthIndex(start) + 1);
  const boundedCurrent = Math.min(currentMonth, totalMonths);

  return {
    currentMonth: boundedCurrent,
    totalMonths,
    remainingMonths: Math.max(0, totalMonths - boundedCurrent),
    progress: boundedCurrent / totalMonths,
  };
}
