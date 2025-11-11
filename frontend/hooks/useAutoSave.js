import { useEffect, useRef } from 'react';
import { useAppSelector } from '../store/hooks';
import { useReactFlow } from 'reactflow';
import {
  selectCurrentSpaceId,
} from '../store/imagesSlice';

const AUTOSAVE_DELAY_MS = 2000; // 2 seconds after last change

export function useAutoSave() {
  const { getNodes, getViewport } = useReactFlow();
  const spaceId = useAppSelector(selectCurrentSpaceId);
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    const nodes = getNodes();
    // Only auto-save if there are nodes
    if (nodes.length === 0) return;

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout to save after delay
    saveTimeoutRef.current = setTimeout(() => {
      const currentNodes = getNodes();
      const currentViewport = getViewport();
      console.log('Auto-saving canvas...', { nodeCount: currentNodes.length });
      saveCanvasStateFromReactFlow(spaceId, currentNodes, currentViewport);
    }, AUTOSAVE_DELAY_MS);

    // Cleanup
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [getNodes().length, spaceId]); // Track node count changes
}

async function saveCanvasStateFromReactFlow(spaceId, reactFlowNodes, viewport) {
  try {
    const state = {
      nodes: images.map(img => ({
        id: img.id,
        url: img.url,
        label: img.label,
        position: img.position,
        path: img.path,
        createdAt: img.createdAt,
        messageId: img.messageId,
      })),
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
        space_id: spaceId,
        state,
      }),
    });

    if (!response.ok) {
      console.error('Failed to save canvas:', await response.text());
      throw new Error('Save failed');
    } else {
      console.log(`Canvas saved to space: ${spaceId}`);
      return true;
    }
  } catch (error) {
    console.error('Error saving canvas:', error);
  }
}

export async function loadCanvasState(spaceId) {
  try {
    const response = await fetch(`http://localhost:8080/api/spaces/load/${spaceId}`);

    if (response.status === 404) {
      return null; // Space doesn't exist yet
    }

    if (!response.ok) {
      throw new Error(`Failed to load canvas: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error loading canvas:', error);
    throw error;
  }
}

export async function listSpaces() {
  try {
    const response = await fetch('http://localhost:8080/api/spaces');

    if (!response.ok) {
      throw new Error(`Failed to list spaces: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error listing spaces:', error);
    throw error;
  }
}
