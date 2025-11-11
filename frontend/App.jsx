import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Canvas from './components/Canvas';
import ChatPanel from './components/ChatPanel';
import { useWebSocket } from './hooks/useWebSocket';

function AppContent() {
  const { status, sendMessage, clearChat } = useWebSocket();

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <Canvas />
      <ChatPanel
        status={status}
        onSendMessage={sendMessage}
        onClearChat={clearChat}
      />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/space/:spaceId" element={<AppContent />} />
        <Route path="/" element={<Navigate to="/space/default" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
