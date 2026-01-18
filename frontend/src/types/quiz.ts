export interface Question {
  _id?: string;
  id?: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  imageUrl?: string;
}

export interface QuizCreateForm {
  title: string;
  subject: string;
  description: string;
  difficulty: string;
  timeLimit: number; // minutes
  isPublic: boolean;
}
