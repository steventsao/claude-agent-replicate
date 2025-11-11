# Tool Runner Pattern Implementation

## Overview
Implemented the Claude API tool runner pattern to properly render agent tool use and tool results in the chat interface with structured content blocks.

## What Changed

### 1. Frontend Message Model (`frontend/store/messagesSlice.ts`)
- **Added content block types**:
  - `TextBlock`: `{ type: 'text', text: string }`
  - `ToolUseBlock`: `{ type: 'tool_use', id: string, name: string, input: Record<string, any> }`
  - `ToolResultBlock`: `{ type: 'tool_result', tool_use_id: string, content: string, is_error?: boolean }`
- **Updated Message interface**: `content` now supports both `string` (legacy) and `ContentBlock[]` (structured)

### 2. ToolBlock Component (`frontend/components/ToolBlock.jsx`)
- **New React component** for rendering tool use and tool result blocks
- **Features**:
  - Expandable/collapsible UI
  - Color-coded borders (blue for tool_use, green for tool_result, red for errors)
  - Shows tool name, ID suffix, and input/output
  - Syntax-highlighted JSON display
  - Dark mode support

### 3. ChatPanel Updates (`frontend/components/ChatPanel.jsx`)
- **New `renderContentBlocks()` function**: Handles both string and structured content
- **Renders**:
  - Text blocks with existing formatMessage (code blocks, images, links)
  - Tool blocks with ToolBlock component
- **Backward compatible**: Still handles legacy plain text messages

### 4. Backend Streaming (`backend/server.py`)
- **Lines 461-492**: Updated WebSocket message streaming
- **Changes**:
  - `ToolUseBlock` → sends `{type: 'tool_use', block: {...}}` with full structure
  - `ToolResultBlock` → sends `{type: 'tool_result', block: {...}}` with content
  - Extracts text from tool result content lists
- **Preserves**: Text streaming behavior for agent responses

### 5. WebSocket Hook (`frontend/hooks/useWebSocket.js`)
- **Accumulation strategy**: Collects all content blocks (text, tool_use, tool_result) into array
- **Dispatch timing**: When 'done' signal received, dispatches complete structured message
- **Benefits**: Single message with all related blocks, proper tool context

## Message Flow

```
User sends message
     ↓
Backend streams response blocks:
  - text blocks: {type: 'agent', content: '...'}
  - tool_use: {type: 'tool_use', block: {...}}
  - tool_result: {type: 'tool_result', block: {...}}
     ↓
Frontend accumulates blocks into array
     ↓
'done' signal → dispatch complete message
     ↓
ChatPanel renders:
  - Text blocks → formatted HTML
  - Tool blocks → ToolBlock component
```

## Example Structured Message

```javascript
{
  id: "msg-123",
  type: "agent",
  content: [
    {
      type: "text",
      text: "I'll run this Python code for you."
    },
    {
      type: "tool_use",
      id: "toolu_abc123",
      name: "exec_python",
      input: {
        code: "print('hello')"
      }
    },
    {
      type: "tool_result",
      tool_use_id: "toolu_abc123",
      content: "hello\n",
      is_error: false
    },
    {
      type: "text",
      text: "The code executed successfully!"
    }
  ]
}
```

## UI Features

### ToolBlock Component
- **Header**: Click to expand/collapse
- **Tool Use**: Shows tool name and input JSON
- **Tool Result**: Shows output content
- **Error Handling**: Red border and ❌ icon for errors
- **Responsive**: Works on mobile and desktop

### Styling
- Uses CSS modules for scoped styling
- CSS variables for theming
- Dark mode auto-detection
- Monospace fonts for code display

## Benefits

1. **Better UX**: Tool calls are clearly visible and structured
2. **Debugging**: Can expand tool blocks to see exact inputs/outputs
3. **Following Standards**: Matches Claude API tool runner pattern from docs
4. **Maintainable**: Clean separation of text and tool rendering
5. **Backward Compatible**: Still handles legacy plain text messages

## Testing

Build verified successfully:
```bash
npm run build
✓ 233 modules transformed.
✓ built in 923ms
```

## Future Enhancements

- [ ] Add streaming updates for long-running tool executions
- [ ] Add copy button for tool inputs/outputs
- [ ] Add tool execution timing display
- [ ] Add visual indicators for parallel tool calls
- [ ] Add filter/search for tool calls in message history
