import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import {
  selectCurrentSpaceId,
  selectIsDirty,
  setLastSavedSnapshot,
  imagesSelectors,
  selectViewport,
} from '../store/imagesSlice';

function SaveButton() {
  const dispatch = useAppDispatch();
  const spaceId = useAppSelector(selectCurrentSpaceId);
  const isDirty = useAppSelector(selectIsDirty);
  const images = useAppSelector(imagesSelectors.selectAll);
  const viewport = useAppSelector(selectViewport);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const handleSave = async () => {
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
          space_id: spaceId,
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
      setLastSaved(new Date());
      console.log(`Canvas saved to space: ${spaceId}`);
    } catch (error) {
      console.error('Error saving canvas:', error);
      alert('Failed to save canvas');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '4px',
    }}>
      <button
        onClick={handleSave}
        disabled={!isDirty || saving}
        style={{
          padding: '8px 16px',
          background: isDirty ? '#1a73e8' : '#ddd',
          color: isDirty ? 'white' : '#999',
          border: 'none',
          borderRadius: '4px',
          cursor: isDirty ? 'pointer' : 'not-allowed',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: isDirty ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
        }}
      >
        {saving ? 'Saving...' : isDirty ? 'Save' : 'Saved'}
      </button>
      {lastSaved && (
        <div style={{
          fontSize: '11px',
          color: '#666',
        }}>
          {lastSaved.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

export default SaveButton;
