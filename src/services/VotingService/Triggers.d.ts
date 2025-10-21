/// <reference path="../../types/global.d.ts" />

/**
 * Trigger service types - references global Vote interface
 */
export interface TriggerService {
    // Use global Vote type instead of redefining
    voteIsValid_(vote: Vote, votes: Vote[], consumeMUT: (token: string) => string | null): boolean;
    
    // ...existing code...
}