import { Entity } from '../types';
import { SPATIAL_GRID_SIZE } from '../constants';

export class SpatialHash {
  private grid: Map<string, string[]>;
  private cellSize: number;

  constructor(cellSize: number = SPATIAL_GRID_SIZE) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  // Clear grid at start of frame
  clear() {
    this.grid.clear();
  }

  // Generate key based on coordinates
  private getKey(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }

  // Insert entity into relevant buckets
  insert(entity: Entity) {
    const startX = Math.floor((entity.position.x - entity.radius) / this.cellSize);
    const startY = Math.floor((entity.position.y - entity.radius) / this.cellSize);
    const endX = Math.floor((entity.position.x + entity.radius) / this.cellSize);
    const endY = Math.floor((entity.position.y + entity.radius) / this.cellSize);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const key = `${x},${y}`;
        if (!this.grid.has(key)) {
          this.grid.set(key, []);
        }
        this.grid.get(key)!.push(entity.id);
      }
    }
  }

  // Retrieve potential collision candidates
  query(entity: Entity): string[] {
    const startX = Math.floor((entity.position.x - entity.radius) / this.cellSize);
    const startY = Math.floor((entity.position.y - entity.radius) / this.cellSize);
    const endX = Math.floor((entity.position.x + entity.radius) / this.cellSize);
    const endY = Math.floor((entity.position.y + entity.radius) / this.cellSize);

    const nearbyIds = new Set<string>();

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const key = `${x},${y}`;
        const bucket = this.grid.get(key);
        if (bucket) {
          for (const id of bucket) {
            if (id !== entity.id) { // Don't check against self
              nearbyIds.add(id);
            }
          }
        }
      }
    }

    return Array.from(nearbyIds);
  }
}