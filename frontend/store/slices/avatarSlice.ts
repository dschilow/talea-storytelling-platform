import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Avatar {
  id: string;
  userId: string;
  name: string;
  description?: string;
  physicalTraits: any;
  personalityTraits: any;
  imageUrl?: string;
  creationType: 'ai-generated' | 'photo-upload';
  isShared?: boolean;
  isOwnedByCurrentUser?: boolean;
  sharedBy?: {
    userId: string;
    name?: string;
    email?: string;
  };
  originalAvatarId?: string;
  createdAt: string;
  updatedAt: string;
}

interface AvatarState {
  avatars: Avatar[];
  currentAvatar: Avatar | null;
  loading: boolean;
  error: string | null;
}

const initialState: AvatarState = {
  avatars: [],
  currentAvatar: null,
  loading: false,
  error: null,
};

const avatarSlice = createSlice({
  name: 'avatar',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setAvatars: (state, action: PayloadAction<Avatar[]>) => {
      state.avatars = action.payload;
    },
    addAvatar: (state, action: PayloadAction<Avatar>) => {
      state.avatars.unshift(action.payload);
    },
    setCurrentAvatar: (state, action: PayloadAction<Avatar | null>) => {
      state.currentAvatar = action.payload;
    },
    updateAvatar: (state, action: PayloadAction<Avatar>) => {
      const index = state.avatars.findIndex(avatar => avatar.id === action.payload.id);
      if (index !== -1) {
        state.avatars[index] = action.payload;
      }
    },
    removeAvatar: (state, action: PayloadAction<string>) => {
      state.avatars = state.avatars.filter(avatar => avatar.id !== action.payload);
    },
  },
});

export const {
  setLoading,
  setError,
  setAvatars,
  addAvatar,
  setCurrentAvatar,
  updateAvatar,
  removeAvatar,
} = avatarSlice.actions;

export default avatarSlice.reducer;
