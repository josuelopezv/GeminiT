// src/renderer-process/command-parser.ts
export interface ParsedCommand {
    command: string;
    lang?: string; // e.g., "powershell", "sh"
}

/**
 * Parses commands from AI's text response, looking for markdown code blocks.
 * Returns an array of found commands. Handles ```lang\ncode\n``` and ```\ncode\n```.
 * Prioritizes powershell and sh/bash, but will take generic code blocks too.
 */
export function parseCommandsFromText(text: string): ParsedCommand[] {
    const commands: ParsedCommand[] = [];
    // Regex to find ```lang\ncode\n``` or ```\ncode\n```
    // It captures the language (optional) and the code block content.
    const regex = /```(\w*)\s*\n([\s\S]*?)\n```/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const lang = match[1]?.trim().toLowerCase() || undefined;
        let commandText = match[2].trim();

        // If the language is powershell or sh/bash, or if no language is specified but it looks like a command,
        // we consider it. We also respect the AI's instruction to keep commands on a single line.
        // If a block contains multiple lines, and it's not explicitly a script language we might support later,
        // we might only take the first line or split by newline if appropriate.
        // For now, if the AI is instructed to give single-line commands, we take commandText as is.
        
        if (commandText) {
            // If the AI gives multiple distinct commands in separate code blocks, this loop handles it.
            // If one code block contains multiple lines of commands, our current prompt asks for single-line commands.
            // If we want to support multi-line scripts from a single block, this part would need adjustment.
            commands.push({ command: commandText, lang });
        }
    }
    return commands;
}
