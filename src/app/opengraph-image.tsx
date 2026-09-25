import { OG_SIZE, ogCard } from "@/lib/og"

export const alt = "Capital City FC. From Abuja. Built for the World."
export const size = OG_SIZE
export const contentType = "image/png"

export default function Image() {
  return ogCard({ eyebrow: "Abuja → Europe", title: "Built for the World.", sub: "Journeys, players and footage from Capital City FC." })
}
