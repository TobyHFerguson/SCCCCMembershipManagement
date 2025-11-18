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
    email:string;
    subject:string;
    htmlBody:string;
    groups?: string[];
    attempts?: number;
    lastError?: string;
}

    type ExpiredMembersQueue = ExpiredMember[];
}
