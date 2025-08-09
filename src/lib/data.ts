export type Player = {
  id: string;
  name: string;
  position: "Goalkeeper" | "Defender" | "Midfielder" | "Forward";
  number: number;
  imageUrl: string;
  bio: string;
  stats: {
    appearances: number;
    goals: number;
    assists: number;
  };
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

export const players: Player[] = [
  {
    id: "1",
    name: "Leo Rivera",
    position: "Forward",
    number: 10,
    imageUrl: "https://placehold.co/400x400.png",
    bio: "Leo Rivera is a dynamic forward known for his clinical finishing and exceptional dribbling skills. A product of the club's academy, he has become a fan favorite and a key player for the team.",
    stats: { appearances: 152, goals: 78, assists: 45 },
    careerHighlights: ["Club Top Scorer 2023", "Player of the Season 2022", "First International Cap 2021"],
  },
  {
    id: "2",
    name: "Marco Jensen",
    position: "Midfielder",
    number: 8,
    imageUrl: "https://placehold.co/400x400.png",
    bio: "A commanding presence in the midfield, Marco Jensen excels at controlling the game's tempo. His vision and passing range make him the heart of the team's creative play.",
    stats: { appearances: 210, goals: 32, assists: 91 },
    careerHighlights: ["League Champion 2021", "Most Assists Award 2023"],
  },
  {
    id: "3",
    name: "Sofia Cruz",
    position: "Defender",
    number: 4,
    imageUrl: "https://placehold.co/400x400.png",
    bio: "Sofia Cruz is a rock-solid central defender with a reputation for tough tackling and aerial dominance. She is a natural leader and the captain of the team.",
    stats: { appearances: 189, goals: 12, assists: 8 },
    careerHighlights: ["Team Captain since 2022", "Clean Sheet Record Holder", "Defender of the Year 2021"],
  },
  {
    id: "4",
    name: "Alex Chen",
    position: "Goalkeeper",
    number: 1,
    imageUrl: "https://placehold.co/400x400.png",
    bio: "Alex Chen is an agile goalkeeper with incredible reflexes. Known for his penalty-saving heroics, he provides a reliable last line of defense for the team.",
    stats: { appearances: 130, goals: 0, assists: 1 },
    careerHighlights: ["Golden Glove Award 2023", "Penalty Shootout Hero vs. United"],
  },
];

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

export const getPlayerById = (id: string) => players.find(p => p.id === id);
export const getVideosByPlayerId = (playerId: string) => videos.filter(v => v.taggedPlayerIds.includes(playerId));
