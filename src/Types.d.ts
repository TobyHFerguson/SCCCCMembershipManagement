interface Logger {
    joinSuccess(string, string)
    joinFailure(string, string, string)
    renewalSuccess(string, string)
    joinFailure(string, string, string)
    partial(string,string)
}

interface LogEntry {
    txn: string
    member: string
    error?: string
}



export { Logger, LogEntry }