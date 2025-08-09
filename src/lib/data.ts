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
  date: string;
  tags: string[];
};

export type Video = {
  id: string;
  title: string;
  thumbnailUrl: string;
  duration: string;
  taggedPlayerIds: string[];
};

export const newsArticles: NewsArticle[] = [
  {
    id: "1",
    headline: "Capital City Triumphs in Thrilling Derby Match",
    content: "In a nail-biting encounter, Capital City FC secured a 2-1 victory over their city rivals, with Leo Rivera scoring a dramatic late winner in the 89th minute. The match was a hard-fought battle from the first whistle, but Capital City's perseverance paid off, sending the home fans into a frenzy.",
    imageUrl: "https://placehold.co/800x600.png",
    date: "2024-05-15",
    tags: ["Victory", "Derby", "Leo Rivera", "Match Report"],
  },
  {
    id: "2",
    headline: "Marco Jensen's Masterclass Guides Team to Victory",
    content: "Marco Jensen delivered a midfield masterclass, providing two stunning assists in a comfortable 3-0 win against the Rovers. His control and vision were on full display, earning him Man of the Match honors.",
    imageUrl: "https://placehold.co/800x600.png",
    date: "2024-05-10",
    tags: ["Marco Jensen", "Win", "Assists", "Man of the Match"],
  },
];

export const videos: Video[] = [
  {
    id: "1",
    title: "All Goals: Leo Rivera's 2023/24 Season",
    thumbnailUrl: "https://placehold.co/400x225.png",
    duration: "12:34",
    taggedPlayerIds: ["1"],
  },
  {
    id: "2",
    title: "Defensive Highlights: Sofia Cruz Masterclass",
    thumbnailUrl: "https://placehold.co/400x225.png",
    duration: "08:52",
    taggedPlayerIds: ["3"],
  },
  {
    id: "3",
    title: "Top 5 Saves: Alex Chen's Best Moments",
    thumbnailUrl: "https://placehold.co/400x225.png",
    duration: "05:15",
    taggedPlayerIds: ["4"],
  },
   {
    id: "4",
    title: "Derby Day Highlights: Capital City vs. Rivals",
    thumbnailUrl: "https://placehold.co/400x225.png",
    duration: "10:02",
    taggedPlayerIds: ["1", "2", "3", "4"],
  },
];


export const getVideosByPlayerId = (playerId: string) => videos.filter(v => v.taggedPlayerIds.includes(playerId));
