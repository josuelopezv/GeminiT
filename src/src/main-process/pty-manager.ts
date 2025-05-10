import * as os from 'os';
import * as child_process from 'child_process';
import { IDisposable } from 'node-pty'; // Import IDisposable from node-pty

// Import node-pty with error handling and type definition
export interface IPtyProcess {
    pid: number;
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    onData: (callback: (data: string) => void) => IDisposable; // Corrected return type
    kill: (signal?: string) => void; // Added kill for cleanup
}

export interface IPty {
    spawn: (file: string, args: string[] | string, options: any) => IPtyProcess;
}

let pty: IPty;
try {
    pty = require('node-pty');
} catch (err) {
    console.error('Failed to load node-pty:', err);
    process.exit(1); // Exit if pty loading fails, as it's critical
}

export const shells = new Map<string, IPtyProcess>();

export function spawnPtyProcess(
    id: string,
    shellCmd: string,
    cols: number,
    rows: number,
    onDataCallback: (data: string) => void,
    onExitCallback: () => void // Callback for when process exits
): IPtyProcess | null {
    try {
        const ptyProcess = pty.spawn(shellCmd, [], {
            name: 'xterm-color',
            cols: cols || 80,
            rows: rows || 30,
            cwd: process.env.HOME || os.homedir(),
            env: process.env
        });

        shells.set(id, ptyProcess);
        ptyProcess.onData(onDataCallback);
        
        // Handle process exit (this is a simplified handler, node-pty might have more specific events)
        // For now, we'll rely on onData to stop firing or an explicit kill.
        // A more robust solution might involve ptyProcess.on('exit', ...) if available and consistent.

        console.log(`PTY process created with ID: ${id}, PID: ${ptyProcess.pid}, Shell: ${shellCmd}`);
        return ptyProcess;
    } catch (err) {
        console.error(`Error spawning PTY process for ID ${id}:`, err);
        return null;
    }
}

export function writeToPty(id: string, data: string): boolean {
    const ptyProcess = shells.get(id);
    if (ptyProcess) {
        try {
            ptyProcess.write(data);
            return true;
        } catch (err) {
            console.error(`Error writing to PTY ${id}:`, err);
            return false;
        }
    }
    return false;
}

export function resizePty(id: string, cols: number, rows: number): boolean {
    const ptyProcess = shells.get(id);
    if (ptyProcess) {
        try {
            ptyProcess.resize(cols, rows);
            return true;
        } catch (err) {
            console.error(`Error resizing PTY ${id}:`, err);
            return false;
        }
    }
    return false;
}

export function cleanupPtyProcesses() {
    console.log('Cleaning up PTY processes...');
    shells.forEach((ptyProcess, id) => {
        try {
            console.log(`Killing PTY process ID: ${id}, PID: ${ptyProcess.pid}`);
            if (process.platform === 'win32') {
                child_process.execSync(`taskkill /pid ${ptyProcess.pid} /T /F`);
            } else {
                ptyProcess.kill(); // Use pty's own kill or process.kill
            }
        } catch (err) {
            console.error(`Error killing PTY process ${id} (PID: ${ptyProcess.pid}):`, err);
        }
    });
    shells.clear();
    console.log('PTY processes cleanup complete.');
}
