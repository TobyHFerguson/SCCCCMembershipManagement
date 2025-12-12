declare namespace Common {
    interface Logger {
        info(service: string, message: string, data?: any): void;
        warn(service: string, message: string, data?: any): void;
        error(service: string, message: string, error?: any): void;
        debug(service: string, message: string, data?: any): void;
    }
}