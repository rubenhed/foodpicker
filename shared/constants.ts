// constants.ts
export const MessageType = {
  SEARCH: "search",
  VOTE: "vote",
} as const;

export const RANGE_METERS: Record<number, number> = {
  1: 300,
  2: 500,
  3: 1000,
  4: 2000,
  5: 3000,
} as const;

export const TOKYO_CENTER: [number, number] = [35.6895, 139.6917] as const;
