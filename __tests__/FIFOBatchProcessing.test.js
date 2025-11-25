// @ts-check
const { MembershipManagement } = require('../src/services/MembershipManagement/Manager.js');

/**
 * Test suite for FIFO batch processing pure functions
 * These functions handle the complex logic of selecting batches,
 * rebuilding queues after processing, and assigning timestamps for next batch
 */

describe('FIFO Batch Processing - Pure Functions', () => {
  
  // ==================== Test Data Factories ====================
  
  const createFIFOItem = (overrides = {}) => ({
    id: `item-${Math.random().toString(16).slice(2, 8)}`,
    email: 'test@example.com',
    subject: 'Test Subject',
    htmlBody: '<p>Test Body</p>',
    groups: 'group1@example.com,group2@example.com',
    attempts: 0,
    lastAttemptAt: '',
    lastError: '',
    nextAttemptAt: '',
    maxAttempts: undefined,
    dead: false,
    ...overrides
  });

  // ==================== selectBatchForProcessing Tests ====================
  
  describe('selectBatchForProcessing', () => {
    const now = new Date('2025-11-25T12:00:00Z');

    test('returns empty arrays for empty queue', () => {
      const result = MembershipManagement.Manager.selectBatchForProcessing([], 10, now);
      expect(result.eligibleItems).toEqual([]);
      expect(result.eligibleIndices).toEqual([]);
    });

    test('selects all items when queue size < batchSize', () => {
      const queue = [
        createFIFOItem({ id: 'item-1' }),
        createFIFOItem({ id: 'item-2' }),
        createFIFOItem({ id: 'item-3' })
      ];
      
      const result = MembershipManagement.Manager.selectBatchForProcessing(queue, 10, now);
      
      expect(result.eligibleItems).toHaveLength(3);
      expect(result.eligibleIndices).toEqual([0, 1, 2]);
      expect(result.eligibleItems.map(i => i.id)).toEqual(['item-1', 'item-2', 'item-3']);
    });

    test('limits selection to batchSize when more items are eligible', () => {
      const queue = [
        createFIFOItem({ id: 'item-1' }),
        createFIFOItem({ id: 'item-2' }),
        createFIFOItem({ id: 'item-3' }),
        createFIFOItem({ id: 'item-4' }),
        createFIFOItem({ id: 'item-5' })
      ];
      
      const result = MembershipManagement.Manager.selectBatchForProcessing(queue, 2, now);
      
      expect(result.eligibleItems).toHaveLength(2);
      expect(result.eligibleIndices).toEqual([0, 1]);
      expect(result.eligibleItems.map(i => i.id)).toEqual(['item-1', 'item-2']);
    });

    test('skips items with future nextAttemptAt', () => {
      const futureTime = new Date('2025-11-25T13:00:00Z').toISOString();
      const queue = [
        createFIFOItem({ id: 'item-1', nextAttemptAt: '' }), // eligible - empty
        createFIFOItem({ id: 'item-2', nextAttemptAt: futureTime }), // not eligible - future
        createFIFOItem({ id: 'item-3', nextAttemptAt: '' }), // eligible - empty
        createFIFOItem({ id: 'item-4', nextAttemptAt: new Date('2025-11-25T11:00:00Z').toISOString() }) // eligible - past
      ];
      
      const result = MembershipManagement.Manager.selectBatchForProcessing(queue, 10, now);
      
      expect(result.eligibleItems).toHaveLength(3);
      expect(result.eligibleIndices).toEqual([0, 2, 3]);
      expect(result.eligibleItems.map(i => i.id)).toEqual(['item-1', 'item-3', 'item-4']);
    });

    test('skips dead items', () => {
      const queue = [
        createFIFOItem({ id: 'item-1', dead: false }),
        createFIFOItem({ id: 'item-2', dead: true }),
        createFIFOItem({ id: 'item-3', dead: false }),
        createFIFOItem({ id: 'item-4', dead: true })
      ];
      
      const result = MembershipManagement.Manager.selectBatchForProcessing(queue, 10, now);
      
      expect(result.eligibleItems).toHaveLength(2);
      expect(result.eligibleIndices).toEqual([0, 2]);
      expect(result.eligibleItems.map(i => i.id)).toEqual(['item-1', 'item-3']);
    });

    test('handles mix of eligible and ineligible items correctly', () => {
      const futureTime = new Date('2025-11-25T13:00:00Z').toISOString();
      const queue = [
        createFIFOItem({ id: 'item-1', nextAttemptAt: '' }), // eligible
        createFIFOItem({ id: 'item-2', dead: true }), // skip - dead
        createFIFOItem({ id: 'item-3', nextAttemptAt: futureTime }), // skip - future
        createFIFOItem({ id: 'item-4', nextAttemptAt: '' }), // eligible
        createFIFOItem({ id: 'item-5', nextAttemptAt: '' }), // eligible but beyond batchSize
        createFIFOItem({ id: 'item-6', nextAttemptAt: '' }) // eligible but beyond batchSize
      ];
      
      const result = MembershipManagement.Manager.selectBatchForProcessing(queue, 2, now);
      
      expect(result.eligibleItems).toHaveLength(2);
      expect(result.eligibleIndices).toEqual([0, 3]);
      expect(result.eligibleItems.map(i => i.id)).toEqual(['item-1', 'item-4']);
    });

    test('treats invalid date strings as eligible', () => {
      const queue = [
        createFIFOItem({ id: 'item-1', nextAttemptAt: 'invalid-date' }),
        createFIFOItem({ id: 'item-2', nextAttemptAt: '' }),
        createFIFOItem({ id: 'item-3', nextAttemptAt: 'not-a-date' })
      ];
      
      const result = MembershipManagement.Manager.selectBatchForProcessing(queue, 10, now);
      
      expect(result.eligibleItems).toHaveLength(3);
      expect(result.eligibleItems.map(i => i.id)).toEqual(['item-1', 'item-2', 'item-3']);
    });

    test('handles null/undefined items gracefully', () => {
      const queue = [
        createFIFOItem({ id: 'item-1' }),
        null,
        createFIFOItem({ id: 'item-3' }),
        undefined,
        createFIFOItem({ id: 'item-5' })
      ];
      
      const result = MembershipManagement.Manager.selectBatchForProcessing(queue, 10, now);
      
      expect(result.eligibleItems).toHaveLength(3);
      expect(result.eligibleItems.map(i => i.id)).toEqual(['item-1', 'item-3', 'item-5']);
    });
  });

  // ==================== rebuildQueue Tests ====================
  
  describe('rebuildQueue', () => {
    
    test('returns empty array when all items succeeded', () => {
      const originalQueue = [
        createFIFOItem({ id: 'item-1' }),
        createFIFOItem({ id: 'item-2' }),
        createFIFOItem({ id: 'item-3' })
      ];
      const processedIndices = [0, 1, 2];
      const reattemptItems = [];
      const deadItems = [];
      
      const result = MembershipManagement.Manager.rebuildQueue(
        originalQueue,
        processedIndices,
        reattemptItems,
        deadItems
      );
      
      expect(result).toEqual([]);
    });

    test('preserves reattempt items with Manager-assigned nextAttemptAt', () => {
      const originalQueue = [
        createFIFOItem({ id: 'item-1', nextAttemptAt: '' }),
        createFIFOItem({ id: 'item-2', nextAttemptAt: '' })
      ];
      const processedIndices = [0, 1];
      const reattemptItems = [
        createFIFOItem({ 
          id: 'item-1', 
          attempts: 1, 
          nextAttemptAt: '2025-11-25T12:05:00Z',
          lastError: 'Network error'
        })
      ];
      const deadItems = [];
      
      const result = MembershipManagement.Manager.rebuildQueue(
        originalQueue,
        processedIndices,
        reattemptItems,
        deadItems
      );
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item-1');
      expect(result[0].attempts).toBe(1);
      expect(result[0].nextAttemptAt).toBe('2025-11-25T12:05:00Z');
      expect(result[0].lastError).toBe('Network error');
    });

    test('removes dead items from queue', () => {
      const originalQueue = [
        createFIFOItem({ id: 'item-1' }),
        createFIFOItem({ id: 'item-2' }),
        createFIFOItem({ id: 'item-3' })
      ];
      const processedIndices = [0, 1, 2];
      const reattemptItems = [];
      const deadItems = [
        createFIFOItem({ id: 'item-2', dead: true, attempts: 5 })
      ];
      
      const result = MembershipManagement.Manager.rebuildQueue(
        originalQueue,
        processedIndices,
        reattemptItems,
        deadItems
      );
      
      expect(result).toEqual([]);
    });

    test('preserves unprocessed items unchanged', () => {
      const originalQueue = [
        createFIFOItem({ id: 'item-1', nextAttemptAt: '' }),
        createFIFOItem({ id: 'item-2', nextAttemptAt: '2025-11-25T13:00:00Z' }),
        createFIFOItem({ id: 'item-3', nextAttemptAt: '' }),
        createFIFOItem({ id: 'item-4', dead: true })
      ];
      const processedIndices = [0, 2]; // Only processed items 1 and 3
      const reattemptItems = [
        createFIFOItem({ id: 'item-1', attempts: 1, nextAttemptAt: '2025-11-25T12:05:00Z' })
      ];
      const deadItems = [];
      
      const result = MembershipManagement.Manager.rebuildQueue(
        originalQueue,
        processedIndices,
        reattemptItems,
        deadItems
      );
      
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('item-1'); // retry item
      expect(result[0].attempts).toBe(1);
      expect(result[1].id).toBe('item-2'); // unprocessed item preserved
      expect(result[1].nextAttemptAt).toBe('2025-11-25T13:00:00Z');
      expect(result[2].id).toBe('item-4'); // unprocessed dead item preserved
      expect(result[2].dead).toBe(true);
    });

    test('handles complex scenario: mix of success, retry, dead, and unprocessed', () => {
      const originalQueue = [
        createFIFOItem({ id: 'item-1', nextAttemptAt: '' }), // will succeed
        createFIFOItem({ id: 'item-2', nextAttemptAt: '' }), // will retry
        createFIFOItem({ id: 'item-3', nextAttemptAt: '' }), // will die
        createFIFOItem({ id: 'item-4', nextAttemptAt: '2025-11-25T13:00:00Z' }), // not processed
        createFIFOItem({ id: 'item-5', nextAttemptAt: '' }), // will succeed
        createFIFOItem({ id: 'item-6', dead: true }) // not processed (already dead)
      ];
      const processedIndices = [0, 1, 2, 4]; // Items 1, 2, 3, 5 were selected for processing
      const reattemptItems = [
        createFIFOItem({ id: 'item-2', attempts: 1, nextAttemptAt: '2025-11-25T12:10:00Z' })
      ];
      const deadItems = [
        createFIFOItem({ id: 'item-3', dead: true, attempts: 5 })
      ];
      
      const result = MembershipManagement.Manager.rebuildQueue(
        originalQueue,
        processedIndices,
        reattemptItems,
        deadItems
      );
      
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('item-2'); // retry
      expect(result[0].attempts).toBe(1);
      expect(result[1].id).toBe('item-4'); // unprocessed with future nextAttemptAt
      expect(result[1].nextAttemptAt).toBe('2025-11-25T13:00:00Z');
      expect(result[2].id).toBe('item-6'); // unprocessed dead item
      expect(result[2].dead).toBe(true);
    });
  });

  // ==================== assignNextBatchTimestamps Tests ====================
  
  describe('assignNextBatchTimestamps', () => {
    const now = new Date('2025-11-25T12:00:00Z');
    const nextTriggerTime = '2025-11-25T12:01:00Z';

    test('returns empty array for empty queue', () => {
      const result = MembershipManagement.Manager.assignNextBatchTimestamps([], 10, now, nextTriggerTime);
      expect(result).toEqual([]);
    });

    test('assigns timestamp to all items when queue size < batchSize', () => {
      const queue = [
        createFIFOItem({ id: 'item-1', nextAttemptAt: '' }),
        createFIFOItem({ id: 'item-2', nextAttemptAt: '' }),
        createFIFOItem({ id: 'item-3', nextAttemptAt: '' })
      ];
      
      const result = MembershipManagement.Manager.assignNextBatchTimestamps(queue, 10, now, nextTriggerTime);
      
      expect(result).toHaveLength(3);
      expect(result[0].nextAttemptAt).toBe(nextTriggerTime);
      expect(result[1].nextAttemptAt).toBe(nextTriggerTime);
      expect(result[2].nextAttemptAt).toBe(nextTriggerTime);
    });

    test('assigns timestamp only to first batchSize eligible items', () => {
      const queue = [
        createFIFOItem({ id: 'item-1', nextAttemptAt: '' }),
        createFIFOItem({ id: 'item-2', nextAttemptAt: '' }),
        createFIFOItem({ id: 'item-3', nextAttemptAt: '' }),
        createFIFOItem({ id: 'item-4', nextAttemptAt: '' }),
        createFIFOItem({ id: 'item-5', nextAttemptAt: '' })
      ];
      
      const result = MembershipManagement.Manager.assignNextBatchTimestamps(queue, 2, now, nextTriggerTime);
      
      expect(result).toHaveLength(5);
      expect(result[0].nextAttemptAt).toBe(nextTriggerTime); // item 1 - assigned
      expect(result[1].nextAttemptAt).toBe(nextTriggerTime); // item 2 - assigned
      expect(result[2].nextAttemptAt).toBe(''); // item 3 - unchanged
      expect(result[3].nextAttemptAt).toBe(''); // item 4 - unchanged
      expect(result[4].nextAttemptAt).toBe(''); // item 5 - unchanged
    });

    test('skips items with future nextAttemptAt when counting eligible items', () => {
      const futureTime = '2025-11-25T13:00:00Z';
      const queue = [
        createFIFOItem({ id: 'item-1', nextAttemptAt: '' }), // eligible
        createFIFOItem({ id: 'item-2', nextAttemptAt: futureTime }), // not eligible
        createFIFOItem({ id: 'item-3', nextAttemptAt: '' }), // eligible
        createFIFOItem({ id: 'item-4', nextAttemptAt: '' }), // eligible but beyond batchSize
      ];
      
      const result = MembershipManagement.Manager.assignNextBatchTimestamps(queue, 2, now, nextTriggerTime);
      
      expect(result).toHaveLength(4);
      expect(result[0].nextAttemptAt).toBe(nextTriggerTime); // item 1 - assigned
      expect(result[1].nextAttemptAt).toBe(futureTime); // item 2 - unchanged (already has future time)
      expect(result[2].nextAttemptAt).toBe(nextTriggerTime); // item 3 - assigned
      expect(result[3].nextAttemptAt).toBe(''); // item 4 - unchanged (beyond batchSize)
    });

    test('handles realistic post-processing scenario', () => {
      // After processing: 1 retry with future time, 3 new eligible items
      // NOTE: Dead items are NOT in queue - rebuildQueue removes them
      const queue = [
        createFIFOItem({ id: 'retry-1', attempts: 1, nextAttemptAt: '2025-11-25T12:05:00Z' }), // retry - has future time
        createFIFOItem({ id: 'item-2', nextAttemptAt: '' }), // eligible
        createFIFOItem({ id: 'item-3', nextAttemptAt: '' }), // eligible
        createFIFOItem({ id: 'item-4', nextAttemptAt: '' }) // eligible but beyond batchSize=2
      ];
      
      const result = MembershipManagement.Manager.assignNextBatchTimestamps(queue, 2, now, nextTriggerTime);
      
      expect(result).toHaveLength(4);
      expect(result[0].id).toBe('retry-1');
      expect(result[0].nextAttemptAt).toBe('2025-11-25T12:05:00Z'); // unchanged - already has future time
      expect(result[1].id).toBe('item-2');
      expect(result[1].nextAttemptAt).toBe(nextTriggerTime); // first eligible - assigned
      expect(result[2].id).toBe('item-3');
      expect(result[2].nextAttemptAt).toBe(nextTriggerTime); // second eligible - assigned
      expect(result[3].id).toBe('item-4');
      expect(result[3].nextAttemptAt).toBe(''); // third eligible - beyond batchSize
    });

    test('does not mutate original queue items', () => {
      const queue = [
        createFIFOItem({ id: 'item-1', nextAttemptAt: '' }),
        createFIFOItem({ id: 'item-2', nextAttemptAt: '' })
      ];
      const originalNextAttempt1 = queue[0].nextAttemptAt;
      const originalNextAttempt2 = queue[1].nextAttemptAt;
      
      const result = MembershipManagement.Manager.assignNextBatchTimestamps(queue, 1, now, nextTriggerTime);
      
      // Original queue should be unchanged
      expect(queue[0].nextAttemptAt).toBe(originalNextAttempt1);
      expect(queue[1].nextAttemptAt).toBe(originalNextAttempt2);
      
      // Result should have updated values
      expect(result[0].nextAttemptAt).toBe(nextTriggerTime);
      expect(result[1].nextAttemptAt).toBe('');
    });
  });

  // ==================== Integration Test: Full Flow ====================
  
  describe('Integration: Full batch processing flow', () => {
    test('complete flow from selection through rebuild and next batch assignment', () => {
      const now = new Date('2025-11-25T12:00:00Z');
      const nextTriggerTime = '2025-11-25T12:01:00Z';
      const batchSize = 2;
      
      // Initial queue: 5 items, all eligible
      const initialQueue = [
        createFIFOItem({ id: 'item-1', nextAttemptAt: '' }),
        createFIFOItem({ id: 'item-2', nextAttemptAt: '' }),
        createFIFOItem({ id: 'item-3', nextAttemptAt: '' }),
        createFIFOItem({ id: 'item-4', nextAttemptAt: '' }),
        createFIFOItem({ id: 'item-5', nextAttemptAt: '' })
      ];
      
      // Step 1: Select batch
      const { eligibleItems, eligibleIndices } = MembershipManagement.Manager.selectBatchForProcessing(
        initialQueue,
        batchSize,
        now
      );
      expect(eligibleItems).toHaveLength(2);
      expect(eligibleItems.map(i => i.id)).toEqual(['item-1', 'item-2']);
      
      // Step 2: Simulate processing - item-1 succeeds, item-2 fails and needs retry
      const reattemptItems = [
        createFIFOItem({ 
          id: 'item-2', 
          attempts: 1, 
          nextAttemptAt: '2025-11-25T12:05:00Z',
          lastError: 'Network timeout'
        })
      ];
      const deadItems = [];
      
      // Step 3: Rebuild queue
      const rebuiltQueue = MembershipManagement.Manager.rebuildQueue(
        initialQueue,
        eligibleIndices,
        reattemptItems,
        deadItems
      );
      expect(rebuiltQueue).toHaveLength(4);
      expect(rebuiltQueue.map(i => i.id)).toEqual(['item-2', 'item-3', 'item-4', 'item-5']);
      expect(rebuiltQueue[0].attempts).toBe(1); // retry item
      
      // Step 4: Assign next batch timestamps
      const finalQueue = MembershipManagement.Manager.assignNextBatchTimestamps(
        rebuiltQueue,
        batchSize,
        now,
        nextTriggerTime
      );
      
      // Verify final state:
      expect(finalQueue).toHaveLength(4);
      // item-2 has future retry time (from Manager) - not eligible for next batch
      expect(finalQueue[0].id).toBe('item-2');
      expect(finalQueue[0].nextAttemptAt).toBe('2025-11-25T12:05:00Z'); // unchanged
      // item-3 and item-4 are next batch (first 2 eligible)
      expect(finalQueue[1].id).toBe('item-3');
      expect(finalQueue[1].nextAttemptAt).toBe(nextTriggerTime); // assigned
      expect(finalQueue[2].id).toBe('item-4');
      expect(finalQueue[2].nextAttemptAt).toBe(nextTriggerTime); // assigned
      // item-5 is beyond next batch
      expect(finalQueue[3].id).toBe('item-5');
      expect(finalQueue[3].nextAttemptAt).toBe(''); // unchanged
    });
  });
});
