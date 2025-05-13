import stripAnsi from 'strip-ansi';
import { Logger } from './logger';

const logger = new Logger('StringUtils');

// Set this to true when you need to debug character-by-character processing in stripAnsiCodes
export const ENABLE_VERBOSE_STRIP_ANSI_DEBUG = true; // Default to false to reduce log noise

/**
 * Strips ANSI escape codes from a string using the strip-ansi package.
 * @param str The input string.
 * @returns The cleaned string.
 */
export function stripAnsiCodes(str: string): string {
    logger.debug(`[stripAnsiCodes INPUT]:`, str);
    const result = stripAnsi(str);
    logger.debug(`[stripAnsiCodes FINAL RESULT]:`, result);
    return result;
}
