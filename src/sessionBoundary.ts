/** Local calendar construction deliberately accounts for DST and timezone offsets. */
export function sessionMaximumEnd(startTime: number) {
  const date = new Date(startTime);
  date.setDate(date.getDate() + 1);
  date.setHours(23, 59, 59, 0);
  return date.getTime();
}
export function followingMidnight(startTime: number) {
  const date = new Date(startTime);
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
export function countdownCanStart(seconds: number, now = Date.now()) {
  return Number.isFinite(seconds) && seconds > 0 && now + seconds * 1000 <= sessionMaximumEnd(now);
}
export function overnightAllocationValid(startTime: number, endTime: number, total: number, after?: number) {
  if (
    ![startTime, endTime, total].every(Number.isFinite) ||
    endTime <= startTime ||
    total <= 0 ||
    endTime > sessionMaximumEnd(startTime) ||
    total > (endTime - startTime) / 1000
  )
    return false;
  const midnight = followingMidnight(startTime);
  if (endTime < midnight) return after === undefined;
  return (
    after !== undefined &&
    Number.isFinite(after) &&
    after >= 0 &&
    after <= total &&
    after <= (endTime - midnight) / 1000 &&
    total - after <= (midnight - startTime) / 1000
  );
}
