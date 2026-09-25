export const TAGS = {
  team: "team",
  players: "players",
  journeys: "journeys",
  media: "media",
  galleries: "galleries",
  placements: "placements",
  staff: "staff",
  achievements: "achievements",
  news: "news",
  fixtures: "fixtures",
  recaps: "recaps",
  proof: "proof",
} as const

export type CacheTag = (typeof TAGS)[keyof typeof TAGS]

export const ALL_TAGS = Object.values(TAGS) as CacheTag[]
