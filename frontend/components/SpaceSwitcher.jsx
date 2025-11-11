import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import {
  selectCurrentSpaceId,
  selectIsDirty,
  loadSpace,
} from '../store/imagesSlice';
import { useListSpacesQuery, useDeleteSpaceMutation } from '../store/spacesApi';

function SpaceSwitcher() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { spaceId: urlSpaceId } = useParams();
  const currentSpaceId = useAppSelector(selectCurrentSpaceId);
  const isDirty = useAppSelector(selectIsDirty);
  const [isOpen, setIsOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [loadError, setLoadError] = useState(null);
  const dropdownRef = useRef(null);

  // Use URL as display source of truth
  const displaySpaceId = urlSpaceId || currentSpaceId;

  // Use RTK Query to load spaces list
  const { data: spaces = [], refetch: refreshSpaces } = useListSpacesQuery();
  const [deleteSpace] = useDeleteSpaceMutation();

  const handleSwitchSpace = async (spaceId, isNew = false) => {
    // Warn if there are unsaved changes
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to switch spaces? Unsaved changes will be lost.'
      );
      if (!confirmed) {
        return;
      }
    }

    // Clear previous error
    setLoadError(null);

    // For new spaces, just navigate directly (space will be created on first save)
    if (isNew) {
      navigate(`/space/${spaceId}`);
      setIsOpen(false);
      console.log(`Navigated to new space: ${spaceId}`);
      return;
    }

    try {
      // Try to load the space first
      await dispatch(loadSpace(spaceId)).unwrap();

      // Only navigate if load succeeds
      navigate(`/space/${spaceId}`);
      setIsOpen(false);
      console.log(`Successfully loaded and navigated to space: ${spaceId}`);
    } catch (error) {
      console.error('Failed to load space:', error);
      setLoadError(`Failed to load space "${spaceId}". It may not exist yet.`);
      // Don't navigate - stay on current space
    }
  };

  const handleCreateSpace = () => {
    if (!newSpaceName.trim()) return;

    const spaceId = newSpaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    handleSwitchSpace(spaceId, true); // Pass true to indicate it's a new space
    setNewSpaceName('');
    refreshSpaces();
  };

  const handleDeleteSpace = async (e, spaceId) => {
    e.stopPropagation(); // Prevent switching to space when clicking delete

    // Prevent deleting default space
    if (spaceId === 'default') {
      alert('Cannot delete the default space.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete the space "${spaceId}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deleteSpace(spaceId).unwrap();

      // If we're currently in the deleted space, navigate to default
      if (displaySpaceId === spaceId) {
        navigate('/space/default');
      }

      refreshSpaces();
    } catch (error) {
      console.error('Failed to delete space:', error);
      alert('Failed to delete space. Please try again.');
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setLoadError(null); // Clear error when closing
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      // Clear error when dropdown is closed
      setLoadError(null);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} style={{
      position: 'absolute',
      top: '10px',
      left: '10px',
      zIndex: 1000,
    }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '8px 16px',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          position: 'relative',
          color: '#fff',
          textTransform: 'none',
        }}
      >
        {displaySpaceId}
        {isDirty && (
          <span style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#ff9800',
            border: '2px solid rgba(255, 255, 255, 0.5)',
          }} title="Unsaved changes" />
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '45px',
          left: 0,
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '4px',
          boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
          minWidth: '250px',
          maxHeight: '400px',
          overflowY: 'auto',
        }}>
          {loadError && (
            <div style={{
              padding: '12px',
              background: '#fee',
              color: '#c00',
              fontSize: '13px',
              borderBottom: '1px solid #fcc',
            }}>
              {loadError}
            </div>
          )}
          <div style={{
            padding: '12px',
            borderBottom: '1px solid #eee',
            display: 'flex',
            gap: '8px',
          }}>
            <input
              type="text"
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateSpace()}
              placeholder="New space name..."
              style={{
                flex: 1,
                padding: '6px 8px',
                border: '1px solid #ddd',
                borderRadius: '3px',
                fontSize: '13px',
              }}
            />
            <button
              onClick={handleCreateSpace}
              style={{
                padding: '6px 16px',
                background: '#1a73e8',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
              }}
            >
              Create
            </button>
          </div>

          <div style={{ padding: '4px 0' }}>
            {spaces.length === 0 ? (
              <div style={{
                padding: '12px',
                color: '#666',
                fontSize: '13px',
                textAlign: 'center',
              }}>
                No saved spaces
              </div>
            ) : (
              spaces.map((space) => (
                <div
                  key={space.id}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <button
                    onClick={() => handleSwitchSpace(space.id)}
                    style={{
                      flex: 1,
                      padding: '10px 40px 10px 12px',
                      background: space.id === displaySpaceId ? '#f0f7ff' : 'transparent',
                      border: 'none',
                      borderLeft: space.id === displaySpaceId ? '3px solid #1a73e8' : '3px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '13px',
                      textTransform: 'none',
                    }}
                  >
                    <div style={{ fontWeight: space.id === displaySpaceId ? '600' : '400', textTransform: 'none' }}>
                      {space.id}
                    </div>
                    {space.node_count > 0 && (
                      <div style={{
                        fontSize: '11px',
                        color: '#666',
                        marginTop: '2px',
                      }}>
                        {space.node_count} {space.node_count === 1 ? 'image' : 'images'}
                      </div>
                    )}
                  </button>
                  {space.id !== 'default' && (
                    <button
                      onClick={(e) => handleDeleteSpace(e, space.id)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        width: '28px',
                        height: '28px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#999',
                        fontSize: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fee';
                        e.currentTarget.style.color = '#c00';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#999';
                      }}
                      title="Delete space"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div style={{
            padding: '8px',
            borderTop: '1px solid #eee',
            textAlign: 'center',
          }}>
            <button
              onClick={() => {
                setIsOpen(false);
                refreshSpaces();
              }}
              style={{
                padding: '4px 8px',
                background: 'transparent',
                border: 'none',
                color: '#666',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SpaceSwitcher;
