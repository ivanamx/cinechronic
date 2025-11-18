export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  createdAt: string;
}

export interface Movie {
  id: string;
  tmdbId: number;
  title: string;
  poster?: string;
  backdrop?: string;
  synopsis?: string;
  year?: number;
  duration?: number;
  genre?: string[];
  rating?: number;
  createdAt: string;
}

export interface Playlist {
  id: string;
  userId: string;
  name: string;
  scheduled_date?: string;
  movies: Movie[];
  createdAt: string;
  updatedAt: string;
}

export interface Festival {
  id: string;
  playlistId: string;
  playlist: Playlist;
  date: string;
  createdBy: string;
  createdByUser: User;
  status: 'scheduled' | 'active' | 'completed';
  participants: User[];
  createdAt: string;
}

export interface Rating {
  id: string;
  userId: string;
  user: User;
  movieId: string;
  movie: Movie;
  rating: number; // 1-10
  createdAt: string;
}

export interface Discussion {
  id: string;
  festivalId: string;
  movieId: string;
  userId: string;
  user: User;
  message: string;
  createdAt: string;
}

