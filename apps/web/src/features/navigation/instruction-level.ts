/** Level cues come only from the current source instruction, never from GPS height. */
export function instructionLevel(text: string): string | null {
  if (/\b(?:footbridge|foot bridge|pedestrian bridge|elevated walkway)\b|行人天橋|天橋/i.test(text))
    return 'Footbridge';
  if (/\b(?:subway|underpass)\b|行人隧道|地下通道/i.test(text)) return 'Underpass';
  const floor = text.match(
    /\b(?:ground (?:floor|level)|G\/?F|B?\d+\/?F|(?:level|floor)\s+(?:B?\d+|G)|(?:\d+(?:st|nd|rd|th)|first|second|third|basement) floor)\b|地下|[一二三四五六七八九十\d]+樓/i,
  );
  return floor?.[0] ?? null;
}
