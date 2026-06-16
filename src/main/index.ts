import { app, shell, BrowserWindow, ipcMain, dialog, Menu, session } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import fs from 'fs'
import path from 'path'
import { spawn, ChildProcess } from 'child_process'

// node-pty is optional — graceful fallback to child_process if not compiled
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pty: any = null
try {
  pty = require('node-pty')
  console.log('[Terminal] node-pty loaded — real PTY mode')
} catch {
  console.log('[Terminal] node-pty unavailable — fallback to child_process')
}

// Enable Web Speech API in Electron (requires Google's speech service)
app.commandLine.appendSwitch('enable-speech-input')
app.commandLine.appendSwitch('enable-features', 'WebSpeechAPI')
app.commandLine.appendSwitch('disable-features', 'MediaStreamTrackTransfer')

let mainWindow: BrowserWindow | null = null
const runningProcesses = new Map<string, ChildProcess>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const terminals = new Map<string, any>()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1e1e2e',
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.maximize()
    mainWindow!.show()
    if (is.dev) {
      mainWindow!.webContents.openDevTools({ mode: 'detach' })
    }
  })

  // Intercept F12 BEFORE Electron processes it — send to renderer for editor commands
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const { key, control, alt, shift, meta } = input
    const ctrl = control || meta

    // F12 → Go to Definition (not DevTools)
    if (key === 'F12' && !ctrl && !alt && !shift) {
      event.preventDefault()
      mainWindow?.webContents.send('editor:command', 'goToDefinition')
    }
    // Ctrl+F12 → Peek Definition
    if (key === 'F12' && ctrl && !alt && !shift) {
      event.preventDefault()
      mainWindow?.webContents.send('editor:command', 'peekDefinition')
    }
    // Shift+F12 → Find All References
    if (key === 'F12' && !ctrl && !alt && shift) {
      event.preventDefault()
      mainWindow?.webContents.send('editor:command', 'findAllReferences')
    }
  })

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    console.error('[Main] Failed to load:', errorCode, errorDescription)
  })

  mainWindow.webContents.on('render-process-gone', (_, details) => {
    console.error('[Main] Renderer process gone:', details)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  Menu.setApplicationMenu(null)
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.momiji.ide')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Allow microphone + media permissions for Voice-to-Code
  session.defaultSession.setPermissionRequestHandler((_, permission, callback) => {
    const allowed = ['microphone', 'media', 'audioCapture', 'notifications']
    callback(allowed.includes(permission))
  })
  session.defaultSession.setPermissionCheckHandler((_, permission) => {
    const allowed = ['microphone', 'media', 'audioCapture']
    return allowed.includes(permission)
  })

  setupIpcHandlers()
  createWindow()

  // ── Auto-updater setup ──────────────────────────────────────────
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('updater:status', 'checking')
  })
  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater:status', 'available', info.version)
  })
  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('updater:status', 'latest')
  })
  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('updater:status', 'downloaded')
  })
  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('updater:status', 'error', err.message)
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Kill all running processes on quit
  runningProcesses.forEach((proc) => { try { proc.kill() } catch {} })
  if (process.platform !== 'darwin') app.quit()
})

function setupIpcHandlers(): void {
  // ─── App info + updater ────────────────────────────────────────────
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('updater:check', () => {
    if (!app.isPackaged) return 'dev-mode'
    autoUpdater.checkForUpdatesAndNotify()
  })
  ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall())

  // ─── Window controls ───────────────────────────────────────────────
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized())

  // ─── Dialogs ───────────────────────────────────────────────────────
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] })
    if (result.canceled) return null
    return result.filePaths[0]
  })
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openFile', 'multiSelections'] })
    if (result.canceled) return null
    return result.filePaths
  })

  // ─── File system ───────────────────────────────────────────────────
  ipcMain.handle('fs:readDir', async (_, dirPath: string) => {
    try { return readDirRecursive(dirPath, 2) } catch { return null }
  })
  ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return { content, error: null }
    } catch (err: unknown) { return { content: null, error: String(err) } }
  })
  ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
    try { fs.writeFileSync(filePath, content, 'utf-8'); return { success: true, error: null } }
    catch (err: unknown) { return { success: false, error: String(err) } }
  })
  ipcMain.handle('fs:createFile', async (_, filePath: string) => {
    try { fs.writeFileSync(filePath, '', 'utf-8'); return { success: true } }
    catch (err: unknown) { return { success: false, error: String(err) } }
  })
  ipcMain.handle('fs:createFolder', async (_, folderPath: string) => {
    try { fs.mkdirSync(folderPath, { recursive: true }); return { success: true } }
    catch (err: unknown) { return { success: false, error: String(err) } }
  })
  ipcMain.handle('fs:delete', async (_, targetPath: string) => {
    try {
      const stat = fs.statSync(targetPath)
      if (stat.isDirectory()) fs.rmSync(targetPath, { recursive: true, force: true })
      else fs.unlinkSync(targetPath)
      return { success: true }
    } catch (err: unknown) { return { success: false, error: String(err) } }
  })
  ipcMain.handle('fs:rename', async (_, oldPath: string, newPath: string) => {
    try { fs.renameSync(oldPath, newPath); return { success: true } }
    catch (err: unknown) { return { success: false, error: String(err) } }
  })
  ipcMain.handle('fs:stat', async (_, filePath: string) => {
    try {
      const stat = fs.statSync(filePath)
      return { isDirectory: stat.isDirectory(), size: stat.size, mtime: stat.mtime }
    } catch { return null }
  })
  ipcMain.handle('fs:watchDir', async (_, dirPath: string) => {
    try {
      fs.watch(dirPath, { recursive: true }, () => {
        mainWindow?.webContents.send('fs:dirChanged', dirPath)
      })
      return true
    } catch { return false }
  })

  // ─── HTTP Client (bypasses CORS, runs in main process) ────────────
  ipcMain.handle('http:request', async (_, opts: {
    method: string; url: string
    headers: Record<string, string>; body?: string; timeout?: number
  }) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.timeout ?? 30000)
    const start = Date.now()
    try {
      const res = await fetch(opts.url, {
        method: opts.method,
        headers: opts.headers,
        body: opts.body || undefined,
        signal: controller.signal
      })
      clearTimeout(timer)
      const elapsed = Date.now() - start
      const bodyText = await res.text()
      const resHeaders: Record<string, string> = {}
      res.headers.forEach((v, k) => { resHeaders[k] = v })
      return { ok: true, status: res.status, statusText: res.statusText, headers: resHeaders, body: bodyText, elapsed }
    } catch (err: unknown) {
      clearTimeout(timer)
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: msg, elapsed: Date.now() - start }
    }
  })

  // ─── File Search ───────────────────────────────────────────────────
  ipcMain.handle('fs:searchInFiles', async (_, dirPath: string, query: string, opts: { caseSensitive: boolean; useRegex: boolean }) => {
    interface SearchResult { file: string; fileName: string; line: number; col: number; text: string; match: string }
    const results: SearchResult[] = []
    const ignored = new Set(['.git', 'node_modules', '__pycache__', '.next', 'dist', 'build', '.venv', 'target', '.cache', 'out'])
    const MAX_RESULTS = 200
    const TEXT_EXTS = new Set(['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.cs', '.php', '.rb', '.swift', '.html', '.css', '.scss', '.json', '.yaml', '.yml', '.md', '.txt', '.sh', '.bash', '.sql', '.graphql', '.vue', '.svelte', '.env', '.toml', '.xml'])

    function searchDir(dir: string) {
      if (results.length >= MAX_RESULTS) return
      let items: import('fs').Dirent[]
      try { items = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
      for (const item of items) {
        if (results.length >= MAX_RESULTS) return
        if (ignored.has(item.name)) continue
        const fullPath = path.join(dir, item.name)
        if (item.isDirectory()) {
          searchDir(fullPath)
        } else {
          const ext = path.extname(item.name).toLowerCase()
          if (!TEXT_EXTS.has(ext)) continue
          try {
            const content = fs.readFileSync(fullPath, 'utf-8')
            const lines = content.split('\n')
            const pattern = opts.useRegex ? new RegExp(query, opts.caseSensitive ? 'g' : 'gi') : null
            lines.forEach((line, idx) => {
              if (results.length >= MAX_RESULTS) return
              let match = false
              let col = 0
              let matchText = query
              if (pattern) {
                const m = line.match(pattern)
                if (m) { match = true; col = line.search(pattern); matchText = m[0] }
              } else {
                const haystack = opts.caseSensitive ? line : line.toLowerCase()
                const needle = opts.caseSensitive ? query : query.toLowerCase()
                col = haystack.indexOf(needle)
                if (col >= 0) { match = true; matchText = line.slice(col, col + query.length) }
              }
              if (match) results.push({ file: fullPath, fileName: item.name, line: idx + 1, col: col + 1, text: line.trim().slice(0, 120), match: matchText })
            })
          } catch {}
        }
      }
    }

    try { searchDir(dirPath) } catch {}
    return results
  })

  // ─── Process Runner ────────────────────────────────────────────────
  ipcMain.handle('process:run', async (_, id: string, command: string, args: string[], cwd?: string) => {
    try {
      if (runningProcesses.has(id)) {
        try { runningProcesses.get(id)!.kill('SIGTERM') } catch {}
        runningProcesses.delete(id)
      }

      const workDir = cwd || process.env.USERPROFILE || process.env.HOME || 'C:\\'
      const proc = spawn(command, args, {
        cwd: workDir,
        shell: true,
        env: { ...process.env }
      })

      runningProcesses.set(id, proc)

      proc.stdout?.on('data', (data: Buffer) => {
        mainWindow?.webContents.send('process:stdout', id, data.toString())
      })
      proc.stderr?.on('data', (data: Buffer) => {
        mainWindow?.webContents.send('process:stderr', id, data.toString())
      })
      proc.on('close', (code: number | null) => {
        mainWindow?.webContents.send('process:exit', id, code ?? 0)
        runningProcesses.delete(id)
      })
      proc.on('error', (err: Error) => {
        mainWindow?.webContents.send('process:stderr', id, `\x1b[31mError: ${err.message}\x1b[0m\n`)
        mainWindow?.webContents.send('process:exit', id, 1)
        runningProcesses.delete(id)
      })

      return { success: true, pid: proc.pid }
    } catch (err: unknown) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('process:stdin', async (_, id: string, input: string) => {
    if (runningProcesses.has(id)) {
      const proc = runningProcesses.get(id)!
      try { proc.stdin?.write(input); return true } catch { return false }
    }
    return false
  })

  ipcMain.handle('process:kill', async (_, id: string) => {
    if (runningProcesses.has(id)) {
      const proc = runningProcesses.get(id)!
      try {
        if (process.platform === 'win32' && proc.pid) {
          spawn('taskkill', ['/F', '/T', '/PID', proc.pid.toString()], { shell: true })
        } else {
          proc.kill('SIGKILL')
        }
      } catch (err) {
        console.error(`Error killing process ${id}:`, err)
      }
      runningProcesses.delete(id)
      mainWindow?.webContents.send('process:exit', id, -1)
      return true
    }
    return false
  })

  ipcMain.handle('process:isRunning', async (_, id: string) => {
    return runningProcesses.has(id)
  })

  // ─── Inline Linting ───────────────────────────────────────────────
  ipcMain.handle('lint:python', async (_, filePath: string, pythonPath: string) => {
    return new Promise((resolve) => {
      const proc = spawn(pythonPath || 'python', ['-m', 'py_compile', filePath], { shell: true })
      let stderr = ''
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
      proc.on('close', (code) => {
        if (code === 0) { resolve([]); return }
        const errors: { line: number; col: number; message: string; severity: string }[] = []
        // Parse: File "path", line N / SyntaxError: msg
        const lineM = stderr.match(/line (\d+)/)
        const errM  = stderr.match(/(?:Error|Exception)[^\n]*/g)
        if (lineM) {
          errors.push({
            line: parseInt(lineM[1]),
            col: 1,
            message: errM?.[0]?.trim() ?? 'Syntax error',
            severity: 'error'
          })
        }
        resolve(errors)
      })
      proc.on('error', () => resolve([]))
    })
  })

  // ─── Python Interpreter Detection ─────────────────────────────────
  ipcMain.handle('python:detect', async (_, projectDir?: string) => {
    const results: { path: string; version: string; type: string }[] = []

    const runCmd = (cmd: string): Promise<string> =>
      new Promise((resolve) => {
        const p = spawn(cmd, ['--version'], { shell: true })
        let out = ''
        p.stdout?.on('data', (d: Buffer) => { out += d.toString() })
        p.stderr?.on('data', (d: Buffer) => { out += d.toString() }) // Python 2 prints to stderr
        p.on('close', () => resolve(out.trim()))
        p.on('error', () => resolve(''))
      })

    const tryInterpreter = async (exePath: string, type: string) => {
      const ver = await runCmd(JSON.stringify(exePath))
      if (ver.toLowerCase().includes('python')) {
        const match = ver.match(/Python (\d+\.\d+\.\d+)/i)
        if (match) results.push({ path: exePath, version: match[1], type })
      }
    }

    // System pythons
    await tryInterpreter('python', 'System')
    await tryInterpreter('python3', 'System')
    for (const v of ['3.13','3.12','3.11','3.10','3.9','3.8']) {
      await tryInterpreter(`python${v}`, `System Python ${v}`)
    }

    // Windows common install paths
    const winPaths = [
      `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python313\\python.exe`,
      `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python312\\python.exe`,
      `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python311\\python.exe`,
      `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python310\\python.exe`,
      `C:\\Python313\\python.exe`,
      `C:\\Python312\\python.exe`,
      `C:\\Python311\\python.exe`,
    ]
    for (const p of winPaths) {
      if (fs.existsSync(p)) await tryInterpreter(p, 'System')
    }

    // Virtual envs in project folder
    if (projectDir) {
      const venvNames = ['.venv', 'venv', 'env', '.env']
      const venvBins = ['Scripts\\python.exe', 'bin/python']
      for (const name of venvNames) {
        for (const bin of venvBins) {
          const p = path.join(projectDir, name, bin)
          if (fs.existsSync(p)) await tryInterpreter(p, `venv (${name})`)
        }
      }
    }

    // Conda — check if conda is available
    const condaOut = await runCmd('conda')
    if (condaOut) {
      try {
        const envsOut = await new Promise<string>((res) => {
          const p = spawn('conda', ['env', 'list', '--json'], { shell: true })
          let o = ''
          p.stdout?.on('data', (d: Buffer) => { o += d })
          p.on('close', () => res(o))
          p.on('error', () => res(''))
        })
        const data = JSON.parse(envsOut)
        for (const envPath of (data.envs ?? [])) {
          const pyExe = path.join(envPath, 'python.exe')
          if (fs.existsSync(pyExe)) await tryInterpreter(pyExe, `conda (${path.basename(envPath)})`)
        }
      } catch {}
    }

    // Deduplicate by path
    const seen = new Set<string>()
    return results.filter(r => {
      if (seen.has(r.path)) return false
      seen.add(r.path); return true
    })
  })

  // ─── SQLite Browser ────────────────────────────────────────────────
  ipcMain.handle('db:exec', async (_, dbPath: string, sql: string) => {
    return new Promise((resolve) => {
      const proc = spawn('sqlite3', [dbPath, '-json', sql], { shell: true })
      let out = '', err = ''
      proc.stdout?.on('data', (d: Buffer) => { out += d.toString() })
      proc.stderr?.on('data', (d: Buffer) => { err += d.toString() })
      proc.on('close', (code) => {
        if (code === 0) resolve({ ok: true, data: out })
        else resolve({ ok: false, error: err || 'Query failed' })
      })
      proc.on('error', () => resolve({
        ok: false,
        error: 'sqlite3 CLI not found. Install from https://sqlite.org/download.html or via: winget install SQLite.SQLite'
      }))
    })
  })

  // Shell command (for terminal)
  ipcMain.handle('process:shell', async (_, id: string, command: string, cwd?: string) => {
    return ipcMain.emit('process:run', null as any, id, command, [], cwd)
  })

  // ─── Terminal (node-pty if available, else child_process fallback) ──
  ipcMain.handle('terminal:create', async (_, id: string, cwd?: string) => {
    try {
      if (terminals.has(id)) {
        try { terminals.get(id).kill?.() || terminals.get(id).kill?.('SIGTERM') } catch {}
        terminals.delete(id)
      }

      const isWin   = process.platform === 'win32'
      const shell   = isWin ? 'cmd.exe' : (process.env.SHELL || 'bash')
      const workDir = cwd || process.env.USERPROFILE || process.env.HOME || '/'
      const env     = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', FORCE_COLOR: '1' } as Record<string, string>

      if (pty) {
        // ── node-pty: real PTY (keyboard works natively) ──
        const ptyProc = pty.spawn(shell, [], { name: 'xterm-256color', cols: 120, rows: 30, cwd: workDir, env })
        terminals.set(id, ptyProc)
        ptyProc.onData((data: string) => mainWindow?.webContents.send('terminal:data', id, data))
        ptyProc.onExit(({ exitCode }: { exitCode: number }) => {
          terminals.delete(id)
          mainWindow?.webContents.send('terminal:exit', id, exitCode ?? 0)
        })
        return { success: true, pid: ptyProc.pid, shell, mode: 'pty' }
      } else {
        // ── Fallback: child_process (no PTY, but functional) ──
        const proc = spawn(shell, [], { cwd: workDir, env, stdio: ['pipe', 'pipe', 'pipe'] })
        terminals.set(id, proc)
        proc.stdout?.on('data', (d: Buffer) => mainWindow?.webContents.send('terminal:data', id, d.toString()))
        proc.stderr?.on('data', (d: Buffer) => mainWindow?.webContents.send('terminal:data', id, d.toString()))
        proc.on('exit', (code: number | null) => {
          terminals.delete(id)
          mainWindow?.webContents.send('terminal:exit', id, code ?? 0)
        })
        return { success: true, pid: proc.pid, shell, mode: 'fallback' }
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('terminal:write', async (_, id: string, data: string) => {
    const proc = terminals.get(id)
    if (!proc) return false
    try {
      if (pty && proc.write) proc.write(data)          // node-pty
      else proc.stdin?.write(data)                      // child_process
      return true
    } catch { return false }
  })

  ipcMain.handle('terminal:resize', async (_, id: string, cols: number, rows: number) => {
    const proc = terminals.get(id)
    if (!proc) return false
    try { proc.resize?.(cols, rows); return true } catch { return false }
  })

  ipcMain.handle('terminal:kill', async (_, id: string) => {
    const proc = terminals.get(id)
    if (proc) {
      try { proc.kill?.() } catch {}
      try { proc.kill?.('SIGTERM') } catch {}
      terminals.delete(id)
    }
    return true
  })

  ipcMain.handle('terminal:getCwd', async () => {
    return process.env.USERPROFILE || process.env.HOME || '/'
  })

  // ── Git handlers ──────────────────────────────────────────────────────────
  function git(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', args, { cwd, windowsHide: true })
      let out = '', err = ''
      proc.stdout.on('data', d => { out += d })
      proc.stderr.on('data', d => { err += d })
      proc.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || out.trim())))
    })
  }

  ipcMain.handle('git:status', async (_, cwd: string) => {
    try {
      const raw = await git(['status', '--porcelain', '-u'], cwd)
      const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd).catch(() => 'HEAD')
      const ahead = await git(['rev-list', '--count', '@{u}..HEAD'], cwd).catch(() => '0')
      const behind = await git(['rev-list', '--count', 'HEAD..@{u}'], cwd).catch(() => '0')
      const files = raw.split('\n').filter(Boolean).map(line => ({
        status: line.slice(0, 2).trim(),
        staged: line[0] !== ' ' && line[0] !== '?',
        path: line.slice(3),
      }))
      return { ok: true, branch, ahead: parseInt(ahead), behind: parseInt(behind), files }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('git:diff', async (_, cwd: string, filePath: string, staged: boolean) => {
    try {
      const args = staged
        ? ['diff', '--cached', '--', filePath]
        : ['diff', '--', filePath]
      const diff = await git(args, cwd)
      return { ok: true, diff }
    } catch (e: any) {
      return { ok: false, diff: '' }
    }
  })

  ipcMain.handle('git:stage', async (_, cwd: string, filePath: string) => {
    try { await git(['add', '--', filePath], cwd); return { ok: true } }
    catch (e: any) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('git:unstage', async (_, cwd: string, filePath: string) => {
    try { await git(['restore', '--staged', '--', filePath], cwd); return { ok: true } }
    catch (e: any) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('git:stageAll', async (_, cwd: string) => {
    try { await git(['add', '-A'], cwd); return { ok: true } }
    catch (e: any) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('git:unstageAll', async (_, cwd: string) => {
    try { await git(['restore', '--staged', '.'], cwd); return { ok: true } }
    catch (e: any) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('git:commit', async (_, cwd: string, message: string) => {
    try { await git(['commit', '-m', message], cwd); return { ok: true } }
    catch (e: any) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('git:push', async (_, cwd: string) => {
    try { const out = await git(['push'], cwd); return { ok: true, output: out } }
    catch (e: any) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('git:pull', async (_, cwd: string) => {
    try { const out = await git(['pull'], cwd); return { ok: true, output: out } }
    catch (e: any) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('git:branches', async (_, cwd: string) => {
    try {
      const raw = await git(['branch', '-a', '--format=%(refname:short)'], cwd)
      const branches = raw.split('\n').filter(Boolean)
      return { ok: true, branches }
    } catch (e: any) { return { ok: false, branches: [] } }
  })

  ipcMain.handle('git:checkout', async (_, cwd: string, branch: string) => {
    try { await git(['checkout', branch], cwd); return { ok: true } }
    catch (e: any) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('git:log', async (_, cwd: string) => {
    try {
      const raw = await git(['log', '--oneline', '-20', '--pretty=format:%H|%s|%an|%ar'], cwd)
      const commits = raw.split('\n').filter(Boolean).map(line => {
        const [hash, subject, author, date] = line.split('|')
        return { hash: hash?.slice(0, 7), subject, author, date }
      })
      return { ok: true, commits }
    } catch (e: any) { return { ok: false, commits: [] } }
  })

  ipcMain.handle('git:discard', async (_, cwd: string, filePath: string) => {
    try { await git(['checkout', '--', filePath], cwd); return { ok: true } }
    catch (e: any) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('git:blame', async (_, cwd: string, filePath: string) => {
    try {
      const out = await git(['blame', '--porcelain', '--', filePath], cwd)
      const result: { line: number; hash: string; author: string; date: string; summary: string }[] = []
      const lines = out.split('\n')
      let cur: any = {}
      for (const line of lines) {
        if (/^[0-9a-f]{40}\s/.test(line)) {
          const parts = line.split(' ')
          cur = { hash: parts[0].slice(0, 7), line: parseInt(parts[2]) }
        } else if (line.startsWith('author '))      cur.author  = line.slice(7).trim()
        else if (line.startsWith('author-time '))   cur.date    = new Date(parseInt(line.slice(12)) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        else if (line.startsWith('summary '))       cur.summary = line.slice(8).trim()
        else if (line.startsWith('\t')) { if (cur.hash) result.push({ ...cur }); cur = {} }
      }
      return { ok: true, lines: result }
    } catch (e: any) { return { ok: false, lines: [] } }
  })

  ipcMain.handle('fs:readBinary', async (_, filePath: string) => {
    try {
      const buf = fs.readFileSync(filePath)
      return { ok: true, base64: buf.toString('base64') }
    } catch (e: any) { return { ok: false, base64: '' } }
  })

  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    await shell.openExternal(url)
  })
}

interface FileNode {
  name: string; path: string; type: 'file' | 'directory'; children?: FileNode[]; ext?: string
}

function readDirRecursive(dirPath: string, depth: number): FileNode[] {
  if (depth < 0) return []
  const items = fs.readdirSync(dirPath, { withFileTypes: true })
  const ignored = new Set(['.git', 'node_modules', '.DS_Store', '__pycache__', '.next', 'dist', 'build', '.venv', 'target', '.cache'])
  return items
    .filter((item) => !ignored.has(item.name))
    .map((item) => {
      const fullPath = path.join(dirPath, item.name)
      if (item.isDirectory()) {
        return {
          name: item.name, path: fullPath, type: 'directory' as const,
          children: depth > 0 ? readDirRecursive(fullPath, depth - 1) : []
        }
      }
      return { name: item.name, path: fullPath, type: 'file' as const, ext: path.extname(item.name).toLowerCase() }
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}
