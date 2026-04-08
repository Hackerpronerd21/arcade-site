let nextNodeId = 1;

export type ResourceNodeType = 'primary' | 'advanced';

export class ResourceNode {
  readonly id: string;
  readonly type: ResourceNodeType;
  x: number;
  y: number;
  amount: number;
  readonly maxAmount: number;
  readonly maxWorkers: number;
  assignedWorkerIds: Set<string> = new Set();

  /** Id of the extraction building placed on this node (advanced only) */
  extractionBuildingId: string | null = null;

  // For pulsing animation
  pulseTimer: number = 0;

  constructor(type: ResourceNodeType, x: number, y: number, amount: number) {
    this.id = `res_${nextNodeId++}`;
    this.type = type;
    this.x = x;
    this.y = y;
    this.amount = amount;
    this.maxAmount = amount;
    this.maxWorkers = type === 'primary' ? 1 : 3;
  }

  get isSaturated(): boolean {
    return this.assignedWorkerIds.size >= this.maxWorkers;
  }

  get isDepleted(): boolean {
    return this.amount <= 0;
  }

  /** Returns true if a worker can be assigned to this node */
  canAssignWorker(workerId: string): boolean {
    if (this.assignedWorkerIds.has(workerId)) return false;
    if (this.isDepleted) return false;
    if (this.type === 'advanced' && this.extractionBuildingId === null) return false;
    return !this.isSaturated;
  }

  assignWorker(workerId: string): boolean {
    if (!this.assignedWorkerIds.has(workerId) && !this.isSaturated) {
      this.assignedWorkerIds.add(workerId);
      return true;
    }
    return false;
  }

  removeWorker(workerId: string): void {
    this.assignedWorkerIds.delete(workerId);
  }

  /** Harvest resource; returns how much was gathered */
  harvest(amount: number): number {
    const gathered = Math.min(this.amount, amount);
    this.amount -= gathered;
    return gathered;
  }
}
