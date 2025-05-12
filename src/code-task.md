Instruction Set for AI Coding Agent: Advanced Electron Terminal Component
Project Goal: Evolve the existing TerminalComponent.tsx within an Electron/React/TypeScript application into a sophisticated, feature-rich terminal. Key areas include advanced xterm.js addon integration, robust user interaction features (copy/paste, context menus), AI command execution with clean output capture for external processing, persistent settings, and scalable state management.
Target File for Primary Analysis & Initial Modifications: TerminalComponent.tsx
(The AI Agent should also identify necessary modifications and new functionalities in preload.js and main.ts to support the component's requirements.)
General Instructions for the AI Agent:
Analyze Existing Code: Thoroughly analyze the provided TerminalComponent.tsx. Identify its current strengths, weaknesses, and areas of complexity, particularly concerning initialization, event handling, and state management.
Prioritize Modularity & Readability (Aggressive Refactoring Permitted): As new features are planned, proactively suggest refactoring opportunities. You have explicit permission to propose significant code restructuring, deletion of redundant or overly complex sections, splitting logic into new files (hooks, utilities, sub-components), or even starting specific sections from scratch if doing so will lead to a substantially more maintainable, readable, and robust codebase. Your primary goal here is long-term code health. Outline the structure of these new files if proposed.
Type Safety & Best Practices: All planned additions must adhere to TypeScript best practices. Maintain and enhance type safety.
Error Handling Strategy: Propose a consistent error handling strategy for both internal logic and user-facing issues. Describe how errors from IPC, PTY operations, or addon interactions should be caught, logged (using the existing logger instance referenced in the provided code), and potentially communicated to the user.
IPC Design: For any new renderer-to-main communication, clearly define the purpose of each IPC channel, the structure of the data payload, and whether it should be a one-way (send) or two-way (invoke/handle) communication.
State Management Philosophy: Evaluate the current state management. For new UI-related states (e.g., search visibility, AI interaction status), propose how zustand (or a similar lightweight state manager) can be integrated effectively to manage this state, ensuring the TerminalComponent remains focused on terminal logic.
Dependencies: List any new essential npm packages required for the planned features. Assume commonly used packages like uuid, shell-quote, electron-store, zustand, and xterm.js addons are available or can be specified for installation.
Feature Implementation Plan & Analysis Prompts:
Feature 1: Integrate Additional Xterm.js Addons
Requirement: Integrate @xterm/addon-search and @xterm/addon-serialize.
AI Task:
Describe the necessary steps to import, instantiate, and load these addons within the TerminalComponent.tsx's initialization lifecycle.
Identify where refs for these addons should be stored.
Confirm if any specific cleanup is required for these addons upon component unmount.
Feature 2: Implement Search Functionality
Requirement: Enable users to search within the terminal buffer.
AI Task:
Propose how search-related state (e.g., query, options, active results) should be managed. Consider zustand if appropriate.
Outline the functions needed to interact with SearchAddon (e.g., findNext, findPrevious, clearSearchDecorations).
Suggest how search could be triggered (e.g., UI elements, keyboard shortcuts) and how these triggers would interact with the search functions and SearchAddon.
If implementing keyboard shortcuts, explain how this would integrate with an existing or a new attachCustomKeyEventHandler.
Feature 3: Implement Screen Export (Serialize Addon)
Requirement: Allow users to export terminal content as plain text.
AI Task:
Design a function (e.g., exportTerminalContent) that utilizes SerializeAddon to get the terminal's content.
Propose methods for handling the serialized content (e.g., copying to clipboard via electronAPI, sending to the main process for file saving).
If file saving is chosen, outline the necessary IPC channel and the main process logic (using dialog.showSaveDialog and fs.writeFile).
Suggest how this feature would be triggered by the user (e.g., context menu option, button).
Feature 4: Implement Robust Copy & Paste
Requirement:
Ctrl/Cmd+C: Copy selected text; if no selection, send SIGINT to PTY.
Ctrl/Cmd+V: Paste clipboard content into the terminal.
AI Task:
Confirm the suitability of attachCustomKeyEventHandler for this feature.
Detail the logic within the event handler for both copy and paste scenarios, including platform detection (Mac vs. others), interaction with xterm.hasSelection(), xterm.getSelection(), and the electronAPI for clipboard access (clipboardWriteText, clipboardReadText).
Explain how to ensure other key events are still processed normally by xterm.js.
Specify how the disposable from attachCustomKeyEventHandler should be managed for cleanup.
Feature 5: Implement Context Menu
Requirement: Provide a right-click context menu.
AI Task:
Describe how to capture the contextmenu event on the terminal container.
Outline the process of dynamically building an Electron Menu template in the renderer based on the current state (e.g., if text is selected, enable "Copy"). Include actions like Copy, Paste, Clear Terminal, Export Screen.
Design the IPC mechanism (invoke/handle) for sending this menu template to the main process and triggering Menu.buildFromTemplate().popup(). Reference electron-context-menu as a potential simplification if applicable, or explain a custom approach.
Feature 6: AI Command Integration - Execution & Clean Output Capture
Requirement:
Programmatically send an AI-suggested command to the user-visible PTY.
Reliably capture the complete, clean text output of only that specific command for external AI processing.
AI Task - Analysis & Strategy Design:
Core Challenge: Analyze the challenge of isolating the output of a single command within an ongoing, interactive PTY session.
Proposed Strategy (End Marker & IPC): Evaluate the "End Marker" strategy:
Renderer sends command and terminalId to Main via ipcRenderer.invoke.
Main process generates a unique end marker (using uuid).
Main process writes the command\r then echo "UNIQUE_MARKER"\r to the PTY associated with terminalId.
Main process temporarily buffers PTY data, looking for the marker to signal command completion.
Once the marker is detected, the buffered output (before the marker) is processed with strip-ansi.
The clean text is returned to the renderer via the invoke promise.
Refinements & Alternatives:
Is a global boolean flag (e.g., isCapturingForAI) in the main process sufficient or problematic if multiple PTYs exist or multiple commands are queued? Propose how to manage capture state per terminalId or PTY instance.
Suggest the best way to handle the ptyProcess.onData listener in the main process during AI command capture. Should the existing listener be modified, or should a temporary, specific listener be added and then removed?
How should command echoing by the shell itself and the echoed marker command be removed from the captured output before strip-ansi?
Outline a robust timeout mechanism for the capture process.
How should shell-quote be used to ensure AI-suggested commands are safely passed to the shell?
IPC Design: Specify the channel name and payload for the invoke call and the structure of the data returned by the handle function.
strip-ansi Integration: Pinpoint exactly where in the main process logic strip-ansi should be applied.
Feature 7: Integrate electron-store (Settings Persistence)
Requirement: Persist terminal settings (e.g., theme preference).
AI Task:
Describe how electron-store would be initialized and used in the main process.
Design the IPC channels (invoke/handle or send/on) for the renderer to get and set stored values.
Explain how TerminalComponent.tsx would use these IPC channels to load settings on mount and save them when changed.
Feature 8: Integrate zustand (State Management)
Requirement: Manage UI-related state for the terminal component.
AI Task:
Identify specific pieces of state within TerminalComponent.tsx or related to its new features (e.g., search query, search UI visibility, AI loading indicators, context menu dynamic properties) that would benefit from being managed by zustand.
Propose the structure of a zustand store (or multiple stores/slices if appropriate) for this terminal-related UI state.
Explain how TerminalComponent.tsx would connect to and utilize this store.
Final Considerations for the AI Agent:
Refactoring Plan (Emphasize Freedom): After analyzing all feature requirements, propose a high-level refactoring plan for TerminalComponent.tsx. Reiterate that you are encouraged to be bold in your refactoring suggestions, including deleting existing code or files and starting anew for specific functionalities if it improves overall maintainability and clarity. If the component is too monolithic, detail how logic could be extracted into custom React hooks (e.g., useXtermSetup, usePtyCommunication, useSearchAddon, useAICommandInterface), utility files, or distinct sub-components. Outline the responsibilities of these new modules.
Testing Strategy (Conceptual): Briefly touch upon how one might approach testing key parts of this component, especially the IPC interactions and the AI command capture logic.
Performance: Identify any potential performance bottlenecks that might arise from the new features and suggest mitigation strategies (e.g., memoization, careful effect dependencies, efficient event handling).