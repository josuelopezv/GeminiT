import * as os from 'os';
import * as child_process from 'child_process';
import { IDisposable } from 'node-pty';
import { Logger } from '../utils/logger'; 

const logger = new Logger('PtyManager'); 

export interface IPtyProcess {
    pid: number;
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    onData: (callback: (data: string) => void) => IDisposable;
    kill: (signal?: string) => void;
}

export interface IPty {
    spawn: (file: string, args: string[] | string, options: any) => IPtyProcess;
}

let pty: IPty;
try {
    pty = require('node-pty');
} catch (err) {
    logger.error('Failed to load node-pty:', err);
    process.exit(1);
}

export const shells = new Map<string, IPtyProcess>();

export function spawnPtyProcess(
    id: string,
    shellCmd: string,
    cols: number,
    rows: number,
    onDataCallback: (data: string) => void,
    onExitCallback: () => void
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

        logger.info(`PTY process created with ID: ${id}, PID: ${ptyProcess.pid}, Shell: ${shellCmd}`);
        return ptyProcess;
    } catch (err) {
        logger.error(`Error spawning PTY process for ID ${id}:`, err);
        return null;
    }
}

export function writeToPty(id: string, data: string): boolean {
    const ptyProcess = shells.get(id);
    if (ptyProcess) {
        try {
            logger.debug(`Writing to PTY ID ${id}, Data:`, data); // New log
            ptyProcess.write(data);
            return true;
        } catch (err) {
            logger.error(`Error writing to PTY ${id}:`, err);
            return false;
        }
    }
    logger.warn(`Attempted to write to non-existent PTY ID: ${id}`);
    return false;
}

export function resizePty(id: string, cols: number, rows: number): boolean {
    const ptyProcess = shells.get(id);
    if (ptyProcess) {
        try {
            ptyProcess.resize(cols, rows);
            return true;
        } catch (err) {
            logger.error(`Error resizing PTY ${id}:`, err);
            return false;
        }
    }
    logger.warn(`Attempted to resize non-existent PTY ID: ${id}`);
    return false;
}

export function cleanupPtyProcesses() {
    logger.info('Cleaning up PTY processes...');
    shells.forEach((ptyProcess, id) => {
        try {
            logger.info(`Killing PTY process ID: ${id}, PID: ${ptyProcess.pid}`);
            if (process.platform === 'win32') {
                child_process.execSync(`taskkill /pid ${ptyProcess.pid} /T /F`);
            } else {
                ptyProcess.kill();
            }
        } catch (err) {
            logger.error(`Error killing PTY process ${id} (PID: ${ptyProcess.pid}):`, err);
        }
    });
    shells.clear();
    logger.info('PTY processes cleanup complete.');
}
