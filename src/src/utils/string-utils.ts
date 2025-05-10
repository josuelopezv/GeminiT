import { Logger } from './logger'; 

const logger = new Logger('StringUtils'); 

// Set this to true when you need to debug character-by-character processing in stripAnsiCodes
const ENABLE_VERBOSE_STRIP_ANSI_DEBUG = false; // Default to false to reduce log noise

/**
 * Strips ANSI escape codes and processes backspace characters from a string.
 * Includes detailed logging for debugging character processing.
 * @param str The input string.
 * @returns The cleaned string.
 */
export function stripAnsiCodes(str: string): string {
    // logger.info('stripAnsiCodes function CALLED.'); // This can also be noisy for every call
    logger.debug(`[stripAnsiCodes INPUT]:`, str);
    
    // Regex for ANSI escape codes (CSI sequences)
    const ansiRegex = /[\u001B\u009B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
    let cleanedStr = str.replace(ansiRegex, '');
    
    // Regex for OSC (Operating System Command) sequences (ESC ] ... BEL or ESC \)
    // This specifically targets sequences like window title setting: ESC ] 0 ; title BEL
    const oscRegex = /\u001B](?:[^\u0007\u001B]*|\u001B[^\u0007\u001B]*)*?(?:\u0007|\u001B\\)/g;
    cleanedStr = cleanedStr.replace(oscRegex, '');

    logger.debug(`[stripAnsiCodes AFTER ANSI/OSC REGEX]:`, cleanedStr);

    let result = '';
    let backspacesProcessed = 0;
    let charsKept = 0;
    let charsDiscardedByAllowList = 0;

    for (let i = 0; i < cleanedStr.length; i++) {
        const char = cleanedStr[i];
        const charCode = char.charCodeAt(0);
        if (ENABLE_VERBOSE_STRIP_ANSI_DEBUG) {
            logger.debug(`[stripAnsiCodes DETAIL] Char: ${JSON.stringify(char)}, Code: ${charCode}, Index: ${i}`);
        }
        if (charCode === 8) { // BS (Backspace, char code 8)
            backspacesProcessed++;
            if (ENABLE_VERBOSE_STRIP_ANSI_DEBUG) {
                logger.debug(`[stripAnsiCodes DETAIL] Backspace (charCode 8) found. Result before slice:`, result);
            }
            if (result.length > 0) {
                result = result.slice(0, -1);
            }
        } else if (
            (charCode >= 32 && charCode <= 126) || // Printable ASCII (space to ~)
            charCode === 10 || // Newline (LF)
            charCode === 13 || // Carriage Return (CR)
            charCode === 9      // Tab (HT)
        ) {
            result += char;
            charsKept++;
        } else {
            // Character is not a backspace and not in the allow-list
            charsDiscardedByAllowList++;
            if (ENABLE_VERBOSE_STRIP_ANSI_DEBUG) {
                logger.debug(`[stripAnsiCodes DETAIL] Discarding char by allow-list: ${JSON.stringify(char)}, Code: ${charCode}`);
            }
        }
    }

    if (ENABLE_VERBOSE_STRIP_ANSI_DEBUG) {
        logger.debug(`[stripAnsiCodes SUMMARY] Backspaces processed: ${backspacesProcessed}, Chars kept by allow-list: ${charsKept}, Chars discarded by allow-list: ${charsDiscardedByAllowList}`);
    }
    logger.debug(`[stripAnsiCodes FINAL RESULT]:`, result);
    return result;
}
