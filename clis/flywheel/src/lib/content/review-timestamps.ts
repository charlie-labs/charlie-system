export function isValidReviewTimestamp(value: string): boolean {
  const match =
    /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})Z$/u.exec(
      value
    );
  if (match === null) {
    return false;
  }
  const year = Number(match.groups?.year);
  const month = Number(match.groups?.month);
  const day = Number(match.groups?.day);
  const hour = Number(match.groups?.hour);
  const minute = Number(match.groups?.minute);
  const second = Number(match.groups?.second);
  return isValidDate(year, month, day) && isValidTime(hour, minute, second);
}

function isValidDate(year: number, month: number, day: number): boolean {
  return (
    month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
  );
}

function isValidTime(hour: number, minute: number, second: number): boolean {
  return hour <= 23 && minute <= 59 && second <= 59;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
