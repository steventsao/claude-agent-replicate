import { createSlice, createEntityAdapter, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { EntityState } from '@reduxjs/toolkit';

export interface ImageNode {
  id: string;
  url: string;
  label: string;
  position: { x: number; y: number };
  size?: { w: number; h: number }; // Optional size for tldraw shapes
  createdAt: number;
  messageId?: string; // Link to message that generated this image
  path?: string; // File path for agent access (e.g., "results/uploaded_image_20251106.jpg")
}

// Create entity adapter for normalized image management
const imagesAdapter = createEntityAdapter<ImageNode>({
  sortComparer: (a, b) => b.createdAt - a.createdAt,
});

interface ImagesState extends EntityState<ImageNode, string> {
  loading: boolean;
  error: string | null;
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  nodesInitialized: boolean;
  needsLayout: boolean;
  selectedIds: string[];
  currentSpaceId: string;
  lastSavedSnapshot: string | null; // JSON string of last saved state for comparison
  hasInitialLoad: boolean; // Track if initial canvas state has been loaded
  focusNodeByPath: string | null; // File path to focus on in canvas
}

const initialState: ImagesState = imagesAdapter.getInitialState({
  loading: false,
  error: null,
  viewport: {
    x: 0,
    y: 0,
    zoom: 1,
  },
  nodesInitialized: false,
  needsLayout: false,
  selectedIds: [],
  currentSpaceId: 'default',
  lastSavedSnapshot: null,
  hasInitialLoad: false,
  focusNodeByPath: null,
});

// Thunk to load space from file system
export const loadSpace = createAsyncThunk(
  'images/loadSpace',
  async (spaceId: string) => {
    const response = await fetch(`http://localhost:8080/api/spaces/load/${spaceId}`);

    // Handle 404 for new spaces - return empty state
    if (response.status === 404) {
      const emptySnapshot = JSON.stringify({
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      });
      return { spaceId, nodes: [], viewport: { x: 0, y: 0, zoom: 1 }, snapshot: emptySnapshot };
    }

    if (!response.ok) {
      throw new Error('Failed to load space');
    }
    const data = await response.json();

    // Create canonical snapshot for dirty detection
    const round = (n: number) => Math.round(n * 100) / 100;
    const snapshot = JSON.stringify({
      nodes: (data.nodes || [])
        .map((n: any) => ({
          id: n.id,
          url: n.url,
          label: n.label,
          position: {
            x: round(n.position?.x ?? 0),
            y: round(n.position?.y ?? 0),
          },
        }))
        .sort((a: any, b: any) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
      viewport: {
        x: round(data.viewport?.x ?? 0),
        y: round(data.viewport?.y ?? 0),
        zoom: round(data.viewport?.zoom ?? 1),
      },
    });

    return {
      spaceId,
      nodes: data.nodes || [],
      viewport: data.viewport || { x: 0, y: 0, zoom: 1 },
      snapshot,
    };
  }
);

const imagesSlice = createSlice({
  name: 'images',
  initialState,
  reducers: {
    addImage: (state, action: PayloadAction<Omit<ImageNode, 'id' | 'createdAt'>>) => {
      const image: ImageNode = {
        id: `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
        ...action.payload,
      };
      imagesAdapter.addOne(state, image);
      state.needsLayout = true; // Trigger layout on new image
    },

    updateImage: (state, action: PayloadAction<{ id: string; changes: Partial<ImageNode> }>) => {
      const { id, changes } = action.payload;
      imagesAdapter.updateOne(state, { id, changes });
    },

    removeImage: (state, action: PayloadAction<string>) => {
      imagesAdapter.removeOne(state, action.payload);
    },

    clearImages: (state) => {
      imagesAdapter.removeAll(state);
    },

    setViewport: (state, action: PayloadAction<{ x: number; y: number; zoom: number }>) => {
      state.viewport = action.payload;
    },

    setNodesInitialized: (state, action: PayloadAction<boolean>) => {
      state.nodesInitialized = action.payload;
    },

    setNeedsLayout: (state, action: PayloadAction<boolean>) => {
      state.needsLayout = action.payload;
    },

    applyLayout: (state, action: PayloadAction<ImageNode[]>) => {
      const layoutedNodes = action.payload;
      layoutedNodes.forEach(node => {
        imagesAdapter.updateOne(state, {
          id: node.id,
          changes: { position: node.position }
        });
      });
      state.needsLayout = false;
    },

    setSelectedImages: (state, action: PayloadAction<string[]>) => {
      state.selectedIds = action.payload;
    },

    toggleImageSelection: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      const index = state.selectedIds.indexOf(id);
      if (index >= 0) {
        state.selectedIds.splice(index, 1);
      } else {
        state.selectedIds.push(id);
      }
    },

    clearSelection: (state) => {
      state.selectedIds = [];
    },

    setCurrentSpace: (state, action: PayloadAction<string>) => {
      state.currentSpaceId = action.payload;
    },

    setLastSavedSnapshot: (state, action: PayloadAction<string>) => {
      state.lastSavedSnapshot = action.payload;
    },

    setFocusNodeByPath: (state, action: PayloadAction<string | null>) => {
      state.focusNodeByPath = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSpace.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadSpace.fulfilled, (state, action) => {
        const { nodes, viewport, spaceId, snapshot } = action.payload;

        // Clear existing state
        imagesAdapter.removeAll(state);

        // Load nodes from file system
        imagesAdapter.addMany(state, nodes);

        // Load viewport
        state.viewport = viewport;

        // Set current space
        state.currentSpaceId = spaceId;

        // Clear selection
        state.selectedIds = [];

        // Don't auto-layout loaded state
        state.needsLayout = false;

        // Save snapshot for dirty detection
        state.lastSavedSnapshot = snapshot;

        // Mark initial load as complete
        state.hasInitialLoad = true;

        state.loading = false;
      })
      .addCase(loadSpace.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load space';
      });
  },
});

export const {
  addImage,
  updateImage,
  removeImage,
  clearImages,
  setViewport,
  setNodesInitialized,
  setNeedsLayout,
  applyLayout,
  setSelectedImages,
  toggleImageSelection,
  clearSelection,
  setCurrentSpace,
  setLastSavedSnapshot,
  setFocusNodeByPath,
} = imagesSlice.actions;

// Export selectors from adapter
export const imagesSelectors = imagesAdapter.getSelectors(
  (state: any) => state.images
);

// Custom selectors
export const selectViewport = (state: any) => state.images.viewport;
export const selectNodesInitialized = (state: any) => state.images.nodesInitialized;
export const selectNeedsLayout = (state: any) => state.images.needsLayout;
export const selectSelectedIds = (state: any) => state.images.selectedIds;

// Selector for selected images with full metadata
export const selectSelectedImages = (state: any) => {
  const selectedIds = state.images.selectedIds;
  return selectedIds.map((id: string) => state.images.entities[id]).filter(Boolean);
};

// Space selectors
export const selectCurrentSpaceId = (state: any) => state.images.currentSpaceId;
export const selectLastSavedSnapshot = (state: any) => state.images.lastSavedSnapshot;
export const selectHasInitialLoad = (state: any) => state.images.hasInitialLoad;
export const selectFocusNodeByPath = (state: any) => state.images.focusNodeByPath;

// Computed selector for isDirty based on deep comparison
export const selectIsDirty = (state: any) => {
  const { lastSavedSnapshot, viewport } = state.images;

  if (!lastSavedSnapshot) return false;

  // Helper to round numbers to a fixed precision to avoid tiny drift
  const round = (n: number) => Math.round(n * 100) / 100;

  // Build a canonical, stable snapshot:
  // - use sorted nodes array
  // - only include relevant fields
  // - round numeric values to reduce jitter
  const nodesSorted = imagesSelectors
    .selectAll(state)
    .map((node: any) => ({
      id: node.id,
      url: node.url,
      label: node.label,
      position: { x: round(node.position?.x ?? 0), y: round(node.position?.y ?? 0) },
    }))
    .sort((a: any, b: any) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const currentSnapshot = JSON.stringify({
    nodes: nodesSorted,
    viewport: {
      x: round(viewport?.x ?? 0),
      y: round(viewport?.y ?? 0),
      zoom: round(viewport?.zoom ?? 1),
    },
  });

  return currentSnapshot !== lastSavedSnapshot;
};

export default imagesSlice.reducer;
