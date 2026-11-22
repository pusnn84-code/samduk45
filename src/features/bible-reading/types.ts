export type BibleReadingState = {
  date: string;
  observedAt?: string;
  completed: boolean;
  completedPeople: { name: string }[];
  progress: { completedDays: number; totalDays: number };
  sharing: string | null;
  sharingAnonymous: boolean;
  sharedLines: { id: string; name: string; text: string; isOwn: boolean; empathyCount: number; hasEmpathized: boolean; anonymous?: boolean }[];
};

export type BibleReadingUpdate =
  | { date: string; completed: boolean; sharing?: string | null; sharingAnonymous?: boolean }
  | { date: string; completed?: boolean; sharing: string | null; sharingAnonymous?: boolean };
