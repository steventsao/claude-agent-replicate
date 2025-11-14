import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FolderOpen, Folder, ChevronRight, ChevronDown, File, MapPin, PanelLeftClose } from 'lucide-react';
import {
  setOpenedFolder,
  setFiles,
  setSelectedFile,
  toggleFolderExpanded,
} from '../store/fileExplorerSlice';
import { setFocusNodeByPath, setSelectedImages, imagesSelectors } from '../store/imagesSlice';
import {
  openFolderDialog,
  readDirectory,
  readFileContent,
  isTauri,
} from '../hooks/useTauri';
import './FileExplorer.css';

// Allowed image file extensions
const ALLOWED_IMAGE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.bmp', '.svg', '.ico', '.tiff', '.tif'
];

// Check if a file is an allowed image type
const isImageFile = (filename) => {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return ALLOWED_IMAGE_EXTENSIONS.includes(ext);
};

// Recursively filter tree to only include image files, but keep all directories
const filterImageFiles = (nodes) => {
  if (!nodes || !Array.isArray(nodes)) return [];

  return nodes.reduce((acc, node) => {
    if (node.is_dir) {
      // Always include directories, recursively filter their children
      const filteredChildren = filterImageFiles(node.children);
      acc.push({ ...node, children: filteredChildren });
    } else if (isImageFile(node.name)) {
      // Include file only if it's an image
      acc.push(node);
    }
    return acc;
  }, []);
};

// Count total number of image files in the tree
const countImageFiles = (nodes) => {
  if (!nodes || !Array.isArray(nodes)) return 0;

  return nodes.reduce((count, node) => {
    if (node.is_dir) {
      return count + countImageFiles(node.children);
    } else if (isImageFile(node.name)) {
      return count + 1;
    }
    return count;
  }, 0);
};

const MAX_IMAGE_FILES = 100;

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
          {node.is_dir ? (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <File size={14} />
          )}
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
  const images = useSelector(imagesSelectors.selectAll);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleOpenFolder = async () => {
    setLoading(true);
    setError(null);
    try {
      const folderPath = await openFolderDialog();
      if (folderPath) {
        const fileTree = await readDirectory(folderPath);

        // Count total image files recursively
        const imageCount = countImageFiles(fileTree);

        // Check if count exceeds limit
        if (imageCount > MAX_IMAGE_FILES) {
          setError(
            `The selected folder contains ${imageCount} image files, which exceeds the maximum of ${MAX_IMAGE_FILES}. Please select a folder with fewer images.`
          );
          return;
        }

        dispatch(setOpenedFolder(folderPath));

        // Filter to only show image files (but keep directory hierarchy)
        const filteredTree = filterImageFiles(fileTree);
        dispatch(setFiles(filteredTree));

        // Load images from the folder into canvas (pass original tree for loading)
        if (onFileSelect) {
          onFileSelect(folderPath, fileTree);
        }
      }
    } catch (error) {
      console.error('Error opening folder:', error);
      setError('Failed to open folder. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = async (filePath) => {
    // Find the image node with this file path
    const targetImage = images.find(img => img.path === filePath);

    if (targetImage) {
      // Replace selection with just this image (single click = replace, not toggle)
      dispatch(setSelectedImages([targetImage.id]));

      // Also focus on it in the canvas
      dispatch(setFocusNodeByPath(filePath));
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
    <>
      <div
        className={`file-explorer ${isCollapsed ? 'collapsed' : ''}`}
        onClick={isCollapsed ? () => setIsCollapsed(false) : undefined}
      >
        {isCollapsed && (
          <ChevronRight className="file-explorer-expand-icon" size={20} />
        )}
        <div className="file-explorer-header">
          <button
            className="open-folder-icon-button"
            onClick={handleOpenFolder}
            disabled={loading}
            title={loading ? 'Loading...' : 'Open Folder'}
          >
            <FolderOpen size={18} />
          </button>
          <button
            className="minimize-button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title="Collapse sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
      {error && (
        <div className="file-explorer-error">
          {error}
        </div>
      )}
      {openedFolder && (
        <div className="file-explorer-path">
          <span className="path-label">
            <MapPin size={14} />
          </span>
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
    </>
  );
};

export default FileExplorer;
