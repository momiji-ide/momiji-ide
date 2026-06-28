// Shared tool definitions + executor for Kitsune AI's agentic mode.
// Ported from the formerly-unused KitsuneAgent.tsx — gives Kitsune the same
// read/write/search/list/create/delete file tools across Claude, Gemini and
// any OpenAI-compatible provider (Ollama/Groq/OpenRouter/DeepSeek/Mistral/OpenAI).

export const CLAUDE_TOOLS = [
  {
    name: 'read_file',
    description: 'Read the full contents of a file. Use this to understand existing code before editing.',
    input_schema: { type: 'object', properties: { path: { type: 'string', description: 'Absolute or project-relative file path' } }, required: ['path'] }
  },
  {
    name: 'write_file',
    description: 'Write or overwrite a file with new content. Use this to create or edit files.',
    input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string', description: 'Full file content to write' } }, required: ['path', 'content'] }
  },
  {
    name: 'list_directory',
    description: 'List files and folders in a directory to understand project structure.',
    input_schema: { type: 'object', properties: { path: { type: 'string', description: 'Directory path' } }, required: ['path'] }
  },
  {
    name: 'search_in_files',
    description: 'Search for a text/pattern across all files in the project.',
    input_schema: { type: 'object', properties: { query: { type: 'string' }, case_sensitive: { type: 'boolean' } }, required: ['query'] }
  },
  {
    name: 'create_folder',
    description: 'Create a new directory/folder.',
    input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
  },
  {
    name: 'delete_file',
    description: 'Delete a file. Use with caution.',
    input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
  },
  {
    name: 'run_command',
    description: 'Run a shell command in the project directory (e.g. npm install, git status, ls). Returns stdout/stderr.',
    input_schema: { type: 'object', properties: { command: { type: 'string', description: 'The shell command to run' } }, required: ['command'] }
  },
] as const

export const GEMINI_TOOLS = {
  function_declarations: [
    { name: 'read_file',      description: 'Read file contents',         parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } }, required: ['path'] } },
    { name: 'write_file',     description: 'Write content to a file',    parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' }, content: { type: 'STRING' } }, required: ['path', 'content'] } },
    { name: 'list_directory', description: 'List directory contents',    parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } }, required: ['path'] } },
    { name: 'search_in_files',description: 'Search text across files',   parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' }, case_sensitive: { type: 'BOOLEAN' } }, required: ['query'] } },
    { name: 'create_folder',  description: 'Create a folder',            parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } }, required: ['path'] } },
    { name: 'delete_file',    description: 'Delete a file',              parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } }, required: ['path'] } },
    { name: 'run_command',   description: 'Run a shell command',        parameters: { type: 'OBJECT', properties: { command: { type: 'STRING' } }, required: ['command'] } },
  ]
}

// OpenAI-style `tools` array — used for Ollama/Groq/OpenRouter/DeepSeek/Mistral/OpenAI
export const OPENAI_TOOLS = CLAUDE_TOOLS.map(t => ({
  type: 'function' as const,
  function: { name: t.name, description: t.description, parameters: t.input_schema }
}))

export type ToolName = typeof CLAUDE_TOOLS[number]['name']

export interface ToolHooks {
  // Resolves to a result string (e.g. "Written: <path>" or "Skipped by user: <path>")
  onWriteRequest: (path: string, content: string) => Promise<string>
}

// Formats a window.api.fs.readDir() tree as an indented 📁/📄 listing.
export function formatFileTree(nodes: any[], indent = 0): string {
  return nodes.map(n => `${'  '.repeat(indent)}${n.isDirectory ? '📁' : '📄'} ${n.name}${n.children ? '\n' + formatFileTree(n.children, indent + 1) : ''}`).join('\n')
}

export function resolvePath(p: string, currentFolder: string | null): string {
  if (p.startsWith('/') || /^[A-Z]:/i.test(p)) return p
  return `${currentFolder}/${p}`
}

// Large files (full apps/games) sent through the write_file *function call*
// frequently trigger Gemini's MALFORMED_FUNCTION_CALL — the JSON-encoded
// `content` argument is too big/escaped for the model to produce reliably.
// As a fallback, models are instructed (see buildToolsSystemSuffix) to emit
// big files as plain fenced code blocks with a `path=` header in their final
// text reply, which we parse out here and write directly — no function-call
// JSON involved, so arbitrarily large content is fine.
const FILE_BLOCK_RE = /```[ \t]*[\w.-]*[ \t]+path=("?)([^\s"`]+)\1[ \t]*\n([\s\S]*?)```/g

export interface ExtractedFileBlock { path: string; content: string }

export function extractFileBlocks(text: string): { blocks: ExtractedFileBlock[]; cleaned: string } {
  const blocks: ExtractedFileBlock[] = []
  const cleaned = text.replace(FILE_BLOCK_RE, (_m, _q, path, content) => {
    blocks.push({ path, content: content.replace(/\n$/, '') })
    return `\n📄 \`${path}\`\n`
  })
  return { blocks, cleaned: cleaned.trim() }
}

// Executes a single tool call by name, resolving relative paths against currentFolder.
export async function executeTool(
  name: string,
  args: Record<string, any>,
  currentFolder: string | null,
  hooks: ToolHooks
): Promise<string> {
  try {
    if (name === 'read_file') {
      const path = resolvePath(args.path, currentFolder)
      const r = await window.api.fs.readFile(path)
      return r.content !== null ? r.content : `Error: could not read file at ${path}`

    } else if (name === 'write_file') {
      const path = resolvePath(args.path, currentFolder)
      return await hooks.onWriteRequest(path, args.content)

    } else if (name === 'list_directory') {
      const path = args.path === '.' || args.path === './'
        ? currentFolder!
        : resolvePath(args.path, currentFolder)
      const tree = await window.api.fs.readDir(path)
      return tree ? formatFileTree(tree) : `Error: could not read directory`

    } else if (name === 'search_in_files') {
      if (!currentFolder) return 'No folder open'
      const results = await window.api.search.inFiles(currentFolder, args.query, { caseSensitive: args.case_sensitive ?? false, useRegex: false })
      return results?.length
        ? results.slice(0, 20).map((r: any) => `${r.file}:${r.line}: ${r.text.trim()}`).join('\n')
        : 'No matches found'

    } else if (name === 'create_folder') {
      const path = resolvePath(args.path, currentFolder)
      await window.api.fs.createFolder(path)
      return `Created folder: ${path}`

    } else if (name === 'delete_file') {
      const path = resolvePath(args.path, currentFolder)
      await window.api.fs.delete(path)
      return `Deleted: ${path}`

    } else if (name === 'run_command') {
      if (!currentFolder) return 'No folder open — cannot run commands'
      const cmd = args.command as string
      const blocked = ['rm -rf /', 'format ', 'del /s', 'shutdown', 'mkfs']
      if (blocked.some(b => cmd.toLowerCase().includes(b))) return 'Blocked: dangerous command'
      return new Promise<string>(resolve => {
        const id = `kitsune-cmd-${Date.now()}`
        let output = ''
        const offOut = window.api.process.onStdout((pid, data) => { if (pid === id) output += data })
        const offErr = window.api.process.onStderr((pid, data) => { if (pid === id) output += data })
        const offExit = window.api.process.onExit((pid, code) => {
          if (pid !== id) return
          offOut(); offErr(); offExit()
          resolve(output.slice(0, 4000) || `(exit code ${code})`)
        })
        const isWin = navigator.userAgent.includes('Win')
        const shell = isWin ? 'cmd' : 'sh'
        const flag = isWin ? '/c' : '-c'
        window.api.process.run(id, shell, [flag, cmd], currentFolder).catch(err => {
          offOut(); offErr(); offExit()
          resolve(`Error: ${err}`)
        })
        setTimeout(() => { offOut(); offErr(); offExit(); resolve(output.slice(0, 4000) || '(timeout after 30s)') }, 30000)
      })
    }

    return `Unknown tool: ${name}`
  } catch (e: any) {
    return `Error: ${e.message}`
  }
}

// Appended to the system prompt whenever a folder is open — tells the model
// it has tools and must actually use them instead of just describing changes.
export function buildToolsSystemSuffix(currentFolder: string | null): string {
  return `\n\nProject folder: ${currentFolder ?? '(no folder open)'}` +
    `\n\nYou have tools to read, write, search, list, create and delete files in this project. ` +
    `You MUST use them to complete tasks — do not just describe what you'd do, actually do it. ` +
    `Never reply with only a plan or a "I will now write..." statement — always follow through in the SAME response.\n\n` +
    `Workflow:\n1. Use list_directory or search_in_files to understand the project if needed\n` +
    `2. Read relevant files with read_file before editing\n` +
    `3. For SMALL edits (a few lines), use the write_file tool.\n` +
    `4. For LARGE or NEW files (full apps/games/components, roughly 100+ lines), do NOT use write_file — ` +
    `instead, in your final reply, output the complete file content inside a fenced code block whose ` +
    `OPENING fence includes "path=<relative/path/from/project/root>", for example:\n` +
    '```html path=index.html\n<!doctype html>\n<html>...</html>\n```\n' +
    `   The app detects this exact format and writes the file automatically — you can include several ` +
    `such blocks for several files in one reply. Do not wrap them in another code block or add extra ` +
    `text inside the fence besides the file content.\n` +
    `5. Verify with read_file if needed\n` +
    `6. Give a short final summary of what was created/changed\n\n` +
    `Never skip tool calls or file blocks when a file change is requested. Always execute, don't describe.`
}
