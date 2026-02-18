/**
 * Membership management type definitions
 */

declare namespace MembershipManagement {
    type ActionType = 'Migrate' | 'Join' | 'Renew' | 'Expiry1' | 'Expiry2' | 'Expiry3' | 'Expiry4';

    interface Transaction {
        'Email Address': string;
        'First Name': string;
        'Last Name': string;
        'Payable Status': string;
        Payment: string;
        Timestamp: Date;
        'Member ID'?: string | null;
    }

    interface ActionSchedule {
        Date: Date;
        Email: string;
        Type: ActionType;
    }

    interface ActionSpec {
        Type: ActionType;
        Offset?: number;
        Subject: string;
        Body: string;
    }

    interface ScheduleEntry {
        date: Date;
        email: string;
        action: ActionType;
    }

    interface EmailQueueEntry {
        email: string;
        action: ActionType;
    }

    interface ExpirySchedule {
        Date: Date;
        Type: ActionType;
        Email: string;
    }

    /**
     * Domain type: minimal data needed to process an expiration
     */
    interface ExpiredMember {
        email: string;
        subject: string;
        htmlBody: string;
        groups?: string;  // comma-separated group emails
    }

    /**
     * FIFO type: ExpiredMember + attempt bookkeeping for queue persistence
     */
    interface FIFOItem extends ExpiredMember {
        id: string;  // unique identifier
        attempts: number;
        lastAttemptAt: string;  // ISO datetime
        lastError: string;
        nextAttemptAt: string;  // ISO datetime
        maxAttempts?: number;  // optional override
        dead?: boolean;  // true when moved to dead letter
    }

    type ExpiredMembersQueue = ExpiredMember[];
}
