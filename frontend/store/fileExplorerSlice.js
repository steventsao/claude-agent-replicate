import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  openedFolder: null,
  files: [],
  selectedFile: null,
  expandedFolders: [],
};

const fileExplorerSlice = createSlice({
  name: 'fileExplorer',
  initialState,
  reducers: {
    setOpenedFolder: (state, action) => {
      state.openedFolder = action.payload;
    },
    setFiles: (state, action) => {
      state.files = action.payload;
    },
    setSelectedFile: (state, action) => {
      state.selectedFile = action.payload;
    },
    toggleFolderExpanded: (state, action) => {
      const folderPath = action.payload;
      const index = state.expandedFolders.indexOf(folderPath);
      if (index > -1) {
        state.expandedFolders.splice(index, 1);
      } else {
        state.expandedFolders.push(folderPath);
      }
    },
    clearFileExplorer: (state) => {
      state.openedFolder = null;
      state.files = [];
      state.selectedFile = null;
      state.expandedFolders = [];
    },
  },
});

export const {
  setOpenedFolder,
  setFiles,
  setSelectedFile,
  toggleFolderExpanded,
  clearFileExplorer,
} = fileExplorerSlice.actions;

export default fileExplorerSlice.reducer;
