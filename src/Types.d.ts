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

export { Logger, LogEntry }