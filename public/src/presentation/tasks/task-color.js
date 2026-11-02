const GOLDEN_ANGLE = 137.508;

/** Stable color shared by every block belonging to the same task. */
export function getTaskColor(taskId) {
  let hash = 2166136261;
  for (const character of taskId) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  const hue = (Math.abs(hash) * GOLDEN_ANGLE) % 360;
  return `hsl(${hue.toFixed(1)} 68% 40%)`;
}
