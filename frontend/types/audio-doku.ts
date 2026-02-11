export interface AudioDoku {
  id: string;
  userId: string;
  title: string;
  description: string;
  ageGroup?: string;
  category?: string;
  coverDescription?: string;
  coverImageUrl?: string;
  audioUrl: string;
  isPublic: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}
