/** Shared vector symbols for the renderer and accessible DOM cards. */
export const navigationPaths = {
  elevator: ['M5 3h14v18H5z', 'M9 10V6m-2 2 2-2 2 2', 'M15 14v4m-2-2 2 2 2-2'],
  stairs: ['M3 20h5v-5h5v-5h5V5h3'],
  escalator: ['M3 18h5l8-10h5', 'M3 14h3l8-10h7', 'M11 9V5', 'M10 2h2'],
  ramp: ['M3 19h18L3 8z', 'M8 5h9m-3-3 3 3-3 3'],
  entry: ['M10 3h10v18H10', 'M3 12h11m-4-4 4 4-4 4'],
  platform: ['M6 3h12v14H6z', 'M6 10h12', 'M8 21l2-4m4 0 2 4', 'M9 14h.01M15 14h.01'],
  walk: ['M13 3h.01', 'M8 21l3-7', 'M16 21l-3-9 1-5', 'M6 12l3-5h5l4 5h3'],
} as const;
export type NavigationSymbol = keyof typeof navigationPaths;
export const transitionLabels = {
  elevator: 'Lift',
  stairs: 'Stairs',
  escalator: 'Escalator',
  ramp: 'Ramp',
} as const;
/** Presentation hint from explicit source instructions, never a floor or accessibility inference. */
export function instructionTransition(text: string): keyof typeof transitionLabels | null {
  if (/\b(?:take|use) (?:the |an? )?(?:elevator|lift)\b|(?:乘搭|乘坐|使用)升降機/i.test(text))
    return 'elevator';
  if (/\b(?:take|use) (?:the |an? )?escalator\b|(?:乘搭|乘坐|使用)扶手電梯/i.test(text))
    return 'escalator';
  if (
    /\b(?:take|use|ascend|descend) (?:the )?(?:stairs|staircase)\b|(?:沿|使用|走上|走下)樓梯/i.test(
      text,
    )
  )
    return 'stairs';
  if (/\b(?:take|use) (?:the |an? )?ramp\b|(?:沿|使用)斜道/i.test(text)) return 'ramp';
  return null;
}
