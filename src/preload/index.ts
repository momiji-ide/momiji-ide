import { contextBridge, ipcRenderer, webFrame } from 'electron'

const api = {
  zoom: {
    setFactor: (factor: number) => webFrame.setZoomFactor(factor),
    getFactor: () => webFrame.getZoomFactor(),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized')
  },
  dialog: {
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
    openFile: () => ipcRenderer.invoke('dialog:openFile')
  },
  fs: {
    readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
    createFile: (filePath: string) => ipcRenderer.invoke('fs:createFile', filePath),
    createFolder: (folderPath: string) => ipcRenderer.invoke('fs:createFolder', folderPath),
    delete: (targetPath: string) => ipcRenderer.invoke('fs:delete', targetPath),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
    stat: (filePath: string) => ipcRenderer.invoke('fs:stat', filePath),
    watchDir: (dirPath: string) => ipcRenderer.invoke('fs:watchDir', dirPath),
    onDirChanged: (callback: (dirPath: string) => void) => {
      ipcRenderer.on('fs:dirChanged', (_, dirPath) => callback(dirPath))
      return () => ipcRenderer.removeAllListeners('fs:dirChanged')
    }
  },
  http: {
    request: (opts: { method: string; url: string; headers: Record<string, string>; body?: string; timeout?: number }) =>
      ipcRenderer.invoke('http:request', opts)
  },
  editor: {
    onCommand: (callback: (cmd: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, cmd: string) => callback(cmd)
      ipcRenderer.on('editor:command', handler)
      return () => ipcRenderer.removeListener('editor:command', handler)
    }
  },
  search: {
    inFiles: (dirPath: string, query: string, opts: { caseSensitive: boolean; useRegex: boolean }) =>
      ipcRenderer.invoke('fs:searchInFiles', dirPath, query, opts)
  },
  db: {
    exec: (dbPath: string, sql: string) => ipcRenderer.invoke('db:exec', dbPath, sql)
  },
  python: {
    detect: (projectDir?: string) => ipcRenderer.invoke('python:detect', projectDir)
  },
  lint: {
    python: (filePath: string, pythonPath: string) => ipcRenderer.invoke('lint:python', filePath, pythonPath)
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  },
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    install: () => ipcRenderer.invoke('updater:install'),
    onStatus: (callback: (status: string, info?: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, status: string, info?: string) => callback(status, info)
      ipcRenderer.on('updater:status', handler)
      return () => ipcRenderer.removeListener('updater:status', handler)
    }
  },
  process: {
    run: (id: string, command: string, args: string[], cwd?: string) =>
      ipcRenderer.invoke('process:run', id, command, args, cwd),
    stdin: (id: string, input: string) => ipcRenderer.invoke('process:stdin', id, input),
    kill: (id: string) => ipcRenderer.invoke('process:kill', id),
    isRunning: (id: string) => ipcRenderer.invoke('process:isRunning', id),
    onStdout: (callback: (id: string, data: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, id: string, data: string) => callback(id, data)
      ipcRenderer.on('process:stdout', handler)
      return () => ipcRenderer.removeListener('process:stdout', handler)
    },
    onStderr: (callback: (id: string, data: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, id: string, data: string) => callback(id, data)
      ipcRenderer.on('process:stderr', handler)
      return () => ipcRenderer.removeListener('process:stderr', handler)
    },
    onExit: (callback: (id: string, code: number) => void) => {
      const handler = (_: Electron.IpcRendererEvent, id: string, code: number) => callback(id, code)
      ipcRenderer.on('process:exit', handler)
      return () => ipcRenderer.removeListener('process:exit', handler)
    }
  },
  git: {
    status:     (cwd: string)                       => ipcRenderer.invoke('git:status',     cwd),
    diff:       (cwd: string, file: string, staged: boolean) => ipcRenderer.invoke('git:diff', cwd, file, staged),
    stage:      (cwd: string, file: string)         => ipcRenderer.invoke('git:stage',      cwd, file),
    unstage:    (cwd: string, file: string)         => ipcRenderer.invoke('git:unstage',    cwd, file),
    stageAll:   (cwd: string)                       => ipcRenderer.invoke('git:stageAll',   cwd),
    unstageAll: (cwd: string)                       => ipcRenderer.invoke('git:unstageAll', cwd),
    commit:     (cwd: string, message: string)      => ipcRenderer.invoke('git:commit',     cwd, message),
    push:       (cwd: string)                       => ipcRenderer.invoke('git:push',       cwd),
    pull:       (cwd: string)                       => ipcRenderer.invoke('git:pull',       cwd),
    branches:   (cwd: string)                       => ipcRenderer.invoke('git:branches',   cwd),
    checkout:   (cwd: string, branch: string)       => ipcRenderer.invoke('git:checkout',   cwd, branch),
    log:        (cwd: string)                       => ipcRenderer.invoke('git:log',        cwd),
    discard:    (cwd: string, file: string)         => ipcRenderer.invoke('git:discard',    cwd, file),
  },
  terminal: {
    create: (id: string, cwd?: string) => ipcRenderer.invoke('terminal:create', id, cwd),
    write: (id: string, data: string) => ipcRenderer.invoke('terminal:write', id, data),
    kill: (id: string) => ipcRenderer.invoke('terminal:kill', id),
    resize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
    getCwd: () => ipcRenderer.invoke('terminal:getCwd'),
    onData: (callback: (id: string, data: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, id: string, data: string) => callback(id, data)
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    },
    onExit: (callback: (id: string, code: number) => void) => {
      const handler = (_: Electron.IpcRendererEvent, id: string, code: number) => callback(id, code)
      ipcRenderer.on('terminal:exit', handler)
      return () => ipcRenderer.removeListener('terminal:exit', handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
export type ElectronAPI = typeof api
