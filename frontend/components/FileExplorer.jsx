import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setOpenedFolder,
  setFiles,
  setSelectedFile,
  toggleFolderExpanded,
} from '../store/fileExplorerSlice';
import {
  openFolderDialog,
  readDirectory,
  readFileContent,
  isTauri,
} from '../hooks/useTauri';
import './FileExplorer.css';

const FileTreeNode = ({ node, level = 0, onFileClick }) => {
  const dispatch = useDispatch();
  const expandedFolders = useSelector((state) => state.fileExplorer.expandedFolders);
  const selectedFile = useSelector((state) => state.fileExplorer.selectedFile);
  const isExpanded = expandedFolders.includes(node.path);
  const isSelected = selectedFile === node.path;

  const handleClick = () => {
    if (node.is_dir) {
      dispatch(toggleFolderExpanded(node.path));
    } else {
      dispatch(setSelectedFile(node.path));
      onFileClick(node.path);
    }
  };

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        <span className="file-icon">
          {node.is_dir ? (isExpanded ? '📂' : '📁') : '📄'}
        </span>
        <span className="file-name">{node.name}</span>
      </div>
      {node.is_dir && isExpanded && node.children && (
        <div className="file-tree-children">
          {node.children.map((child, index) => (
            <FileTreeNode
              key={`${child.path}-${index}`}
              node={child}
              level={level + 1}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FileExplorer = ({ onFileSelect }) => {
  const dispatch = useDispatch();
  const { openedFolder, files } = useSelector((state) => state.fileExplorer);
  const [loading, setLoading] = useState(false);

  const handleOpenFolder = async () => {
    setLoading(true);
    try {
      const folderPath = await openFolderDialog();
      if (folderPath) {
        dispatch(setOpenedFolder(folderPath));
        const fileTree = await readDirectory(folderPath);
        dispatch(setFiles(fileTree));
      }
    } catch (error) {
      console.error('Error opening folder:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = async (filePath) => {
    if (onFileSelect) {
      try {
        const content = await readFileContent(filePath);
        onFileSelect(filePath, content);
      } catch (error) {
        console.error('Error reading file:', error);
      }
    }
  };

  if (!isTauri()) {
    return (
      <div className="file-explorer">
        <div className="file-explorer-header">
          <div className="not-available">
            File explorer is only available in desktop mode
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <button
          className="open-folder-button"
          onClick={handleOpenFolder}
          disabled={loading}
        >
          {loading ? 'Loading...' : '📁 Open Folder'}
        </button>
      </div>
      {openedFolder && (
        <div className="file-explorer-path">
          <span className="path-label">📍</span>
          <span className="path-text" title={openedFolder}>
            {openedFolder.split('/').pop() || openedFolder}
          </span>
        </div>
      )}
      <div className="file-tree">
        {files.length > 0 ? (
          files.map((node, index) => (
            <FileTreeNode
              key={`${node.path}-${index}`}
              node={node}
              onFileClick={handleFileClick}
            />
          ))
        ) : (
          <div className="empty-state">
            {openedFolder ? 'No files found' : 'Open a folder to get started'}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileExplorer;
