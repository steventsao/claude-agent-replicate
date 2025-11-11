import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function ImageNode({ data }) {
  return (
    <div
      style={{
        padding: '10px',
        borderRadius: '8px',
        background: '#1a1a1a',
        border: '2px solid #333',
        minWidth: '200px',
        maxWidth: '400px',
      }}
    >
      <div
        style={{
          marginBottom: '8px',
          fontWeight: '600',
          color: '#e0e0e0',
          fontSize: '14px',
        }}
      >
        {data.label}
      </div>
      {data.imageUrl && (
        <img
          src={data.imageUrl}
          alt={data.label}
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: '6px',
            display: 'block',
          }}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'block';
          }}
        />
      )}
      <div
        style={{
          display: 'none',
          padding: '20px',
          color: '#666',
          textAlign: 'center',
        }}
      >
        Failed to load image
      </div>

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(ImageNode);
