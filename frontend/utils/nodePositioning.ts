import { ImageNode } from '../store/imagesSlice';

const COLUMN_WIDTH = 400; // Horizontal spacing between columns
const ROW_HEIGHT = 500; // Vertical spacing between rows
const COLUMNS = 3; // Number of columns in grid

/**
 * Calculate grid position for new node to prevent overlap
 */
export function calculateNodePosition(
  existingNodes: ImageNode[]
): { x: number; y: number } {
  // If no existing nodes, start at origin
  if (existingNodes.length === 0) {
    return { x: 0, y: 0 };
  }

  // Calculate next position in grid layout
  const index = existingNodes.length;
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);

  return {
    x: column * COLUMN_WIDTH,
    y: row * ROW_HEIGHT,
  };
}

/**
 * Calculate grid layout positions for all nodes
 */
export function layoutNodes(nodes: ImageNode[]): ImageNode[] {
  return nodes.map((node, index) => {
    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);

    return {
      ...node,
      position: {
        x: column * COLUMN_WIDTH,
        y: row * ROW_HEIGHT,
      },
    };
  });
}
