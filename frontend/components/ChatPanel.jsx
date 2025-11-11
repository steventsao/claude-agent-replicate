import React, { useState, useRef, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { selectOrderedMessages } from '../store/messagesSlice';
import { selectSelectedImages, toggleImageSelection } from '../store/imagesSlice';
import ToolBlock from './ToolBlock';

function ChatPanel({ status, onSendMessage, onClearChat }) {
  const [input, setInput] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const messagesEndRef = useRef(null);
  const dispatch = useAppDispatch();
  const messages = useAppSelector(selectOrderedMessages);
  const selectedImages = useAppSelector(selectSelectedImages);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Build prompt with selected images metadata
    let fullPrompt = input;

    if (selectedImages.length > 0) {
      // Only include images with valid paths or URLs (no base64)
      const imageMetadata = selectedImages
        .filter(img => img.path || (img.url && (img.url.startsWith('http://') || img.url.startsWith('https://'))))
        .map(img => ({
          label: img.label,
          path: img.path,
          url: img.url,
          id: img.id,
        }));

      if (imageMetadata.length > 0) {
        const metadataText = imageMetadata
          .map(img => {
            const location = img.path ? `Path: ${img.path}` : `URL: ${img.url}`;
            return `- ${img.label}\n  ${location}\n  ID: ${img.id}`;
          })
          .join('\n');

        fullPrompt = `${input}\n\n[User selected images on canvas:\n${metadataText}]`;
      }
    }

    onSendMessage(fullPrompt);
    setInput('');
  };

  const formatMessage = (content) => {
    // Escape HTML
    let formatted = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Handle code blocks
    formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Handle inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Handle line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    // Detect and render image URLs
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?[^\s]*)?$/i;
    formatted = formatted.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
      if (imageExtensions.test(url)) {
        return `<a href="${url}" target="_blank">${url}</a><br><img src="${url}" alt="Generated image" style="max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">`;
      }
      return url;
    });

    return formatted;
  };

  // Render structured content blocks (text, tool_use, tool_result)
  const renderContentBlocks = (content) => {
    if (typeof content === 'string') {
      // Legacy plain text messages
      return <div dangerouslySetInnerHTML={{ __html: formatMessage(content) }} />;
    }

    // Structured content blocks
    if (Array.isArray(content)) {
      return (
        <>
          {content.map((block, idx) => {
            if (block.type === 'text') {
              return (
                <div
                  key={idx}
                  dangerouslySetInnerHTML={{ __html: formatMessage(block.text) }}
                />
              );
            }
            if (block.type === 'tool_use' || block.type === 'tool_result') {
              return <ToolBlock key={idx} block={block} />;
            }
            return null;
          })}
        </>
      );
    }

    return null;
  };

  return (
    <div className={`chat-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <button
        className="collapse-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expand chat' : 'Collapse chat'}
      >
        {isCollapsed ? '«' : '»'}
      </button>

      <div className="chat-header">
        <h2>Claude Agent + Replicate</h2>
        <div className="header-controls">
          <button onClick={onClearChat} className="clear-button">
            Clear Chat
          </button>
          <div className={`status ${status}`}>{status}</div>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.type}`}>
            {msg.type === 'typing' ? (
              <div className="typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            ) : (
              renderContentBlocks(msg.content)
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="chat-input">
        {selectedImages.length > 0 && (
          <div className="selected-images-container">
            {selectedImages.map((img, idx) => (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  width: '70px',
                  height: '70px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '2px solid rgba(26, 115, 232, 0.3)',
                  background: '#f5f5f5',
                }}
              >
                <img
                  src={img.url}
                  alt={img.label}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                <button
                  onClick={() => dispatch(toggleImageSelection(img.id))}
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    lineHeight: '1',
                    padding: 0,
                  }}
                  title="Remove"
                >
                  ×
                </button>
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  fontSize: '10px',
                  padding: '2px 4px',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}>
                  {img.label}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="input-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask Claude to run code with Replicate..."
            rows="3"
            disabled={status !== 'connected'}
          />
          <button type="submit" disabled={status !== 'connected' || !input.trim()}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

export default ChatPanel;
