import { configureStore } from '@reduxjs/toolkit';
import avatarSlice from './slices/avatarSlice';
import storySlice from './slices/storySlice';

export const store = configureStore({
  reducer: {
    avatar: avatarSlice,
    story: storySlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
