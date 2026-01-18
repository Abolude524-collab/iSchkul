export interface Flashcard {
  _id: string;
  front: string;
  back: string;
  difficulty: string;
  tags: string[];
  interval: number;
  easeFactor: number;
  nextReview: string;
  successRate: number;
}

export interface FlashcardSet {
  _id: string;
  title: string;
  description: string;
  subject: string;
  tags: string[];
  isPublic: boolean;
  shareCode: string;
  shareUrl: string;
  cardCount: number;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
}
