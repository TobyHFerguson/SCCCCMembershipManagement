/// <reference path="../../types/global.d.ts" />

/**
 * Properties - Manages application properties with spreadsheet-backed storage for user-configurable
 * settings and Script Properties for code-internal state tracking.
 * 
 * CRITICAL: This module MUST NOT use Logger (formerly Common.Logger)!
 * Use console.log() only for tracing.
 * 
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 */
declare class Properties {
    /**
     * Get a property value. User-configurable properties are read from Properties sheet.
     * Code-internal properties always come from Script Properties.
     * @param propertyName - Name of property to retrieve
     * @param defaultValue - Default value if property not found
     * @returns Property value or default
     */
    static getProperty(propertyName: string, defaultValue?: string | null): string | null;

    /**
     * Get a numeric property value
     * @param propertyName - Name of property to retrieve
     * @param defaultValue - Default value if property not found or not a number
     * @returns Property value as number or default
     */
    static getNumberProperty(propertyName: string, defaultValue?: number): number;

    /**
     * Get a boolean property value
     * @param propertyName - Name of property to retrieve
     * @param defaultValue - Default value if property not found
     * @returns Property value as boolean or default
     */
    static getBooleanProperty(propertyName: string, defaultValue?: boolean): boolean;

    /**
     * Set a code-internal property (Script Properties only).
     * User-configurable properties should be set in the Properties sheet.
     * @param propertyName - Name of property
     * @param value - Value to set
     * @throws Error if attempting to set a user-configurable property
     */
    static setCodeInternalProperty(propertyName: string, value: string): void;

    /**
     * Delete a code-internal property from Script Properties
     * @param propertyName - Name of property to delete
     * @throws Error if attempting to delete a user-configurable property
     */
    static deleteCodeInternalProperty(propertyName: string): void;

    /**
     * Clear the property cache. Call if Properties sheet is modified during execution.
     */
    static clearCache(): void;

    /**
     * Get all user-configurable properties as an object (for debugging/display)
     * @returns Map of property names to values
     */
    static getAllUserProperties(): { [key: string]: string };
}

// Backward compatibility namespace declaration
declare namespace Common.Config {
    const Properties: typeof globalThis.Properties;
}

// Node.js module export for testing
export = Properties;
