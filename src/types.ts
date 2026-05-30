export type Role = 'user' | 'model';

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  createdAt: number;
}

export interface Session {
  id: string;
  userId: string;
  title: string;
  category?: string;
  createdAt: number;
  updatedAt: number;
}
