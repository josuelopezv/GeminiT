import { Logger } from './logger'; 

const logger = new Logger('StringUtils'); 

/**
 * Strips ANSI escape codes and processes backspace characters from a string.
 * Includes detailed logging for debugging character processing.
 * @param str The input string.
 * @returns The cleaned string.
 */
export function stripAnsiCodes(str: string): string {
    logger.debug(`[stripAnsiCodes INPUT]:`, str);
    const ansiRegex = /[\u001B\u009B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
    let cleanedStr = str.replace(ansiRegex, '');
    logger.debug(`[stripAnsiCodes AFTER ANSI REGEX]:`, cleanedStr);

    let result = '';
    for (let i = 0; i < cleanedStr.length; i++) {
        const char = cleanedStr[i];
        const charCode = char.charCodeAt(0);
        logger.debug(`[stripAnsiCodes DEBUG] Char: ${JSON.stringify(char)}, Code: ${charCode}, Index: ${i}`);
        if (charCode === 8) { // BS (Backspace, char code 8)
            logger.debug(`[stripAnsiCodes DEBUG] Backspace (charCode 8) found. Result before slice:`, result);
            if (result.length > 0) {
                result = result.slice(0, -1);
            }
        } else if (charCode < 32 && charCode !== 10 && charCode !== 13 && charCode !== 9) { // Other control characters (excluding LF, CR, TAB)
            logger.debug(`[stripAnsiCodes DEBUG] Discarding other control char: ${JSON.stringify(char)}, Code: ${charCode}`);
        } else {
            result += char;
        }
    }
    logger.debug(`[stripAnsiCodes FINAL RESULT]:`, result);
    return result;
}
