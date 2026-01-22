export interface Question {
  _id?: string;
  id?: string;
  text: string;
  type?: 'mcq_single' | 'mcq_multiple' | 'true_false';
  options: string[];
  correctAnswer?: number;
  correctAnswers?: number[];
  correctAnswerBoolean?: boolean;
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
