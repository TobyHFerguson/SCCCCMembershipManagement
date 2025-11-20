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

    interface ExpiredMember{
    // FIFO row / processing entry for an expiring member
    id?: string;
    createdAt?: string; // ISO datetime
    status?: 'pending' | 'in-progress' | 'dead' | 'done';
    memberEmail?: string;
    memberName?: string;
    expiryDate?: string; // ISO date-only YYYY-MM-DD
    actionType?: string; // e.g. 'notify+remove'
    groups?: string; // Comma-separated emails
    // prefillUrl removed: email bodies are fully expanded before enqueueing
    emailTo?: string;
    emailSubject?: string;
    emailBody?: string;
    // Legacy message fields (kept for compatibility)
    email?: string;
    subject?: string;
    htmlBody?: string;
    attempts?: number;
    lastAttemptAt?: string;
    lastError?: string;
    nextRetryAt?: string;
    maxRetries?: number | string;
    dead?: boolean;
    note?: string;
}

    type ExpiredMembersQueue = ExpiredMember[];
}
