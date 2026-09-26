export type Side = 'A' | 'B';

export type RoundResult = {
  picked: Side;
  correct: boolean;
  real_side: Side;
  tell: string | null;
  subject: string;
  real_credit: string | null;
  friends_fooled?: number;
  friends_total?: number;
  global_fool_pct?: number;
};

export type Round = {
  id: string;
  position: number;
  media_type: 'image' | 'video';
  category: string;
  a_url: string;
  b_url: string;
  result: RoundResult | null;
};

export type Puzzle = { id: string; date: string; rounds: Round[] };

export type Summary = {
  rounds: number;
  fooled: number;
  points: number;
  shame_streak: number;
  longest_streak: number;
  worst_day: number;
  yesterday: { answered: number; fooled: number; total: number } | null;
  unplayed_days: number;
  categories: { category: string; total: number; fooled: number }[];
  rank_global: number | null;
  rank_friends: number | null;
  rank_worst: number | null;
};

export type BoardRow = {
  rank: number;
  user_id: string;
  display_name: string;
  handle: string | null;
  rounds: number;
  fooled: number;
  points: number;
  pct: number;
  is_me: boolean;
};

export type ShameRow = {
  rank: number;
  user_id: string;
  display_name: string;
  points: number;
  fooled: number;
  rounds: number;
  worst_miss: string | null;
  is_me: boolean;
};

export type FriendRow = {
  user_id: string;
  display_name: string;
  handle: string | null;
  points: number;
  rounds: number;
  today_answered: number;
  today_fooled: number;
};
