# AI-Augmented Terminal - Coding Session Notes

## 1. Application Purpose

To create a cross-platform desktop terminal application using Electron that allows users to interact with local and remote shells (CMD, PowerShell, bash, SSH). The core feature is an integrated AI assistant (Google Gemini) that can understand user queries, provide help, suggest commands, and, with explicit user approval, execute those commands directly in the active terminal session and interpret their output.

## 2. Core Functionality

*   **Integrated Terminal Emulator**: Standard terminal functionalities, multiple tabs/sessions (tabs are future), local shell connections (CMD, PowerShell, bash/zsh), remote SSH (future).
*   **AI Assistant (Google Gemini)**: Dedicated UI panel for AI interaction, troubleshooting help, command suggestions.
*   **AI Command Execution & Feedback Loop**:
    *   AI proposes commands via Gemini Tool Use (`execute_terminal_command`).
    *   Strict user approval before execution.
    *   AI receives the output of the executed command for further analysis or next steps.
*   **Contextual Awareness (Basic)**: AI considers recent (cleaned) terminal history. More advanced context (cwd, shell type) is planned.

## 3. Information for AI Agent (Resuming Session)

### 3.1. Target Technology Stack

*   **Framework**: Electron
*   **Frontend (Renderer Process)**: HTML, CSS, TypeScript
*   **Terminal Component**: xterm.js
*   **Backend (Main Process)**: Node.js, TypeScript
*   **Shell Interaction**: `node-pty`
*   **AI API**: Google Gemini API (via `@google/generative-ai` Node.js SDK)
*   **Settings Storage**: `electron-store`

### 3.2. Key Modules/Libraries (npm packages)

*   `electron`
*   `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`
*   `node-pty` (using `github:microsoft/node-pty`)
*   `@google/generative-ai`
*   `electron-store`
*   `webpack`, `ts-loader`, `typescript` for the build process.

### 3.3. Current Project Structure (Simplified)

```
src/
├── main.ts                 # Main process orchestrator
├── ai-service.ts           # Core Gemini API interaction logic
├── ai-tools.ts             # Gemini tool definitions
├── google-ai-utils.ts      # Utilities for Gemini (model listing, fallbacks)
├── renderer.ts             # Renderer process entry point
├── main-process/
│   ├── app-lifecycle.ts
│   ├── pty-manager.ts
│   ├── window-manager.ts
│   └── ipc-handlers/
│       ├── ai-ipc.ts
│       ├── settings-ipc.ts
│       └── terminal-ipc.ts
└── renderer-process/
    ├── ai-interface.ts
    ├── dom-elements.ts
    ├── model-select.ts
    ├── settings-ui.ts
    ├── terminal-setup.ts
    └── ui-utils.ts
index.html
package.json
tsconfig.json             # For renderer process (via webpack)
tsconfig.main.json        # For main process
webpack.config.js
```

## 4. Current State & Achievements (As of May 9, 2025)

*   **Basic Electron App**: Functional Electron application structure with TypeScript for main and renderer processes.
*   **Terminal Emulation**: `xterm.js` integrated, supporting local shells (PowerShell on Windows, bash/zsh via WSL or native). PTY processes managed by `node-pty`.
*   **AI Chat Interface**: UI panel for AI interaction.
*   **Gemini Integration**:
    *   Google Gemini API connected via the `@google/generative-ai` SDK.
    *   User can input API key and select a model name (from a dropdown populated by SDK call or fallback list) via a settings panel. Settings are stored using `electron-store`.
*   **AI Command Suggestion (Tool Use)**:
    *   Gemini can suggest commands using a defined tool (`execute_terminal_command`).
    *   Renderer UI displays these suggestions with "Approve" / "Deny" buttons.
*   **Command Execution**: Approved commands are sent to the active terminal session for execution.
*   **Initial Feedback Loop**:
    *   Attempt to capture output from executed commands using an end-marker strategy.
    *   Captured output is sent back to the Gemini model for follow-up.
*   **Output/History Cleaning**:
    *   ANSI escape codes (and backspaces) are stripped from terminal history sent to AI and from captured command output.
    *   Initial heuristics in place to clean echoed commands from captured output (this is the current area of focus for improvement).
*   **Code Refactoring**:
    *   `main.ts` has been refactored into smaller, more focused modules.
    *   `renderer.ts` has been refactored into smaller UI and logic modules.
    *   `ai-service.ts` has been refactored to separate tool definitions and model listing utilities.
*   **Development Aids**: Conditional logging for AI interactions in the main process console.

## 5. Pending Tasks & Current Focus

### 5.1. Immediate Focus / Current Challenge:

*   **Reliable Command Output Cleaning**:
    *   The output captured from AI-executed commands and sent back to Gemini is still often "messy". It includes shell prompts, echoed user commands, and echoed marker commands, despite current cleaning heuristics.
    *   **Goal**: Significantly improve the cleaning logic in `src/main-process/ipc-handlers/terminal-ipc.ts` to isolate *only* the true output of the executed command. This is critical for the AI to accurately interpret results.
    *   The detailed debug logging added in the last step should be used to analyze and refine this.

### 5.2. Broader Pending Items (from Project Plan):

*   **Full Feedback Loop Refinement**: Once output cleaning is reliable, ensure Gemini effectively processes this clean output and provides useful, contextual follow-up.
*   **SSH Integration** (Phase 4): Connect to remote servers.
*   **Multiple Tabs/Sessions** (Phase 4): Allow users to manage multiple terminal sessions.
*   **Enhanced Contextual Awareness for AI** (Phase 4): Send current working directory, shell type, etc., to Gemini.
*   **Advanced Settings/Customization** (Phase 4): More user preferences (default shell, themes, AI behavior).
*   **Robust Error Handling & UI Polish** (Ongoing): Continuously improve stability and user experience.
*   **Investigate `listModels` SDK Issue**: The `@google/generative-ai` SDK's `listModels()` method is not working as expected at runtime (throws "is not a function"). A fallback list is currently used. This might be an SDK version issue or environment interaction.

## 6. Key Learnings, Challenges & Workarounds During Development (Session Specific)

*   **`@google/generative-ai` SDK `listModels()` Issue**:
    *   **Challenge**: The `listModels()` method on the `GoogleGenerativeAI` client instance consistently fails at runtime with a "is not a function" error, despite being documented for the SDK version (`^0.24.1`).
    *   **Workaround**: Implemented a fallback mechanism using a hardcoded list of common Gemini models (`FALLBACK_MODELS` in `google-ai-utils.ts`) to ensure the model selection dropdown in settings is always populated. A warning is logged when the fallback is used.

*   **Command Output Capturing & Cleaning**:
    *   **Challenge**: Reliably isolating the true output of commands executed via `node-pty` is difficult. The raw PTY stream includes shell prompts, echoed input commands, the command's actual output, and control characters.
    *   **Current Strategy**: An end-marker (`printf "__TOOL_CMD_OUTPUT_END_..."`) is appended to the executed command. Output is captured until this marker. ANSI codes and backspaces are stripped. Heuristics are applied to try and remove echoed command lines and the marker command itself from the captured output.
    *   **Status**: This remains the primary area of active debugging and refinement. Detailed debug logs have been added to `terminal-ipc.ts` to trace the cleaning process.

*   **`electron-store` TypeScript Typing**:
    *   **Challenge**: Persistent TypeScript errors where `get()` and `set()` methods were not recognized on the `electron-store` instance, despite various typing attempts (using `Schema`, explicit type annotations, and exporting the store type).
    *   **Workaround**: Applied type assertions `(store as any).get(...)` and `(store as any).set(...)` in the main process files (`main.ts`, `ai-ipc.ts`, `settings-ipc.ts`) for calls to `electron-store`. This sacrifices some type safety for these specific calls but resolved the compilation blockers.

*   **AI System Prompt Instructions**:
    *   **Decision**: Enhanced the initial system prompt sent to the Gemini model (in `ai-service.ts`) to include specific instructions for formatting its responses (e.g., use of markdown code blocks with language identifiers for commands, keeping commands on a single line, conciseness). This aims to make the AI's output more structured and easier for the application (and user) to parse or use.

*   **Code Modularity (Refactoring)**:
    *   **Decision**: Proactively refactored `main.ts`, `renderer.ts`, and `ai-service.ts` into smaller, more focused modules. This improves organization, readability, and maintainability as the codebase grows.
    *   **Structure**: Main process logic is now under `src/main-process/` (with sub-folders for `ipc-handlers`), renderer logic under `src/renderer-process/`, and AI-specific utilities like `ai-tools.ts` and `google-ai-utils.ts` are at the `src/` level (as they are used by `ai-service.ts` which is also at `src/`).

The next step in the previous session was to test the latest improvements to the command output cleaning logic after adding more detailed debug logs.
