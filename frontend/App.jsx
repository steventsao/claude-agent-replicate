import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Canvas from './components/Canvas';
import ChatPanel from './components/ChatPanel';
import FileExplorer from './components/FileExplorer';
import { useWebSocket } from './hooks/useWebSocket';
import { isTauri, readImageAsDataUrl } from './hooks/useTauri';
import { clearImages, addImage } from './store/imagesSlice';

function AppContent() {
  const { status, sendMessage, clearChat } = useWebSocket();
  const dispatch = useDispatch();

  const collectImageFiles = (fileTree, basePath = '') => {
    const images = [];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

    const traverse = (nodes, currentPath) => {
      nodes.forEach(node => {
        const fullPath = `${currentPath}/${node.name}`;

        if (node.is_dir && node.children) {
          traverse(node.children, fullPath);
        } else {
          const ext = node.name.toLowerCase().match(/\.[^.]+$/)?.[0];
          if (ext && imageExtensions.includes(ext)) {
            images.push({
              path: node.path,
              name: node.name,
              fullPath: fullPath,
            });
          }
        }
      });
    };

    traverse(fileTree, basePath);
    return images;
  };

  const handleFolderOpen = async (folderPath, fileTree) => {
    // Clear existing images
    dispatch(clearImages());

    // Collect all image files from the tree
    const imageFiles = collectImageFiles(fileTree, folderPath);

    // Load images into canvas with data URLs
    for (let index = 0; index < imageFiles.length; index++) {
      const img = imageFiles[index];
      const dataUrl = await readImageAsDataUrl(img.path);

      if (dataUrl) {
        dispatch(addImage({
          url: dataUrl,
          path: img.path,
          label: img.name,
          position: {
            x: (index % 5) * 350,
            y: Math.floor(index / 5) * 350,
          },
        }));
      }
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {isTauri() && <FileExplorer onFileSelect={handleFolderOpen} />}
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
