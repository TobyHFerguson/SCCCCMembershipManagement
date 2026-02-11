/// <reference path="../../types/global.d.ts" />

/**
 * FeatureFlags - Simple feature flag management for Google Apps Script
 * 
 * Named FeatureFlags (not Common.Config.FeatureFlags) per namespace flattening.
 * 
 * CRITICAL: This module is in Layer 0 (Foundation).
 * - MUST NOT use AppLogger.* (creates circular dependency)
 * - MUST use Logger.log() (GAS built-in) only for tracing
 * 
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 * 
 * Type declarations are in src/types/global.d.ts for global visibility.
 * This file is kept for documentation purposes.
 */

// Types are declared globally in src/types/global.d.ts
// No export needed - classes are available globally in GAS runtime

export {};
