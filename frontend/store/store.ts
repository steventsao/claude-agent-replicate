import { configureStore } from '@reduxjs/toolkit';
import imagesReducer from './imagesSlice';
import messagesReducer from './messagesSlice';
import websocketReducer from './websocketSlice';
import fileExplorerReducer from './fileExplorerSlice';
import { spacesApi } from './spacesApi';

export const store = configureStore({
  reducer: {
    images: imagesReducer,
    messages: messagesReducer,
    websocket: websocketReducer,
    fileExplorer: fileExplorerReducer,
    [spacesApi.reducerPath]: spacesApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serialization checks
        ignoredActions: ['websocket/setConnectionStatus'],
      },
    }).concat(spacesApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
