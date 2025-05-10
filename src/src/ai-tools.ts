import { Tool, FunctionDeclaration } from '@google/generative-ai';

export const EXECUTE_TERMINAL_COMMAND_TOOL: Tool = {
    functionDeclarations: [
        {
            name: "execute_terminal_command",
            description: "Executes a shell command in the user's terminal and returns its output. Use this to perform actions or retrieve information from the user's system.",
            parameters: {
                type: "object",
                properties: {
                    command: {
                        type: "string",
                        description: "The terminal command to execute (e.g., 'ls -l', 'git status')."
                    }
                },
                required: ["command"]
            }
        } as FunctionDeclaration
    ]
};
