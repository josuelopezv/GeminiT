import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as os from 'os';
import { AIService } from './ai-service';

// Import node-pty with error handling and type definition
interface IPty {
    spawn: (file: string, args: string[], options: any) => IPtyProcess;
}

interface IPtyProcess {
    pid: number;
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    onData: (callback: (data: string) => void) => void;
}

let pty: IPty;
try {
    pty = require('node-pty');
} catch (err) {
    console.error('Failed to load node-pty:', err);
    process.exit(1);
}

let mainWindow: BrowserWindow | null = null;

const shells = new Map<string, IPtyProcess>();

// Initialize AI service
const aiService = new AIService(process.env.GEMINI_API_KEY || '');

function cleanup() {
    // Kill all running terminal processes
    shells.forEach((ptyProcess) => {
        try {
            if (process.platform === 'win32') {
                // On Windows, we need to kill the process tree
                const cp = require('child_process');
                cp.exec(`taskkill /pid ${ptyProcess.pid} /T /F`);
            } else {
                process.kill(ptyProcess.pid);
            }
        } catch (err) {
            console.error('Error killing process:', err);
        }
    });
    shells.clear();
}

function createWindow() {
    try {
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });

        const htmlPath = path.join(__dirname, '../index.html');
        console.log('Loading HTML from:', htmlPath);
        mainWindow.loadURL(`file://${htmlPath}`);
        mainWindow.webContents.openDevTools();

        mainWindow.on('closed', () => {
            cleanup();
            mainWindow = null;
        });
    } catch (err) {
        const error = err as Error;
        console.error('Error creating window:', error);
        process.exit(1);
    }
}

// Terminal handling

ipcMain.on('terminal:create', (event, id: string) => {
    try {
        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
        const ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd: process.env.HOME,
            env: process.env
        });

        shells.set(id, ptyProcess);

        ptyProcess.onData((data: string) => {
            mainWindow?.webContents.send('terminal:data', { id, data });
        });

        console.log('Terminal process created with ID:', id);
    } catch (err) {
        const error = err as Error;
        console.error('Error creating terminal:', error);
        mainWindow?.webContents.send('terminal:error', { id, error: error.message });
    }
});

ipcMain.on('terminal:input', (event, { id, data }: { id: string; data: string }) => {
    try {
        const ptyProcess = shells.get(id);
        if (ptyProcess) {
            ptyProcess.write(data);
        }
    } catch (err) {
        const error = err as Error;
        console.error('Error writing to terminal:', error);
    }
});

ipcMain.on('terminal:resize', (event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    try {
        const ptyProcess = shells.get(id);
        if (ptyProcess) {
            ptyProcess.resize(cols, rows);
        }
    } catch (err) {
        const error = err as Error;
        console.error('Error resizing terminal:', error);
    }
});

// AI handling
ipcMain.handle('ai:process-query', async (event, { query, terminalHistory }) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY environment variable is not set');
        }
        return await aiService.processQuery(query, terminalHistory);
    } catch (error) {
        console.error('AI processing error:', error);
        throw error;
    }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    cleanup();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});