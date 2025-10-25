declare namespace Common {
    interface Logger {
        info(service: string, message: string): void;
        warn(service: string, message: string): void;
        error(service: string, message: string, error?: any): void;
        debug(service: string, message: string): void;
    }
}