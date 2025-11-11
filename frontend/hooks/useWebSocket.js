import { useEffect, useRef, useCallback } from 'react';
import { useStore } from 'react-redux';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  addMessage,
  updateMessage,
  removeTypingIndicator,
  clearMessages,
} from '../store/messagesSlice';
import {
  setConnectionStatus,
  setConnectionError,
  incrementReconnectAttempts,
} from '../store/websocketSlice';
import { addImage, imagesSelectors } from '../store/imagesSlice';
import { calculateNodePosition } from '../utils/nodePositioning';

export function useWebSocket() {
  const dispatch = useAppDispatch();
  const store = useStore();
  const status = useAppSelector((state) => state.websocket.status);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const currentMessageRef = useRef(null); // Track current structured message being built


  const connect = useCallback((storeInstance) => {
    dispatch(setConnectionStatus('connecting'));
    const ws = new WebSocket('ws://localhost:8866');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to agent');
      dispatch(setConnectionStatus('connected'));
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Add welcome message
      setTimeout(() => {
        dispatch(addMessage({
          content: 'Welcome! Ask me to run Python code with Replicate models.',
          type: 'agent',
        }));
      }, 500);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received:', data);

      if (data.type === 'pong') {
        return;
      }

      if (data.type === 'image_downloaded') {
        // Handle downloaded images - add directly to canvas
        const urls = data.urls || [];
        console.log('Images downloaded:', urls);

        urls.forEach((url) => {
          const state = storeInstance.getState();
          const existingNodes = imagesSelectors.selectAll(state);
          const position = calculateNodePosition(existingNodes);

          dispatch(addImage({
            url,
            // label: 'Downloaded Image',
            position,
          }));
        });

        return;
      }

      // Initialize current message if needed (create message on first block)
      if (!currentMessageRef.current) {
        dispatch(removeTypingIndicator());
        // Create initial message that we'll update progressively
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        dispatch(addMessage({
          id: messageId,
          timestamp: Date.now(),
          content: [],
          type: 'agent'
        }));
        currentMessageRef.current = {
          messageId,
          blocks: []
        };
      }

      if (data.type === 'agent') {
        // Add text block and update message immediately
        const textBlock = {
          type: 'text',
          text: data.content,
        };
        currentMessageRef.current.blocks.push(textBlock);
        dispatch(updateMessage({
          id: currentMessageRef.current.messageId,
          changes: {
            content: [...currentMessageRef.current.blocks]
          }
        }));
      } else if (data.type === 'tool_use') {
        // Add tool use block and update immediately
        currentMessageRef.current.blocks.push(data.block);
        dispatch(updateMessage({
          id: currentMessageRef.current.messageId,
          changes: {
            content: [...currentMessageRef.current.blocks]
          }
        }));
      } else if (data.type === 'tool_result') {
        // Add tool result block and update immediately
        currentMessageRef.current.blocks.push(data.block);
        dispatch(updateMessage({
          id: currentMessageRef.current.messageId,
          changes: {
            content: [...currentMessageRef.current.blocks]
          }
        }));
      } else if (data.type === 'error') {
        dispatch(removeTypingIndicator());
        dispatch(addMessage({
          content: data.content,
          type: 'error',
        }));
        currentMessageRef.current = null;
      } else if (data.type === 'done') {
        // Just cleanup - message is already complete
        currentMessageRef.current = null;
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      dispatch(setConnectionError('Connection error occurred'));
      dispatch(addMessage({
        content: 'Connection error occurred',
        type: 'error',
      }));
    };

    ws.onclose = () => {
      console.log('Disconnected from agent');
      dispatch(setConnectionStatus('disconnected'));
      dispatch(incrementReconnectAttempts());

      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('Attempting to reconnect...');
        connect();
      }, 3000);
    };

    // Keep connection alive with ping
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      ws.close();
    };
  }, [dispatch]);

  useEffect(() => {
    const cleanup = connect(store);
    return () => {
      if (cleanup) cleanup();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect, store]);

  const sendMessage = useCallback((message) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    dispatch(addMessage({ content: message, type: 'user' }));
    wsRef.current.send(JSON.stringify({ type: 'chat', message }));
    dispatch(addMessage({ content: '', type: 'typing' }));
  }, [dispatch]);

  const clearChat = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    dispatch(clearMessages());
    wsRef.current.send(JSON.stringify({ type: 'clear' }));
    dispatch(addMessage({
      content: 'Conversation cleared. What would you like to create?',
      type: 'agent',
    }));
  }, [dispatch]);

  return { status, sendMessage, clearChat };
}
