/// <reference path="../../types/global.d.ts" />

/**
 * AppLogger - Production-friendly logging utility for Google Apps Script
 * 
 * Named AppLogger (not Logger) to avoid conflict with GAS built-in Logger.
 * 
 * FOUNDATIONAL FILE: This is a low-level foundational module.
 * It MUST NOT create circular dependencies.
 * 
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 * 
 * Type declarations for AppLogger are in src/types/global.d.ts for global visibility.
 * This file is kept for documentation purposes.
 */

// Node.js module export for testing
export = AppLogger;
