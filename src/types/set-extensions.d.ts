// Inform TypeScript that runtimes (like Apps Script) may provide Set.prototype.intersection
// This augments the global Set<T> interface used throughout the project.
declare global {
  interface Set<T> {
    /**
     * Returns a new Set containing elements present in both this and `other`.
     */
    intersection(other: Set<T>): Set<T>;
  }
}

export {};
