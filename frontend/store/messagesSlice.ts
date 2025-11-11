import { createSlice, createEntityAdapter, createSelector, PayloadAction } from '@reduxjs/toolkit';
import type { EntityState } from '@reduxjs/toolkit';

// Content block types matching Claude API structure
export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface Message {
  id: string;
  content: string | ContentBlock[]; // Support both plain text and structured blocks
  type: 'user' | 'agent' | 'error' | 'typing';
  timestamp: number;
  imageUrls?: string[]; // Track any image URLs in this message
}

// Create entity adapter for normalized message management
const messagesAdapter = createEntityAdapter<Message>({
  sortComparer: (a, b) => a.timestamp - b.timestamp,
});

interface MessagesState extends EntityState<Message, string> {
  messageOrder: string[]; // Explicit ordering for display
  loading: boolean;
  error: string | null;
}

const initialState: MessagesState = messagesAdapter.getInitialState({
  messageOrder: [],
  loading: false,
  error: null,
});

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<Omit<Message, 'id' | 'timestamp'>>) => {
      const message: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        ...action.payload,
      };
      messagesAdapter.addOne(state, message);
      state.messageOrder.push(message.id);
    },

    updateMessage: (state, action: PayloadAction<{ id: string; changes: Partial<Message> }>) => {
      const { id, changes } = action.payload;
      messagesAdapter.updateOne(state, { id, changes });
    },

    removeMessage: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      messagesAdapter.removeOne(state, id);
      state.messageOrder = state.messageOrder.filter(msgId => msgId !== id);
    },

    removeTypingIndicator: (state) => {
      const typingMessages = state.ids.filter(id => {
        const msg = state.entities[id];
        return msg?.type === 'typing';
      });

      typingMessages.forEach(id => {
        messagesAdapter.removeOne(state, id);
        state.messageOrder = state.messageOrder.filter(msgId => msgId !== id);
      });
    },

    clearMessages: (state) => {
      messagesAdapter.removeAll(state);
      state.messageOrder = [];
    },

    setMessages: (state, action: PayloadAction<Message[]>) => {
      messagesAdapter.setAll(state, action.payload);
      state.messageOrder = action.payload.map(m => m.id);
    },
  },
});

export const {
  addMessage,
  updateMessage,
  removeMessage,
  removeTypingIndicator,
  clearMessages,
  setMessages,
} = messagesSlice.actions;

// Export selectors from adapter
export const messagesSelectors = messagesAdapter.getSelectors(
  (state: any) => state.messages
);

// Memoized selector for ordered messages
export const selectOrderedMessages = createSelector(
  [(state: any) => state.messages.messageOrder, (state: any) => state.messages.entities],
  (messageOrder, entities) => {
    return messageOrder
      .map((id: string) => entities[id])
      .filter(Boolean) as Message[];
  }
);

export default messagesSlice.reducer;
