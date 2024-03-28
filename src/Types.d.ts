interface Logger {
    joinSuccess(any, any)
    joinFailure(any, any, any)
    renewalSuccess(any, any)
    joinFailure(any, any, any)
    partial(any, any)
}

interface LogEntry {
    txn: string
    member: string
    error?: string
}

type Transaction = any
type Member = any

declare namespace bmUnitTester {
    type UnitResult = any;
    interface TestOptions {
        description?:string;
        neverUndefined?:boolean;
        showErrorsOnly?:boolean;
        skip?:boolean
    }
    interface UnitSection {
        test:() => void;
        options:TestOptions;
    }
    class Unit {
        constructor (TestOptions)
        isGood(): boolean
        section(test: () => void, options?: TestOptions): void;
        is(expect: any, actual: any, options?:TestOptions): UnitTest;
        not(expect: any, actual: any, options?:TestOptions): UnitTest;

    }
}

interface AdminDirectoryType {
    Users?: UsersCollection;
}

export { Logger, LogEntry , bmUnitTester, Transaction, AdminDirectoryType }