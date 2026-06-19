import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  selectedPair: string;
  theme: 'dark' | 'light';
  notifications: Array<{ id: string; title: string; message: string; read: boolean; createdAt: string }>;
}

const initialState: UIState = {
  selectedPair: 'BTC_USDT',
  theme: 'dark',
  notifications: []
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSelectedPair(state, action: PayloadAction<string>) {
      state.selectedPair = action.payload;
    },
    toggleTheme(state) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
    },
    addNotification(state, action: PayloadAction<{ title: string; message: string }>) {
      state.notifications.unshift({
        id: Math.random().toString(36).substring(2, 9),
        title: action.payload.title,
        message: action.payload.message,
        read: false,
        createdAt: new Date().toISOString()
      });
    },
    markAllNotificationsRead(state) {
      state.notifications.forEach(n => n.read = true);
    }
  }
});

export const { setSelectedPair, toggleTheme, addNotification, markAllNotificationsRead } = uiSlice.actions;

export const store = configureStore({
  reducer: {
    ui: uiSlice.reducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
