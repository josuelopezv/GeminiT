// src/utils/logger.ts
import { app } from 'electron'; // To check if packaged

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

// Temporarily force DEBUG level for this testing session
const CURRENT_LOG_LEVEL: LogLevel = LogLevel.DEBUG; 
// const CURRENT_LOG_LEVEL: LogLevel = app && !app.isPackaged ? LogLevel.DEBUG : LogLevel.INFO; // Original line

function formatMessage(level: LogLevel, tag: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level];
    let formattedArgs = '';
    if (args.length > 0) {
        formattedArgs = args.map(arg => {
            if (typeof arg === 'string') return arg;
            try {
                return JSON.stringify(arg, null, 2); // Pretty print objects
            } catch (e) {
                return '[Unserializable Object]';
            }
        }).join(' ');
    }
    return `[${timestamp}] [${levelStr}] [${tag}] ${message} ${formattedArgs}\n`;
}

export class Logger {
    private tag: string;

    constructor(tag: string) {
        this.tag = tag;
    }

    private static logToConsole(level: LogLevel, message: string) {
        if (level >= LogLevel.WARN) {
            process.stderr.write(message);
        } else {
            process.stdout.write(message);
        }
    }

    public debug(message: string, ...args: any[]): void {
        if (CURRENT_LOG_LEVEL <= LogLevel.DEBUG) {
            Logger.logToConsole(LogLevel.DEBUG, formatMessage(LogLevel.DEBUG, this.tag, message, ...args));
        }
    }

    public info(message: string, ...args: any[]): void {
        if (CURRENT_LOG_LEVEL <= LogLevel.INFO) {
            Logger.logToConsole(LogLevel.INFO, formatMessage(LogLevel.INFO, this.tag, message, ...args));
        }
    }

    public warn(message: string, ...args: any[]): void {
        if (CURRENT_LOG_LEVEL <= LogLevel.WARN) {
            Logger.logToConsole(LogLevel.WARN, formatMessage(LogLevel.WARN, this.tag, message, ...args));
        }
    }

    public error(message: string, ...args: any[]): void {
        if (CURRENT_LOG_LEVEL <= LogLevel.ERROR) {
            Logger.logToConsole(LogLevel.ERROR, formatMessage(LogLevel.ERROR, this.tag, message, ...args));
        }
    }
}

// Default logger instance if needed, or encourage instantiation
// export const defaultLogger = new Logger('APP');
