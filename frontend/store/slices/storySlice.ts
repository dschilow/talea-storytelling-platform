import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Chapter {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  scenicImageUrl?: string;
  scenicImagePrompt?: string;
  order: number;
}

interface Story {
  id: string;
  userId: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  config: any;
  chapters: Chapter[];
  status: 'generating' | 'complete' | 'error';
  createdAt: string;
  updatedAt: string;
}

interface StoryState {
  stories: Story[];
  currentStory: Story | null;
  loading: boolean;
  error: string | null;
}

const initialState: StoryState = {
  stories: [],
  currentStory: null,
  loading: false,
  error: null,
};

const storySlice = createSlice({
  name: 'story',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setStories: (state, action: PayloadAction<Story[]>) => {
      state.stories = action.payload;
    },
    addStory: (state, action: PayloadAction<Story>) => {
      state.stories.unshift(action.payload);
    },
    setCurrentStory: (state, action: PayloadAction<Story | null>) => {
      state.currentStory = action.payload;
    },
    updateStory: (state, action: PayloadAction<Story>) => {
      const index = state.stories.findIndex(story => story.id === action.payload.id);
      if (index !== -1) {
        state.stories[index] = action.payload;
      }
    },
    removeStory: (state, action: PayloadAction<string>) => {
      state.stories = state.stories.filter(story => story.id !== action.payload);
    },
  },
});

export const {
  setLoading,
  setError,
  setStories,
  addStory,
  setCurrentStory,
  updateStory,
  removeStory,
} = storySlice.actions;

export default storySlice.reducer;
