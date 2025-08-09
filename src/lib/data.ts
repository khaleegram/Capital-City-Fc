import { Timestamp } from "firebase/firestore";

export type Player = {
  id: string;
  name: string;
  position: "Goalkeeper" | "Defender" | "Midfielder" | "Forward";
  jerseyNumber: number;
  imageUrl: string;
  bio: string;
  stats: {
    appearances: number;
    goals: number;
    assists: number;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  careerHighlights: string[];
};

export type NewsArticle = {
  id: string;
  headline: string;
  content: string;
  imageUrl: string;
  date: string; // Should be ISO string
  tags: string[];
};

export type Video = {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  uploadDate: Timestamp;
  taggedPlayers: { id: string; name: string }[]; // For easy display
};

export type PlayerVideoTag = {
  id: string;
  playerId: string;
  videoId: string;
  taggedAt: Timestamp;
};


export const newsArticles: NewsArticle[] = [
  // This mock data is no longer used for display, 
  // but kept for reference or other AI flows.
  {
    id: "1",
    headline: "Capital City Triumphs in Thrilling Derby Match",
    content: "In a nail-biting encounter, Capital City FC secured a 2-1 victory over their city rivals, with Leo Rivera scoring a dramatic late winner in the 89th minute. The match was a hard-fought battle from the first whistle, but Capital City's perseverance paid off, sending the home fans into a frenzy.",
    imageUrl: "https://placehold.co/800x600.png",
    date: "2024-05-15T12:00:00Z",
    tags: ["Victory", "Derby", "Leo Rivera", "Match Report"],
  },
  {
    id: "2",
    headline: "Marco Jensen's Masterclass Guides Team to Victory",
    content: "Marco Jensen delivered a midfield masterclass, providing two stunning assists in a comfortable 3-0 win against the Rovers. His control and vision were on full display, earning him Man of the Match honors.",
    imageUrl: "https://placehold.co/800x600.png",
    date: "2024-05-10T12:00:00Z",
    tags: ["Marco Jensen", "Win", "Assists", "Man of the Match"],
  },
];
