import { useState, useEffect } from 'react';

// Check if we're running in Tauri
export const isTauri = () => {
  return window.__TAURI__ !== undefined;
};

export const useTauri = () => {
  const [tauriAvailable, setTauriAvailable] = useState(false);

  useEffect(() => {
    setTauriAvailable(isTauri());
  }, []);

  return { tauriAvailable };
};

// File system operations
export const openFolderDialog = async () => {
  if (!isTauri()) {
    console.warn('Tauri is not available');
    return null;
  }

  try {
    const result = await window.__TAURI_INTERNALS__.invoke('open_folder_dialog');
    return result;
  } catch (error) {
    console.error('Error opening folder dialog:', error);
    return null;
  }
};

export const readDirectory = async (path) => {
  if (!isTauri()) {
    console.warn('Tauri is not available');
    return [];
  }

  try {
    const result = await window.__TAURI_INTERNALS__.invoke('read_directory', { path });
    return result;
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
};

export const readFileContent = async (path) => {
  if (!isTauri()) {
    console.warn('Tauri is not available');
    return null;
  }

  try {
    const result = await window.__TAURI_INTERNALS__.invoke('read_file_content', { path });
    return result;
  } catch (error) {
    console.error('Error reading file:', error);
    return null;
  }
};

export const readImageAsDataUrl = async (path) => {
  if (!isTauri()) {
    console.warn('Tauri is not available');
    return null;
  }

  try {
    const result = await window.__TAURI_INTERNALS__.invoke('read_image_as_data_url', { path });
    return result;
  } catch (error) {
    console.error('Error reading image:', error);
    return null;
  }
};

export const writeFileContent = async (path, content) => {
  if (!isTauri()) {
    console.warn('Tauri is not available');
    return false;
  }

  try {
    await window.__TAURI_INTERNALS__.invoke('write_file_content', { path, content });
    return true;
  } catch (error) {
    console.error('Error writing file:', error);
    return false;
  }
};

export const getFileMetadata = async (path) => {
  if (!isTauri()) {
    console.warn('Tauri is not available');
    return null;
  }

  try {
    const result = await window.__TAURI_INTERNALS__.invoke('get_file_metadata', { path });
    return result;
  } catch (error) {
    console.error('Error getting file metadata:', error);
    return null;
  }
};
