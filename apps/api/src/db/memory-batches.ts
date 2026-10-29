import {
  BatchIdTakenError,
  type AllocationRecord,
  type BatchRecord,
  type BatchStore,
} from "./batches"

/** BatchStore in memory, for tests. */
export class MemoryBatchStore implements BatchStore {
  readonly batches = new Map<bigint, BatchRecord>()
  readonly allocationsByBatch = new Map<bigint, AllocationRecord[]>()

  async create(
    batch: BatchRecord,
    allocations: AllocationRecord[]
  ): Promise<void> {
    if (this.batches.has(batch.batchId)) {
      throw new BatchIdTakenError(batch.batchId)
    }
    this.batches.set(batch.batchId, batch)
    this.allocationsByBatch.set(batch.batchId, allocations)
  }

  async get(batchId: bigint): Promise<BatchRecord | undefined> {
    return this.batches.get(batchId)
  }

  async list(limit: number): Promise<BatchRecord[]> {
    return [...this.batches.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
  }

  async allocations(batchId: bigint): Promise<AllocationRecord[]> {
    return this.allocationsByBatch.get(batchId) ?? []
  }
}
