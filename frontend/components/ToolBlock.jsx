import React, { useState } from 'react';
import styles from './ToolBlock.module.css';

/**
 * Component for rendering tool use and tool result blocks
 * Follows Claude API tool runner pattern
 */
export const ToolBlock = ({ block }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (block.type === 'tool_use') {
    return (
      <div className={styles.toolUse}>
        <div
          className={styles.toolHeader}
          onClick={() => setIsExpanded(!isExpanded)}
          role="button"
          tabIndex={0}
        >
          <span className={styles.toolIcon}>🛠️</span>
          <span className={styles.toolName}>{block.name}</span>
          <span className={styles.toolId}>#{block.id.slice(-8)}</span>
          <span className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
        </div>
        {isExpanded && (
          <div className={styles.toolInput}>
            <div className={styles.sectionLabel}>Input:</div>
            <pre className={styles.jsonBlock}>
              {JSON.stringify(block.input, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  if (block.type === 'tool_result') {
    const isError = block.is_error === true;
    return (
      <div className={`${styles.toolResult} ${isError ? styles.toolError : ''}`}>
        <div
          className={styles.toolHeader}
          onClick={() => setIsExpanded(!isExpanded)}
          role="button"
          tabIndex={0}
        >
          <span className={styles.toolIcon}>{isError ? '❌' : '✅'}</span>
          <span className={styles.toolName}>
            {isError ? 'Tool Error' : 'Tool Result'}
          </span>
          <span className={styles.toolId}>#{block.tool_use_id.slice(-8)}</span>
          <span className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
        </div>
        {isExpanded && (
          <div className={styles.toolOutput}>
            <div className={styles.sectionLabel}>Output:</div>
            <pre className={styles.outputBlock}>
              {typeof block.content === 'string'
                ? block.content
                : JSON.stringify(block.content, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default ToolBlock;
