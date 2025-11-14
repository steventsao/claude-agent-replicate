import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useNodesInitialized,
  ReactFlowProvider,
  SelectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import {
  imagesSelectors,
  updateImage,
  setViewport,
  selectViewport,
  setNodesInitialized,
  selectNeedsLayout,
  applyLayout,
  addImage,
  setSelectedImages,
  selectSelectedIds,
  toggleImageSelection,
  selectCurrentSpaceId,
  removeImage,
  loadSpace,
  selectIsDirty,
  setLastSavedSnapshot,
  selectHasInitialLoad,
  selectFocusNodeByPath,
  setFocusNodeByPath,
} from '../store/imagesSlice';
import { layoutNodes } from '../utils/nodePositioning';
import { useDeleteImageMutation } from '../store/spacesApi';

function ImageNode({ data, selected }) {
  return (
    <div style={{
      padding: '12px',
      background: 'rgba(255, 255, 255, 0.98)',
      backdropFilter: 'blur(8px)',
      border: '1px solid',
      borderColor: selected ? '#10a37f' : 'rgba(0, 0, 0, 0.08)',
      borderRadius: '16px',
      boxShadow: selected
        ? '0 8px 24px rgba(16, 163, 127, 0.15), 0 0 0 2px rgba(16, 163, 127, 0.3)'
        : '0 2px 8px rgba(0, 0, 0, 0.04)',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
    }}>
      {selected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onDeselect();
          }}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            lineHeight: '1',
            padding: 0,
            zIndex: 10,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.9)';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.7)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Deselect"
        >
          ×
        </button>
      )}
      <img
        src={data.url}
        alt={data.label}
        style={{
          width: '300px',
          height: 'auto',
          display: 'block',
          borderRadius: '8px',
        }}
        onError={(e) => {
          console.error('Image failed to load:', data.url);
          e.target.style.border = '2px dashed red';
        }}
      />
      {data.label && (
        <div style={{
          marginTop: '10px',
          fontSize: '13px',
          color: '#6b7280',
          fontWeight: '500',
          letterSpacing: '-0.01em',
        }}>
          {data.label}
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  image: ImageNode,
};

function CanvasInner() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { spaceId: urlSpaceId } = useParams();
  const spaceToLoad = urlSpaceId || 'default';

  const images = useAppSelector(imagesSelectors.selectAll);
  const viewport = useAppSelector(selectViewport);
  const needsLayout = useAppSelector(selectNeedsLayout);
  const selectedIds = useAppSelector(selectSelectedIds);
  const currentSpaceId = useAppSelector(selectCurrentSpaceId);
  const isDirty = useAppSelector(selectIsDirty);
  const hasInitialLoad = useAppSelector(selectHasInitialLoad);
  const focusNodeByPath = useAppSelector(selectFocusNodeByPath);

  const [saving, setSaving] = useState(false);

  const { fitView, getNodes, screenToFlowPosition, getNode } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const prevImagesLengthRef = useRef(images.length);
  const autoFocusEnabled = import.meta.env.VITE_AUTO_FOCUS_NEW_IMAGES === 'true';

  const [deleteImage] = useDeleteImageMutation();

  // Listen for focus requests from file explorer
  useEffect(() => {
    if (focusNodeByPath && nodesInitialized) {
      const targetImage = images.find(img => img.path === focusNodeByPath);
      if (targetImage) {
        const node = getNode(targetImage.id);
        if (node) {
          fitView({
            duration: 500,
            padding: 0.3,
            nodes: [node],
          });
          // Clear the focus request
          dispatch(setFocusNodeByPath(null));
        }
      }
    }
  }, [focusNodeByPath, images, nodesInitialized, getNode, fitView, dispatch]);

  // Initial canvas state load - runs once on mount
  useEffect(() => {
    if (!hasInitialLoad) {
      dispatch(loadSpace(spaceToLoad));
    }
  }, [hasInitialLoad, spaceToLoad, dispatch]);

  // Handle URL changes (e.g., browser back/forward, manual URL edit)
  // SpaceSwitcher loads before navigating, but we need to handle direct URL changes
  useEffect(() => {
    const handleUrlChange = async () => {
      if (hasInitialLoad && spaceToLoad !== currentSpaceId) {
        try {
          await dispatch(loadSpace(spaceToLoad)).unwrap();
        } catch (error) {
          console.error('Failed to load space from URL:', error);
          // Redirect back to the current valid space
          navigate(`/space/${currentSpaceId}`, { replace: true });
        }
      }
    };

    handleUrlChange();
  }, [hasInitialLoad, spaceToLoad, currentSpaceId, dispatch, navigate]);

  // Callback to deselect an image
  const handleDeselect = useCallback((imageId) => {
    dispatch(toggleImageSelection(imageId));
  }, [dispatch]);

  // Callback to delete an image
  const handleDelete = useCallback(async (imageId) => {
    try {
      await deleteImage({ spaceId: currentSpaceId, imageId }).unwrap();
      dispatch(removeImage(imageId));
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  }, [deleteImage, currentSpaceId, dispatch]);

  // Callback to save the canvas
  const handleSave = useCallback(async () => {
    setSaving(true);

    try {
      // Convert Redux images to storage format
      const storageNodes = images.map(image => ({
        id: image.id,
        url: image.url,
        label: image.label,
        position: image.position,
        path: image.path,
        createdAt: image.createdAt,
      }));

      const state = {
        nodes: storageNodes,
        viewport: {
          x: viewport.x,
          y: viewport.y,
          zoom: viewport.zoom,
        },
      };

      const response = await fetch('http://localhost:8080/api/spaces/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          space_id: currentSpaceId,
          state,
        }),
      });

      if (!response.ok) {
        throw new Error('Save failed');
      }

      // Create canonical snapshot for comparison
      const round = (n) => Math.round(n * 100) / 100;
      const snapshot = JSON.stringify({
        nodes: storageNodes
          .map(n => ({
            id: n.id,
            url: n.url,
            label: n.label,
            position: { x: round(n.position?.x ?? 0), y: round(n.position?.y ?? 0) },
          }))
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
        viewport: {
          x: round(state.viewport?.x ?? 0),
          y: round(state.viewport?.y ?? 0),
          zoom: round(state.viewport?.zoom ?? 1),
        },
      });

      dispatch(setLastSavedSnapshot(snapshot));
      console.log(`Canvas saved to space: ${currentSpaceId}`);
    } catch (error) {
      console.error('Error saving canvas:', error);
      alert('Failed to save canvas');
    } finally {
      setSaving(false);
    }
  }, [images, viewport, currentSpaceId, dispatch]);

  // Convert Redux images to React Flow nodes
  const nodes = images.map((image) => ({
    id: image.id,
    type: 'image',
    position: image.position,
    data: {
      url: image.url,
      label: image.label,
      onDeselect: () => handleDeselect(image.id),
    },
    selected: selectedIds.includes(image.id),
  }));

  const [reactFlowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Only sync Redux to React Flow when images are added/removed, not on position changes
  useEffect(() => {
    // Compare node IDs to detect add/remove
    const currentIds = new Set(reactFlowNodes.map(n => n.id));
    const newIds = new Set(images.map(img => img.id));

    const idsChanged = currentIds.size !== newIds.size ||
      [...newIds].some(id => !currentIds.has(id));

    if (idsChanged) {
      setNodes(nodes);
    }
  }, [images.length, images, selectedIds, setNodes, handleDeselect]);

  // Track nodes initialization
  useEffect(() => {
    dispatch(setNodesInitialized(nodesInitialized));
  }, [nodesInitialized, dispatch]);

  // Auto-layout hook: applies grid layout when nodes are ready
  useEffect(() => {
    if (nodesInitialized && needsLayout && images.length > 0) {
      const layoutedNodes = layoutNodes(images);
      dispatch(applyLayout(layoutedNodes));

      // Fit view after layout with animation
      setTimeout(() => {
        fitView({ duration: 300, padding: 0.2 });
      }, 50);
    }
  }, [nodesInitialized, needsLayout, images, dispatch, fitView]);

  // Auto-focus on new images when enabled
  useEffect(() => {
    if (!autoFocusEnabled || !nodesInitialized) return;

    const prevLength = prevImagesLengthRef.current;
    const currentLength = images.length;

    // Check if new images were added
    if (currentLength > prevLength) {
      // Get the newly added images (last N images)
      const newImages = images.slice(prevLength);
      const newNodeIds = newImages.map(img => img.id);

      // Focus on the new nodes
      setTimeout(() => {
        const nodesToFocus = newNodeIds
          .map(id => getNode(id))
          .filter(Boolean);

        if (nodesToFocus.length > 0) {
          // Calculate bounding box of new nodes
          const minX = Math.min(...nodesToFocus.map(n => n.position.x));
          const maxX = Math.max(...nodesToFocus.map(n => n.position.x + 300)); // 300px image width
          const minY = Math.min(...nodesToFocus.map(n => n.position.y));
          const maxY = Math.max(...nodesToFocus.map(n => n.position.y + 300)); // approximate height

          fitView({
            duration: 500,
            padding: 0.2,
            nodes: nodesToFocus,
          });
        }
      }, 100);
    }

    prevImagesLengthRef.current = currentLength;
  }, [images, nodesInitialized, autoFocusEnabled, getNode, fitView]);

  // Sync React Flow position changes back to Redux
  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes);

    changes.forEach((change) => {
      if (change.type === 'position' && change.position && change.dragging === false) {
        dispatch(updateImage({
          id: change.id,
          changes: {
            position: change.position,
          },
        }));
      }
    });
  }, [onNodesChange, dispatch]);

  // Sync selection changes to Redux
  const handleSelectionChange = useCallback(({ nodes }) => {
    const selectedNodeIds = nodes.map(node => node.id);
    dispatch(setSelectedImages(selectedNodeIds));
  }, [dispatch]);

  // Sync viewport changes to Redux
  const handleMoveEnd = useCallback((event, viewportInfo) => {
    dispatch(setViewport({
      x: viewportInfo.x,
      y: viewportInfo.y,
      zoom: viewportInfo.zoom,
    }));
  }, [dispatch]);

  // Handle drag over to allow drop
  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  // Handle drop of external images
  const handleDrop = useCallback(async (event) => {
    event.preventDefault();

    const files = Array.from(event.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) return;

    const flowPosition = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    // Upload each file to server
    for (let index = 0; index < imageFiles.length; index++) {
      const file = imageFiles[index];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('http://localhost:8080/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          dispatch(addImage({
            url: data.url,
            path: data.path,
            label: data.filename,
            position: {
              x: flowPosition.x + (index * 50),
              y: flowPosition.y + (index * 50),
            },
          }));
        } else {
          console.error('Upload failed:', await response.text());
        }
      } catch (error) {
        console.error('Upload error:', error);
      }
    }
  }, [screenToFlowPosition, dispatch]);

  return (
    <div
      style={{ flex: 1, height: '100vh', position: 'relative' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '24px',
        padding: '16px 24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        border: '1px solid rgba(0, 0, 0, 0.06)',
        minWidth: '400px',
      }}>
        <span style={{
          fontSize: '13px',
          color: '#6b7280',
          fontWeight: '500',
          marginRight: '4px',
          letterSpacing: '-0.01em',
        }}>
          {selectedIds.length} selected
        </span>
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          style={{
            background: isDirty ? 'linear-gradient(135deg, #10a37f 0%, #0d8f6f 100%)' : 'transparent',
            color: isDirty ? 'white' : '#9ca3af',
            border: 'none',
            borderRadius: '16px',
            padding: '10px 20px',
            cursor: isDirty ? 'pointer' : 'not-allowed',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: isDirty ? 1 : 0.5,
            transition: 'all 0.2s ease',
            letterSpacing: '-0.01em',
          }}
          onMouseEnter={(e) => {
            if (isDirty) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 163, 127, 0.25)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M18.1716 1C18.702 1 19.2107 1.21071 19.5858 1.58579L22.4142 4.41421C22.7893 4.78929 23 5.29799 23 5.82843V20C23 21.6569 21.6569 23 20 23H4C2.34315 23 1 21.6569 1 20V4C1 2.34315 2.34315 1 4 1H18.1716ZM4 3C3.44772 3 3 3.44772 3 4V20C3 20.5523 3.44772 21 4 21L5 21L5 15C5 13.3431 6.34315 12 8 12L16 12C17.6569 12 19 13.3431 19 15V21H20C20.5523 21 21 20.5523 21 20V6.82843C21 6.29799 20.7893 5.78929 20.4142 5.41421L18.5858 3.58579C18.2107 3.21071 17.702 3 17.1716 3H17V7C17 8.65685 15.6569 10 14 10H10C8.34315 10 7 8.65685 7 7V3H4ZM17 21V15C17 14.4477 16.5523 14 16 14L8 14C7.44772 14 7 14.4477 7 15L7 21L17 21ZM9 3H15V7C15 7.55228 14.5523 8 14 8H10C9.44772 8 9 7.55228 9 7V3Z"></path>
          </svg>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => {
            selectedIds.forEach(id => handleDelete(id));
          }}
          disabled={selectedIds.length === 0}
          style={{
            background: 'transparent',
            color: selectedIds.length > 0 ? '#ef4444' : '#d1d5db',
            border: 'none',
            borderRadius: '16px',
            padding: '10px 20px',
            cursor: selectedIds.length > 0 ? 'pointer' : 'not-allowed',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: selectedIds.length > 0 ? 1 : 0.5,
            transition: 'all 0.2s ease',
            letterSpacing: '-0.01em',
          }}
          onMouseEnter={(e) => {
            if (selectedIds.length > 0) {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M10.5555 4C10.099 4 9.70052 4.30906 9.58693 4.75114L9.29382 5.8919H14.715L14.4219 4.75114C14.3083 4.30906 13.9098 4 13.4533 4H10.5555ZM16.7799 5.8919L16.3589 4.25342C16.0182 2.92719 14.8226 2 13.4533 2H10.5555C9.18616 2 7.99062 2.92719 7.64985 4.25342L7.22886 5.8919H4C3.44772 5.8919 3 6.33961 3 6.8919C3 7.44418 3.44772 7.8919 4 7.8919H4.10069L5.31544 19.3172C5.47763 20.8427 6.76455 22 8.29863 22H15.7014C17.2354 22 18.5224 20.8427 18.6846 19.3172L19.8993 7.8919H20C20.5523 7.8919 21 7.44418 21 6.8919C21 6.33961 20.5523 5.8919 20 5.8919H16.7799ZM17.888 7.8919H6.11196L7.30423 19.1057C7.3583 19.6142 7.78727 20 8.29863 20H15.7014C16.2127 20 16.6417 19.6142 16.6958 19.1057L17.888 7.8919ZM10 10C10.5523 10 11 10.4477 11 11V16C11 16.5523 10.5523 17 10 17C9.44772 17 9 16.5523 9 16V11C9 10.4477 9.44772 10 10 10ZM14 10C14.5523 10 15 10.4477 15 11V16C15 16.5523 14.5523 17 14 17C13.4477 17 13 16.5523 13 16V11C13 10.4477 13.4477 10 14 10Z"></path>
          </svg>
          Delete
        </button>
      </div>
      <ReactFlow
        nodes={reactFlowNodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={handleSelectionChange}
        onMoveEnd={handleMoveEnd}
        defaultViewport={viewport}
        nodeTypes={nodeTypes}
        fitView
        selectionOnDrag={true}
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Meta"
        panOnScroll={true}
        zoomOnScroll={false}
      >
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}

function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

export default Canvas;
