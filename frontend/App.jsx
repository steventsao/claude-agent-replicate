import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Canvas from './components/Canvas';
import ChatPanel from './components/ChatPanel';
import FileExplorer from './components/FileExplorer';
import { useWebSocket } from './hooks/useWebSocket';
import { isTauri } from './hooks/useTauri';

function AppContent() {
  const { status, sendMessage, clearChat } = useWebSocket();
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileSelect = (filePath, content) => {
    setSelectedFile({ path: filePath, content });
    console.log('File selected:', filePath);
    // You can add logic here to display file content or send it to the chat
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {isTauri() && <FileExplorer onFileSelect={handleFileSelect} />}
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
