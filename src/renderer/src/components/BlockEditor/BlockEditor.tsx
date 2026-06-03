import { useEffect, useRef, useState, useCallback } from 'react'
import * as Blockly from 'blockly'
import { javascriptGenerator } from 'blockly/javascript'
import { pythonGenerator } from 'blockly/python'
import MonacoEditor from '@monaco-editor/react'
import { useAppStore } from '../../store/appStore'
import { toast } from '../../utils/toast'
import { codeToBlocklyXML } from '../../utils/codeToBlockly'
import { RobotSimulator } from './RobotSimulator'
import { HardwareExportPanel } from './HardwareExportPanel'

// ─── Fix Blockly JS generators so they work in Node.js (not browser-only) ────
// Default text_print generates window.alert() — crashes in Node.
// text_print uses input "TEXT" (confirmed from Blockly 12.x source)
;(javascriptGenerator as any).forBlock['text_print'] = function(block: any, gen: any) {
  try {
    const val = gen.valueToCode(block, 'TEXT', 0) || "''"
    return `console.log(${val});\n`
  } catch {
    return `console.log('');\n`
  }
}
// text_prompt_ext generates window.prompt() — stub for Node.js
;(javascriptGenerator as any).forBlock['text_prompt_ext'] = function(block: any, _gen: any) {
  try {
    const hasField = block.getField('TEXT')
    const msg = hasField
      ? JSON.stringify(block.getFieldValue('TEXT') || '')
      : "'Enter value: '"
    return [`(function(){process.stdout && process.stdout.write(${msg} + ' '); return ''})()`, 0]
  } catch {
    return [`''`, 0]
  }
}
// text_prompt (legacy) — same stub
;(javascriptGenerator as any).forBlock['text_prompt'] = function(block: any, _gen: any) {
  try {
    const msg = JSON.stringify(block.getFieldValue('TEXT') || '')
    return [`(function(){process.stdout && process.stdout.write(${msg} + ' '); return ''})()`, 0]
  } catch {
    return [`''`, 0]
  }
}

// ─── Custom STEM & Robotics Blocks ───────────────────────────────────────────
Blockly.Blocks['robot_move'] = {
  init: function(this: Blockly.Block) {
    this.appendDummyInput()
        .appendField("🤖 Robot Move")
        .appendField(new Blockly.FieldDropdown([
          ["forward ⬆️", "FORWARD"],
          ["backward ⬇️", "BACKWARD"],
          ["turn left ⬅️", "LEFT"],
          ["turn right ➡️", "RIGHT"],
          ["stop 🛑", "STOP"]
        ]), "DIRECTION")
        .appendField("speed")
        .appendField(new Blockly.FieldNumber(80, 0, 100), "SPEED")
        .appendField("%")
    this.setPreviousStatement(true, null)
    this.setNextStatement(true, null)
    this.setColour('#e85d04')
    this.setTooltip("Control the robot's movement direction and speed.")
  }
}

Blockly.Blocks['robot_led'] = {
  init: function(this: Blockly.Block) {
    this.appendDummyInput()
        .appendField("💡 Set Robot LED")
        .appendField(new Blockly.FieldDropdown([
          ["red 🔴", "RED"],
          ["green 🟢", "GREEN"],
          ["blue 🔵", "BLUE"],
          ["orange 🟠", "ORANGE"],
          ["off ⚪", "OFF"]
        ]), "COLOR")
    this.setPreviousStatement(true, null)
    this.setNextStatement(true, null)
    this.setColour('#e85d04')
    this.setTooltip("Set the color of the robot's onboard LED.")
  }
}

Blockly.Blocks['robot_sensor'] = {
  init: function(this: Blockly.Block) {
    this.appendDummyInput()
        .appendField("👁️ Read Sensor")
        .appendField(new Blockly.FieldDropdown([
          ["ultrasonic distance 📏", "ultrasonic"],
          ["line tracker left ⬅️", "line_left"],
          ["line tracker right ➡️", "line_right"],
          ["light sensor ☀️", "light"],
          ["temperature sensor 🌡️", "temperature"]
        ]), "SENSOR")
    this.setOutput(true, null)
    this.setColour('#e85d04')
    this.setTooltip("Read data from the robot's sensors.")
  }
}

Blockly.Blocks['robot_tone'] = {
  init: function(this: Blockly.Block) {
    this.appendDummyInput()
        .appendField("🎵 Play Tone")
        .appendField("freq")
        .appendField(new Blockly.FieldNumber(440, 20, 20000), "FREQ")
        .appendField("Hz for")
        .appendField(new Blockly.FieldNumber(500, 10, 5000), "DURATION")
        .appendField("ms")
    this.setPreviousStatement(true, null)
    this.setNextStatement(true, null)
    this.setColour('#e85d04')
    this.setTooltip("Play a tone at a specific frequency (Hz) for a duration (ms).")
  }
}

Blockly.Blocks['robot_sleep'] = {
  init: function(this: Blockly.Block) {
    this.appendDummyInput()
        .appendField("⏳ Robot Sleep")
        .appendField(new Blockly.FieldNumber(1, 0.01, 60), "SECONDS")
        .appendField("sec")
    this.setPreviousStatement(true, null)
    this.setNextStatement(true, null)
    this.setColour('#e85d04')
    this.setTooltip("Pause robot operations for a given number of seconds.")
  }
}

Blockly.Blocks['robot_show_text'] = {
  init: function(this: Blockly.Block) {
    this.appendDummyInput()
        .appendField("📺 Display Text")
        .appendField(new Blockly.FieldTextInput("Hello"), "TEXT")
        .appendField("at x")
        .appendField(new Blockly.FieldNumber(0, 0, 128), "X")
        .appendField("y")
        .appendField(new Blockly.FieldNumber(0, 0, 64), "Y")
    this.setPreviousStatement(true, null)
    this.setNextStatement(true, null)
    this.setColour('#e85d04')
    this.setTooltip("Display text on the robot's OLED screen at specific coordinates.")
  }
}

Blockly.Blocks['robot_clear_screen'] = {
  init: function(this: Blockly.Block) {
    this.appendDummyInput()
        .appendField("📺 Clear Screen")
    this.setPreviousStatement(true, null)
    this.setNextStatement(true, null)
    this.setColour('#e85d04')
    this.setTooltip("Clear the robot's OLED screen.")
  }
}

Blockly.Blocks['robot_button'] = {
  init: function(this: Blockly.Block) {
    this.appendDummyInput()
        .appendField("🔘 Button")
        .appendField(new Blockly.FieldDropdown([
          ["A", "A"],
          ["B", "B"]
        ]), "BUTTON")
        .appendField("is pressed?")
    this.setOutput(true, null)
    this.setColour('#e85d04')
    this.setTooltip("Check if button A or B is currently pressed on the robot.")
  }
}

Blockly.Blocks['robot_servo'] = {
  init: function(this: Blockly.Block) {
    this.appendDummyInput()
        .appendField("🦾 Set Servo Pin")
        .appendField(new Blockly.FieldDropdown([
          ["P0", "P0"],
          ["P1", "P1"],
          ["P2", "P2"],
          ["P8", "P8"],
          ["P12", "P12"]
        ]), "PIN")
        .appendField("to angle")
        .appendField(new Blockly.FieldNumber(90, 0, 180), "ANGLE")
        .appendField("°")
    this.setPreviousStatement(true, null)
    this.setNextStatement(true, null)
    this.setColour('#e85d04')
    this.setTooltip("Set the angle of a servo motor connected to a specific pin.")
  }
}

// JS Generators
;(javascriptGenerator as any).forBlock['robot_move'] = function(block: any, _gen: any) {
  const dir = block.getFieldValue('DIRECTION')
  const speed = block.getFieldValue('SPEED')
  return `robot.move("${dir}", ${speed});\n`
}
;(javascriptGenerator as any).forBlock['robot_led'] = function(block: any, _gen: any) {
  const color = block.getFieldValue('COLOR')
  return `robot.setLed("${color}");\n`
}
;(javascriptGenerator as any).forBlock['robot_sensor'] = function(block: any, _gen: any) {
  const sensor = block.getFieldValue('SENSOR')
  return [`robot.readSensor("${sensor}")`, 0]
}
;(javascriptGenerator as any).forBlock['robot_tone'] = function(block: any, _gen: any) {
  const freq = block.getFieldValue('FREQ')
  const dur = block.getFieldValue('DURATION')
  return `robot.playTone(${freq}, ${dur});\n`
}
;(javascriptGenerator as any).forBlock['robot_sleep'] = function(block: any, _gen: any) {
  const sec = block.getFieldValue('SECONDS')
  return `robot.sleep(${sec});\n`
}
;(javascriptGenerator as any).forBlock['robot_show_text'] = function(block: any, _gen: any) {
  const text = block.getFieldValue('TEXT')
  const x = block.getFieldValue('X')
  const y = block.getFieldValue('Y')
  return `robot.showText("${text}", ${x}, ${y});\n`
}
;(javascriptGenerator as any).forBlock['robot_clear_screen'] = function(block: any, _gen: any) {
  return `robot.clearScreen();\n`
}
;(javascriptGenerator as any).forBlock['robot_button'] = function(block: any, _gen: any) {
  const btn = block.getFieldValue('BUTTON')
  return [`robot.isButtonPressed("${btn}")`, 0]
}
;(javascriptGenerator as any).forBlock['robot_servo'] = function(block: any, _gen: any) {
  const pin = block.getFieldValue('PIN')
  const angle = block.getFieldValue('ANGLE')
  return `robot.setServo("${pin}", ${angle});\n`
}

// Python Generators
;(pythonGenerator as any).forBlock['robot_move'] = function(block: any, _gen: any) {
  const dir = block.getFieldValue('DIRECTION')
  const speed = block.getFieldValue('SPEED')
  return `robot.move("${dir}", ${speed})\n`
}
;(pythonGenerator as any).forBlock['robot_led'] = function(block: any, _gen: any) {
  const color = block.getFieldValue('COLOR')
  return `robot.setLed("${color}")\n`
}
;(pythonGenerator as any).forBlock['robot_sensor'] = function(block: any, _gen: any) {
  const sensor = block.getFieldValue('SENSOR')
  return [`robot.readSensor("${sensor}")`, 0]
}
;(pythonGenerator as any).forBlock['robot_tone'] = function(block: any, _gen: any) {
  const freq = block.getFieldValue('FREQ')
  const dur = block.getFieldValue('DURATION')
  return `robot.playTone(${freq}, ${dur})\n`
}
;(pythonGenerator as any).forBlock['robot_sleep'] = function(block: any, _gen: any) {
  const sec = block.getFieldValue('SECONDS')
  return `robot.sleep(${sec})\n`
}
;(pythonGenerator as any).forBlock['robot_show_text'] = function(block: any, _gen: any) {
  const text = block.getFieldValue('TEXT')
  const x = block.getFieldValue('X')
  const y = block.getFieldValue('Y')
  return `robot.showText("${text}", ${x}, ${y})\n`
}
;(pythonGenerator as any).forBlock['robot_clear_screen'] = function(block: any, _gen: any) {
  return `robot.clearScreen()\n`
}
;(pythonGenerator as any).forBlock['robot_button'] = function(block: any, _gen: any) {
  const btn = block.getFieldValue('BUTTON')
  return [`robot.isButtonPressed("${btn}")`, 0]
}
;(pythonGenerator as any).forBlock['robot_servo'] = function(block: any, _gen: any) {
  const pin = block.getFieldValue('PIN')
  const angle = block.getFieldValue('ANGLE')
  return `robot.setServo("${pin}", ${angle})\n`
}

// Arduino C++ Generators
const arduinoGenerator = new (Blockly.Generator as any)('ARDUINO')
;(arduinoGenerator as any).PRECEDENCE = 0
;(arduinoGenerator as any).init = function(workspace: Blockly.Workspace) {
  this.definitions_ = Object.create(null);
  
  // Find all variables in the workspace and declare them globally
  const variables = workspace.getAllVariables();
  const declarations = variables.map(v => `double ${v.name} = 0;`).join('\n');
  if (declarations) {
    this.definitions_['variables'] = declarations;
  }
}
;(arduinoGenerator as any).finish = function(code: string) {
  const defs = [];
  for (const name in this.definitions_) {
    defs.push(this.definitions_[name]);
  }
  return `// Momiji IDE — Generated Arduino Sketch 🍁\n` +
         `#include <Servo.h>\n\n` +
         (defs.length ? defs.join('\n') + '\n\n' : '') +
         `void setup() {\n` +
         `  Serial.begin(9600);\n` +
         `  // Initialize components here\n` +
         `}\n\n` +
         `void loop() {\n` +
         code.split('\n').map(line => line ? '  ' + line : '').join('\n') + '\n' +
         `}\n`;
}
;(arduinoGenerator as any).scrub_ = function(block: Blockly.Block, code: string, thisOnly: boolean) {
  const nextBlock = block.nextConnection && block.nextConnection.targetBlock()
  const nextCode = (thisOnly || !nextBlock) ? '' : (arduinoGenerator as any).blockToCode(nextBlock)
  return code + nextCode
}
;(arduinoGenerator as any).valueToCode = function(block: Blockly.Block, name: string, _prec: number) {
  const targetBlock = block.getInputTargetBlock(name)
  if (!targetBlock) return ''
  const code = (arduinoGenerator as any).blockToCode(targetBlock)
  return code
}
;(arduinoGenerator as any).statementToCode = function(block: Blockly.Block, name: string) {
  const targetBlock = block.getInputTargetBlock(name)
  let code = (arduinoGenerator as any).blockToCode(targetBlock)
  if (typeof code === 'string') {
    return code.split('\n').map(line => '  ' + line).join('\n')
  }
  return ''
}

;(arduinoGenerator as any).forBlock['robot_move'] = function(block: any, _gen: any) {
  const dir = block.getFieldValue('DIRECTION')
  const speed = block.getFieldValue('SPEED')
  return `robot.move("${dir}", ${speed});\n`
}
;(arduinoGenerator as any).forBlock['robot_led'] = function(block: any, _gen: any) {
  const color = block.getFieldValue('COLOR')
  return `robot.setLed("${color}");\n`
}
;(arduinoGenerator as any).forBlock['robot_sensor'] = function(block: any, _gen: any) {
  const sensor = block.getFieldValue('SENSOR')
  return [`robot.readSensor("${sensor}")`, 0]
}
;(arduinoGenerator as any).forBlock['robot_tone'] = function(block: any, _gen: any) {
  const freq = block.getFieldValue('FREQ')
  const dur = block.getFieldValue('DURATION')
  return `robot.playTone(${freq}, ${dur});\n`
}
;(arduinoGenerator as any).forBlock['robot_sleep'] = function(block: any, _gen: any) {
  const sec = block.getFieldValue('SECONDS')
  return `robot.sleep(${sec});\n`
}
;(arduinoGenerator as any).forBlock['robot_show_text'] = function(block: any, _gen: any) {
  const text = block.getFieldValue('TEXT')
  const x = block.getFieldValue('X')
  const y = block.getFieldValue('Y')
  return `robot.showText("${text}", ${x}, ${y});\n`
}
;(arduinoGenerator as any).forBlock['robot_clear_screen'] = function(block: any, _gen: any) {
  return `robot.clearScreen();\n`
}
;(arduinoGenerator as any).forBlock['robot_button'] = function(block: any, _gen: any) {
  const btn = block.getFieldValue('BUTTON')
  return [`robot.isButtonPressed("${btn}")`, 0]
}
;(arduinoGenerator as any).forBlock['robot_servo'] = function(block: any, _gen: any) {
  const pin = block.getFieldValue('PIN')
  const angle = block.getFieldValue('ANGLE')
  return `robot.setServo("${pin}", ${angle});\n`
}

;(arduinoGenerator as any).forBlock['controls_repeat_ext'] = function(block: any, _gen: any) {
  const times = (arduinoGenerator as any).valueToCode(block, 'TIMES', 0) || '0'
  const branch = (arduinoGenerator as any).statementToCode(block, 'DO') || ''
  return `for (int i = 0; i < ${times}; i++) {\n${branch}}\n`
}
;(arduinoGenerator as any).forBlock['controls_whileUntil'] = function(block: any, _gen: any) {
  const cond = (arduinoGenerator as any).valueToCode(block, 'BOOL', 0) || 'true'
  const branch = (arduinoGenerator as any).statementToCode(block, 'DO') || ''
  return `while (${cond}) {\n${branch}}\n`
}
;(arduinoGenerator as any).forBlock['controls_if'] = function(block: any, _gen: any) {
  const cond = (arduinoGenerator as any).valueToCode(block, 'IF0', 0) || 'false'
  const branch = (arduinoGenerator as any).statementToCode(block, 'DO0') || ''
  const elseBranch = (arduinoGenerator as any).statementToCode(block, 'ELSE') || ''
  let code = `if (${cond}) {\n${branch}}`
  if (elseBranch) code += ` else {\n${elseBranch}}`
  return code + '\n'
}
;(arduinoGenerator as any).forBlock['controls_ifelse'] = function(block: any, _gen: any) {
  const cond = (arduinoGenerator as any).valueToCode(block, 'IF0', 0) || 'false'
  const branch = (arduinoGenerator as any).statementToCode(block, 'DO0') || ''
  const elseBranch = (arduinoGenerator as any).statementToCode(block, 'ELSE') || ''
  return `if (${cond}) {\n${branch}} else {\n${elseBranch}}\n`
}
;(arduinoGenerator as any).forBlock['logic_compare'] = function(block: any, _gen: any) {
  const op = block.getFieldValue('OP')
  const a = (arduinoGenerator as any).valueToCode(block, 'A', 0) || '0'
  const b = (arduinoGenerator as any).valueToCode(block, 'B', 0) || '0'
  const opMap: Record<string, string> = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }
  return [`(${a} ${opMap[op] || '=='} ${b})`, 0]
}
;(arduinoGenerator as any).forBlock['logic_operation'] = function(block: any, _gen: any) {
  const op = block.getFieldValue('OP')
  const a = (arduinoGenerator as any).valueToCode(block, 'A', 0) || 'false'
  const b = (arduinoGenerator as any).valueToCode(block, 'B', 0) || 'false'
  return [`(${a} ${op === 'AND' ? '&&' : '||'} ${b})`, 0]
}
;(arduinoGenerator as any).forBlock['logic_negate'] = function(block: any, _gen: any) {
  const val = (arduinoGenerator as any).valueToCode(block, 'BOOL', 0) || 'false'
  return [`!(${val})`, 0]
}
;(arduinoGenerator as any).forBlock['logic_boolean'] = function(block: any, _gen: any) {
  const val = block.getFieldValue('BOOL')
  return [val === 'TRUE' ? 'true' : 'false', 0]
}
;(arduinoGenerator as any).forBlock['math_number'] = function(block: any, _gen: any) {
  return [block.getFieldValue('NUM'), 0]
}
;(arduinoGenerator as any).forBlock['math_arithmetic'] = function(block: any, _gen: any) {
  const op = block.getFieldValue('OP')
  const a = (arduinoGenerator as any).valueToCode(block, 'A', 0) || '0'
  const b = (arduinoGenerator as any).valueToCode(block, 'B', 0) || '0'
  const opMap: Record<string, string> = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/', POWER: '^' }
  return [`(${a} ${opMap[op] || '+'} ${b})`, 0]
}
;(arduinoGenerator as any).forBlock['variables_get'] = function(block: any, _gen: any) {
  const varName = block.getField('VAR') ? block.getFieldValue('VAR') : 'x'
  return [varName, 0]
}
;(arduinoGenerator as any).forBlock['variables_set'] = function(block: any, _gen: any) {
  const varName = block.getField('VAR') ? block.getFieldValue('VAR') : 'x'
  const val = (arduinoGenerator as any).valueToCode(block, 'VALUE', 0) || '0'
  return `${varName} = ${val};\n`
}
;(arduinoGenerator as any).forBlock['text'] = function(block: any, _gen: any) {
  const txt = block.getFieldValue('TEXT') || ''
  return [`"${txt}"`, 0]
}

type RunLine    = { id: number; text: string; type: 'out' | 'err' | 'sys' }
type Lang       = 'javascript' | 'python' | 'arduino'
type SyncMode   = 'blocks-primary' | 'code-primary' | 'bidirectional'
type Level      = 'beginner' | 'intermediate' | 'advanced'

export function BlockEditor() {
  const containerRef  = useRef<HTMLDivElement>(null)
  const splitWrapRef  = useRef<HTMLDivElement>(null)
  const workspaceRef  = useRef<Blockly.WorkspaceSvg | null>(null)
  const { settings, openTab, aiProviders, toggleBottomPanel, showBottomPanel, currentFolder, showSidebar, toggleSidebar } = useAppStore()

  const [code, setCode]         = useState('// Drag blocks from the toolbox to generate code\n')
  const [isPaused, setIsPaused] = useState(false)
  const [lang, setLang]         = useState<Lang>('javascript')
  const [syncMode, setSyncMode] = useState<SyncMode>('code-primary')
  const [blockCount, setBlockCount] = useState(0)
  const [ready, setReady]       = useState(false)
  const [level, setLevel]       = useState<Level>('beginner')
  const [showTemplates, setShowTemplates] = useState(false)
  const [splitRatio, setSplitRatio] = useState(55)    // % width for Blockly panel
  const [aiConverting, setAiConverting] = useState(false)
  const [codeChanged, setCodeChanged]   = useState(false)  // code diverged from blocks
  const [syncCoverage, setSyncCoverage] = useState(1)      // 0-1 coverage of last sync
  const [syncing, setSyncing]           = useState(false)

  // ─── Inline run output ────────────────────────────────────────────
  const [runLines, setRunLines]         = useState<RunLine[]>([])
  const [runStatus, setRunStatus]       = useState<'idle'|'running'|'done'|'error'>('idle')
  const [runElapsed, setRunElapsed]     = useState<number|null>(null)
  const [showRunOutput, setShowRunOutput] = useState(false)
  const [showArena, setShowArena]           = useState(false)
  const [showExport, setShowExport]         = useState(false)
  type RightPanel = 'code' | 'arena' | 'export'
  const rightPanel: RightPanel = showExport ? 'export' : showArena ? 'arena' : 'code'
  const runStartTime = useRef(0)
  const runTimer     = useRef<ReturnType<typeof setInterval>|null>(null)
  const runOutputRef = useRef<HTMLDivElement>(null)
  const runLineId    = useRef(0)

  const codeRef = useRef(code)          // latest code without closure stale
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blockGenRef = useRef(false)     // true when code was just generated by blocks (ignore onChange)

  const monacoTheme = settings.theme === 'dark' ? 'momiji-dark' : 'momiji-light'

  // ─── Generate code from workspace ──────────────────────────────────
  const generateCode = useCallback((): string => {
    if (!workspaceRef.current) return ''
    try {
      if (lang === 'javascript') {
        return javascriptGenerator.workspaceToCode(workspaceRef.current)
      } else if (lang === 'python') {
        return pythonGenerator.workspaceToCode(workspaceRef.current)
      } else if (lang === 'arduino') {
        return (arduinoGenerator as any).workspaceToCode(workspaceRef.current)
      }
      return ''
    } catch {
      return ''
    }
  }, [lang])

  // ─── Init workspace ─────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    // Dispose old workspace
    workspaceRef.current?.dispose()

    const theme = Blockly.Theme.defineTheme('momiji', {
      base: Blockly.Themes.Classic,
      blockStyles: {
        logic_blocks:     { colourPrimary: '#89b4fa', colourSecondary: '#74c7ec', colourTertiary: '#45475a' },
        loop_blocks:      { colourPrimary: '#a6e3a1', colourSecondary: '#94e2d5', colourTertiary: '#45475a' },
        math_blocks:      { colourPrimary: '#fab387', colourSecondary: '#f9e2af', colourTertiary: '#45475a' },
        text_blocks:      { colourPrimary: '#cba6f7', colourSecondary: '#f5c2e7', colourTertiary: '#45475a' },
        list_blocks:      { colourPrimary: '#94e2d5', colourSecondary: '#89dceb', colourTertiary: '#45475a' },
        colour_blocks:    { colourPrimary: '#f38ba8', colourSecondary: '#eba0ac', colourTertiary: '#45475a' },
        variable_blocks:  { colourPrimary: '#f38ba8', colourSecondary: '#eba0ac', colourTertiary: '#45475a' },
        variable_dynamic_blocks: { colourPrimary: '#f38ba8', colourSecondary: '#eba0ac', colourTertiary: '#45475a' },
        procedure_blocks: { colourPrimary: '#b4befe', colourSecondary: '#cba6f7', colourTertiary: '#45475a' }
      },
      categoryStyles: {
        logic_category:     { colour: '#89b4fa' },
        loop_category:      { colour: '#a6e3a1' },
        math_category:      { colour: '#fab387' },
        text_category:      { colour: '#cba6f7' },
        list_category:      { colour: '#94e2d5' },
        colour_category:    { colour: '#f38ba8' },
        variable_category:  { colour: '#f38ba8' },
        procedure_category: { colour: '#b4befe' }
      },
      componentStyles: {
        workspaceBackgroundColour: '#1e1e2e',
        toolboxBackgroundColour:   '#181825',
        toolboxForegroundColour:   '#cdd6f4',
        flyoutBackgroundColour:    '#181825',
        flyoutForegroundColour:    '#cdd6f4',
        flyoutOpacity:             1,
        scrollbarColour:           '#45475a',
        scrollbarOpacity:          0.7,
        insertionMarkerColour:     '#89b4fa',
        insertionMarkerOpacity:    0.5,
        markerColour:              '#89b4fa',
        cursorColour:              '#89b4fa'
      }
    })

    const ws = Blockly.inject(containerRef.current, {
      toolbox: TOOLBOX_BEGINNER,
      theme,
      grid:    { spacing: 24, length: 4, colour: '#313244', snap: true },
      zoom:    { controls: true, wheel: true, startScale: 1.0, maxScale: 2.5, minScale: 0.4, scaleSpeed: 1.2 },
      trashcan: true,
      sounds:   false,
      move:    { scrollbars: { horizontal: true, vertical: true }, drag: true, wheel: true }
    })

    workspaceRef.current = ws
    setReady(true)

    const MEANINGFUL = new Set(['create', 'delete', 'change', 'move', 'endDrag'])
    ws.addChangeListener((e: Blockly.Events.Abstract) => {
      if (!MEANINGFUL.has(e.type)) return
      setBlockCount(ws.getAllBlocks(false).length)
      setSyncMode((current) => {
        // Always update code when blocks change (except when user is manually editing code)
        // In code-primary, we still reflect block changes but mark as block-generated
        let gen = '// Drag blocks from the toolbox to generate code\n'
        if (ws.getAllBlocks(false).length > 0) {
          if (lang === 'javascript') {
            gen = javascriptGenerator.workspaceToCode(ws)
          } else if (lang === 'python') {
            gen = pythonGenerator.workspaceToCode(ws)
          } else if (lang === 'arduino') {
            gen = (arduinoGenerator as any).workspaceToCode(ws)
          }
        }
        const newCode = gen || '// Add blocks to generate code\n'
        blockGenRef.current = true  // mark: code came from blocks, not user typing
        setCode(newCode)
        codeRef.current = newCode
        setCodeChanged(false)
        setTimeout(() => { blockGenRef.current = false }, 50)
        return current
      })
    })

    return () => { ws.dispose(); workspaceRef.current = null; setReady(false) }
  }, []) // Only run once on mount

  // Regenerate when language changes
  useEffect(() => {
    if (!ready) return
    const gen = generateCode()
    if (gen) setCode(gen)
  }, [lang, ready, generateCode])

  // Update toolbox when level changes
  useEffect(() => {
    if (!ready || !workspaceRef.current) return
    const toolboxMap = { beginner: TOOLBOX_BEGINNER, intermediate: TOOLBOX_INTERMEDIATE, advanced: TOOLBOX }
    workspaceRef.current.updateToolbox(toolboxMap[level] as any)
  }, [level, ready])

  // Resize observer
  useEffect(() => {
    if (!ready || !containerRef.current) return
    const obs = new ResizeObserver(() => {
      if (workspaceRef.current) Blockly.svgResize(workspaceRef.current)
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [ready])

  // ─── Inline run output listeners ─────────────────────────────────
  useEffect(() => {
    const addLine = (text: string, type: RunLine['type']) => {
      text.split('\n').filter(l => l !== '').forEach(t => {
        setRunLines(prev => [...prev, { id: runLineId.current++, text: t, type }])
      })
    }
    const onStart = (e: CustomEvent) => {
      if (e.detail?.processId !== 'runner-main') return
      setRunLines([]); setRunStatus('running'); setRunElapsed(null); setShowRunOutput(true)
      runStartTime.current = Date.now()
      if (runTimer.current) clearInterval(runTimer.current)
      runTimer.current = setInterval(() => setRunElapsed(Date.now() - runStartTime.current), 200)
    }
    const offOut  = window.api.process.onStdout((id, data) => { if (id === 'runner-main') addLine(data, 'out') })
    const offErr  = window.api.process.onStderr((id, data) => { if (id === 'runner-main') addLine(data, 'err') })
    const offExit = window.api.process.onExit((id, code) => {
      if (id !== 'runner-main') return
      if (runTimer.current) clearInterval(runTimer.current)
      const ms = Date.now() - runStartTime.current
      setRunElapsed(ms); setRunStatus(code === 0 ? 'done' : 'error')
      addLine(code === 0 ? `✓ Done in ${(ms/1000).toFixed(2)}s` : `✗ Exit code ${code} (${(ms/1000).toFixed(2)}s)`, 'sys')
    })
    window.addEventListener('runner:start', onStart as EventListener)
    return () => { window.removeEventListener('runner:start', onStart as EventListener); offOut(); offErr(); offExit() }
  }, [])

  // Auto-scroll run output
  useEffect(() => { runOutputRef.current?.scrollIntoView({ behavior: 'auto' }) }, [runLines])

  // ─── Actions ─────────────────────────────────────────────────────
  const handleClear = () => {
    workspaceRef.current?.clear()
    setCode('// Drag blocks from the toolbox to generate code\n')
    setBlockCount(0)
    toast.info('Workspace cleared')
  }

  const handleSave = () => {
    if (!workspaceRef.current) return
    try {
      const state = Blockly.serialization.workspaces.save(workspaceRef.current)
      localStorage.setItem('momiji:blockly:workspace', JSON.stringify(state))
      toast.success('Workspace saved!')
    } catch { toast.error('Failed to save') }
  }

  const handleLoad = () => {
    const raw = localStorage.getItem('momiji:blockly:workspace')
    if (!raw || !workspaceRef.current) { toast.warning('No saved workspace found'); return }
    try {
      Blockly.serialization.workspaces.load(JSON.parse(raw), workspaceRef.current)
      toast.success('Workspace loaded!')
    } catch { toast.error('Failed to load workspace') }
  }

  const handleOpenInEditor = () => {
    if (!code.trim() || code.startsWith('//')) { toast.warning('Add some blocks first!'); return }
    const ext = lang === 'python' ? 'py' : 'js'
    const name = `blocks_output.${ext}`
    openTab(`__blocks__/${name}`, name, code)
    toast.success(`Opened as ${name}`)
  }

  const handleToggleSync = () => {
    if (syncMode === 'blocks-primary') {
      setSyncMode('code-primary')
      toast.info('✏️ Code mode: edit freely, click ↑ Sync to update blocks')
    } else if (syncMode === 'code-primary') {
      setSyncMode('bidirectional')
      toast.info('⟳ Bidirectional: code changes auto-sync to blocks (debounced)')
    } else {
      setSyncMode('blocks-primary')
      const gen = generateCode()
      if (gen) setCode(gen)
      toast.info('⟳ Live: blocks control the code output')
    }
  }

  // ─── Code → Blocks sync ───────────────────────────────────────────
  const syncCodeToBlocks = useCallback((src: string) => {
    if (lang !== 'javascript') {
      toast.warning('Block sync is JS-only in V1. Python coming soon!')
      return
    }
    const ws = workspaceRef.current
    if (!ws) return

    setSyncing(true)
    const result = codeToBlocklyXML(src)
    setSyncCoverage(result.coverage)

    try {
      ws.clear()
      const dom = Blockly.utils.xml.textToDom(result.xml)
      Blockly.Xml.domToWorkspace(dom, ws)
      setBlockCount(ws.getAllBlocks(false).length)
      setCodeChanged(false)

      if (result.advanced.length > 0) {
        toast.info(`🟡 ${result.blocks} blocks synced — ${result.advanced.length} advanced pattern(s) skipped`)
      } else if (result.blocks === 0) {
        toast.warning('No block-compatible patterns found. Try simpler code.')
      } else {
        toast.success(`✓ ${result.blocks} blocks synced from code!`)
      }
    } catch (err: any) {
      toast.error('Sync error: ' + (err.message ?? 'invalid XML'))
    } finally {
      setSyncing(false)
    }
  }, [lang])

  // Auto-sync in bidirectional mode
  const handleCodeChange = useCallback((newCode: string) => {
    if (blockGenRef.current) return  // ignore code generated by blocks
    codeRef.current = newCode
    setCode(newCode)
    setCodeChanged(true)

    if (syncMode === 'bidirectional') {
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current)
      syncDebounceRef.current = setTimeout(() => {
        syncCodeToBlocks(codeRef.current)
      }, 350)
    }
  }, [syncMode, syncCodeToBlocks])

  // ─── Resizable split drag ─────────────────────────────────────────
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const wrap = splitWrapRef.current
    if (!wrap) return
    const startX   = e.clientX
    const startRatio = splitRatio

    const onMove = (me: MouseEvent) => {
      const delta   = me.clientX - startX
      const newRatio = Math.max(25, Math.min(75, startRatio + (delta / wrap.offsetWidth) * 100))
      setSplitRatio(newRatio)
      // Resize Blockly canvas after layout shift
      if (workspaceRef.current) Blockly.svgResize(workspaceRef.current)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (workspaceRef.current) Blockly.svgResize(workspaceRef.current)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [splitRatio])

  // ─── Run generated code ───────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (!code.trim() || code.startsWith('//')) { toast.warning('Add some blocks first!'); return }

    const ext      = lang === 'python' ? 'py' : 'js'
    const fname    = `blocks_output.${ext}`
    const tmpPath  = `${currentFolder ?? (navigator.userAgent.includes('Win') ? 'C:\\Temp' : '/tmp')}/${fname}`
    const command  = lang === 'python' ? (settings.pythonPath || 'python') : 'node'

    const JS_SIMULATOR_STUB = `
// ── Momiji STEM Robotics Local Simulator Stub ──
const fs = require('fs');
const robot = {
  move: (dir, speed) => console.log(\`[Robotics] 🤖 Motor: \${dir} at speed \${speed}%\`),
  setLed: (color) => console.log(\`[Robotics] 💡 LED set to \${color}\`),
  readSensor: (sensor) => {
    // Throttle loop execution to prevent Electron IPC flooding (keeps UI butter-smooth at 60fps)
    const sleepStart = Date.now();
    while (Date.now() - sleepStart < 15) {}

    let val = 0;
    if (sensor === 'ultrasonic') {
      try {
        const data = JSON.parse(fs.readFileSync(\`\${__filename}_state.json\`, 'utf8'));
        val = data.distance != null ? Math.round(data.distance) : 40;
      } catch(e) {
        val = Math.floor(Math.random() * 80) + 10;
      }
    } else if (sensor === 'line_left' || sensor === 'line_right') {
      try {
        const data = JSON.parse(fs.readFileSync(\`\${__filename}_state.json\`, 'utf8'));
        val = data[sensor] != null ? Number(data[sensor]) : 0;
      } catch(e) {
        val = 0;
      }
    } else if (sensor === 'light') {
      val = Math.floor(Math.random() * 500) + 100;
    } else if (sensor === 'temperature') {
      val = Math.floor(Math.random() * 15) + 20;
    } else {
      val = Math.floor(Math.random() * 2);
    }
    console.log(\`[Robotics] 👁️ Sensor \${sensor}: \${val}\\n\`);
    return val;
  },
  playTone: (freq, duration) => console.log(\`[Robotics] 🎵 Tone playing: \${freq}Hz for \${duration}ms\`),
  sleep: (seconds) => {
    const ms = seconds * 1000;
    const start = Date.now();
    while (Date.now() - start < ms) {}
  },
  showText: (text, x, y) => console.log(\`[Robotics] 📺 Display: "\${text}" at (\${x}, \${y})\`),
  clearScreen: () => console.log(\`[Robotics] 📺 Screen cleared\`),
  isButtonPressed: (btn) => {
    let pressed = false;
    try {
      const data = JSON.parse(fs.readFileSync(\`\${__filename}_buttons.json\`, 'utf8'));
      pressed = !!data[btn];
    } catch(e) {
      pressed = Math.random() > 0.5;
    }
    console.log(\`[Robotics] 🔘 Button \${btn} pressed? \${pressed}\\n\`);
    return pressed;
  },
  setServo: (pin, angle) => console.log(\`[Robotics] 🦾 Servo \${pin} set to \${angle}°\`)
};
// ───────────────────────────────────────────────\n\n`;

    const PY_SIMULATOR_STUB = `
# ── Momiji STEM Robotics Local Simulator Stub ──
import time
import random
import os
import json

class MomijiRobotSimulator:
    def move(self, direction, speed):
        print(f"[Robotics] 🤖 Motor: {direction} at speed {speed}%")
    def setLed(self, color):
        print(f"[Robotics] 💡 LED set to {color}")
    def readSensor(self, sensor):
        # Throttle loop execution to prevent Electron IPC flooding
        time.sleep(0.015)
        val = 0
        if sensor == "ultrasonic":
            try:
                state_path = __file__ + "_state.json"
                with open(state_path, "r") as f:
                    data = json.load(f)
                    val = int(data.get("distance", 40))
            except:
                val = random.randint(10, 90)
        elif sensor in ("line_left", "line_right"):
            try:
                state_path = __file__ + "_state.json"
                with open(state_path, "r") as f:
                    data = json.load(f)
                    val = int(data.get(sensor, 0))
            except:
                val = 0
        else:
            val = random.randint(100, 600) if sensor == "light" else \
                  random.randint(20, 35) if sensor == "temperature" else \
                  random.randint(0, 1)
        print(f"[Robotics] 👁️ Sensor {sensor}: {val}\\n")
        return val
    def playTone(self, freq, duration):
        print(f"[Robotics] 🎵 Tone playing: {freq}Hz for {duration}ms")
    def sleep(self, seconds):
        time.sleep(seconds)
    def showText(self, text, x, y):
        print(f"[Robotics] 📺 Display: \"{text}\" at ({x}, {y})")
    def clearScreen(self):
        print("[Robotics] 📺 Screen cleared")
    def isButtonPressed(self, btn):
        pressed = False
        try:
            btn_path = __file__ + "_buttons.json"
            with open(btn_path, "r") as f:
                data = json.load(f)
                pressed = bool(data.get(btn, False))
        except:
            pressed = random.choice([True, False])
        print(f"[Robotics] 🔘 Button {btn} pressed? {pressed}\\n")
        return pressed
    def setServo(self, pin, angle):
        print(f"[Robotics] 🦾 Servo {pin} set to {angle}°")

robot = MomijiRobotSimulator()
# ───────────────────────────────────────────────\n\n`;

    const stub = lang === 'python' ? PY_SIMULATOR_STUB : JS_SIMULATOR_STUB;
    const finalCode = code.includes('robot.') ? stub + code : code;

    // Create default initial simulation state files to prevent empty file crashes
    try {
      await window.api.fs.writeFile(tmpPath + '_buttons.json', JSON.stringify({ A: false, B: false }))
      await window.api.fs.writeFile(tmpPath + '_state.json', JSON.stringify({ distance: 100 }))
    } catch (e) {
      // Ignored
    }

    try {
      await window.api.fs.writeFile(tmpPath, finalCode)
    } catch {
      toast.error('Could not write temp file. Open a folder first.')
      return
    }

    if (!showBottomPanel) toggleBottomPanel()
    window.dispatchEvent(new CustomEvent('bottomPanel:switchTab', { detail: { tab: 'output' } }))

    setTimeout(async () => {
      window.dispatchEvent(new CustomEvent('runner:start', {
        detail: { processId: 'runner-main', command, args: [tmpPath], cwd: currentFolder ?? '', label: fname, fileName: fname }
      }))
      await window.api.process.run('runner-main', command, [tmpPath], currentFolder ?? '')
    }, 150)

    toast.info(`▶ Running ${fname}…`)
  }, [code, lang, showBottomPanel, toggleBottomPanel, settings.pythonPath, currentFolder])

  const handleStop = useCallback(async () => {
    await window.api.process.kill('runner-main')
    setRunStatus('idle')
    setIsPaused(false)
    toast.error('■ Stopped execution')
  }, [])

  const handlePauseToggle = useCallback(async () => {
    if (runStatus !== 'running') return
    const nextPaused = !isPaused
    setIsPaused(nextPaused)
    
    const path = `${currentFolder ?? (navigator.userAgent.includes('Win') ? 'C:\\Temp' : '/tmp')}/blocks_output.${lang === 'python' ? 'py' : 'js'}_state.json`
    try {
      let data: any = {}
      try {
        const content = await window.api.fs.readFile(path)
        data = JSON.parse(content)
      } catch (e) {}
      data.paused = nextPaused
      await window.api.fs.writeFile(path, JSON.stringify(data))
      
      if (nextPaused) {
        toast.warning('⏸ Paused execution')
      } else {
        toast.success('▶ Resumed execution')
      }
    } catch(e) {}
  }, [runStatus, isPaused, currentFolder, lang])

  const handleStep = useCallback(async () => {
    if (runStatus !== 'running') return
    setIsPaused(true)
    
    const path = `${currentFolder ?? (navigator.userAgent.includes('Win') ? 'C:\\Temp' : '/tmp')}/blocks_output.${lang === 'python' ? 'py' : 'js'}_state.json`
    try {
      let data: any = {}
      try {
        const content = await window.api.fs.readFile(path)
        data = JSON.parse(content)
      } catch (e) {}
      data.paused = true
      data.stepPending = true
      await window.api.fs.writeFile(path, JSON.stringify(data))
      toast.info('👣 Stepped one block')
    } catch(e) {}
  }, [runStatus, currentFolder, lang])

  // ─── Kitsune: convert code → blocks ──────────────────────────────
  const handleAIToBlocks = useCallback(async () => {
    if (!code.trim() || code.startsWith('//')) { toast.warning('Write some code first!'); return }
    const provider = aiProviders.find(p => p.enabled && (p.apiKey || p.id === 'ollama'))
    if (!provider) { toast.error('Enable an AI provider in Settings first'); return }

    setAiConverting(true)
    toast.info('Kitsune is converting code to blocks…')

    const prompt = `Convert this ${lang} code to a Blockly workspace XML string.
Only return the XML — no explanation, no markdown fences.
Use standard Blockly block types (controls_repeat_ext, math_number, text_print, variables_set, etc.).

Code:
\`\`\`${lang}
${code}
\`\`\``

    try {
      let xml = ''

      if (provider.id === 'claude') {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: provider.model, max_tokens: 2048, system: 'You are a Blockly XML generator. Return only valid Blockly XML, nothing else.', messages: [{ role: 'user', content: prompt }] })
        })
        const d = await r.json()
        xml = d.content?.[0]?.text ?? ''
      } else if (provider.id === 'gemini') {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
        })
        const d = await r.json()
        xml = d.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      } else {
        // OpenAI-compat (groq, openai, deepseek, mistral, openrouter, ollama)
        const base = provider.baseUrl || (
          provider.id === 'groq' ? 'https://api.groq.com/openai' :
          provider.id === 'openrouter' ? 'https://openrouter.ai/api' :
          provider.id === 'deepseek' ? 'https://api.deepseek.com' :
          provider.id === 'mistral' ? 'https://api.mistral.ai' :
          'https://api.openai.com'
        )
        const r = await fetch(`${base}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.apiKey}` },
          body: JSON.stringify({ model: provider.model, max_tokens: 2048, messages: [
            { role: 'system', content: 'You are a Blockly XML generator. Return only valid Blockly XML, nothing else.' },
            { role: 'user', content: prompt }
          ]})
        })
        const d = await r.json()
        xml = d.choices?.[0]?.message?.content ?? ''
      }

      // Strip markdown fences if AI added them
      xml = xml.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim()

      if (!xml.includes('<block') && !xml.includes('<xml')) {
        toast.error('AI returned invalid XML. Try simpler code.')
        return
      }

      const ws = workspaceRef.current
      if (!ws) return
      ws.clear()
      const dom = Blockly.utils.xml.textToDom(xml.startsWith('<xml') ? xml : `<xml>${xml}</xml>`)
      Blockly.Xml.domToWorkspace(dom, ws)
      setSyncMode('blocks-primary')
      setBlockCount(ws.getAllBlocks(false).length)
      toast.success(`Converted! ${ws.getAllBlocks(false).length} blocks created 🦊`)
    } catch (err: any) {
      toast.error('Conversion failed: ' + (err.message ?? 'unknown error'))
    } finally {
      setAiConverting(false)
    }
  }, [code, lang, aiProviders])

  // ─── Template loader ──────────────────────────────────────────────
  const loadTemplate = useCallback((templateFn: (ws: Blockly.WorkspaceSvg) => void) => {
    const ws = workspaceRef.current
    if (!ws) return
    ws.clear()
    templateFn(ws)
    let gen = ''
    if (lang === 'javascript') {
      gen = javascriptGenerator.workspaceToCode(ws)
    } else if (lang === 'python') {
      gen = pythonGenerator.workspaceToCode(ws)
    } else if (lang === 'arduino') {
      gen = (arduinoGenerator as any).workspaceToCode(ws)
    }
    setCode(gen || '')
    setBlockCount(ws.getAllBlocks(false).length)
    setShowTemplates(false)
    toast.success('Template loaded!')
  }, [lang])

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 flex-shrink-0 flex-wrap"
        style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)', minHeight: '40px', paddingTop: 4, paddingBottom: 4 }}>

        {/* Level selector */}
        <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--bg-surface0)' }}>
          {(['beginner', 'intermediate', 'advanced'] as Level[]).map((l) => {
            const labels = { beginner: '🌱 Beginner', intermediate: '🔥 Pro', advanced: '⚡ Expert' }
            return (
              <button key={l} onClick={() => setLevel(l)}
                className="px-2 py-0.5 rounded-md text-xs font-semibold transition-all"
                style={{
                  background: level === l ? 'var(--accent-mauve)' : 'transparent',
                  color: level === l ? 'white' : 'var(--text-muted)'
                }}>
                {labels[l]}
              </button>
            )
          })}
        </div>

        {/* Block count */}
        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-surface0)', color: 'var(--accent-mauve)' }}>
          {blockCount} blocks
        </span>

        <div className="flex-1" />

        {/* View Layout Controls (VSCode style) */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg border" style={{ background: 'var(--bg-surface0)', borderColor: 'var(--border)' }}>
          <button onClick={() => setSplitRatio(100)} title="Blocks Only Layout"
            className="px-2 py-0.5 rounded text-[10px] font-extrabold transition-all cursor-pointer"
            style={{
              background: splitRatio === 100 ? 'var(--accent-mauve)' : 'transparent',
              color: splitRatio === 100 ? 'white' : 'var(--text-muted)'
            }}>
            🧱 BLOCKS
          </button>
          <button onClick={() => setSplitRatio(50)} title="Split View Layout"
            className="px-2 py-0.5 rounded text-[10px] font-extrabold transition-all cursor-pointer"
            style={{
              background: splitRatio > 0 && splitRatio < 100 ? 'var(--accent-mauve)' : 'transparent',
              color: splitRatio > 0 && splitRatio < 100 ? 'white' : 'var(--text-muted)'
            }}>
            💻 SPLIT
          </button>
          <button onClick={() => setSplitRatio(0)} title="Code Only Layout"
            className="px-2 py-0.5 rounded text-[10px] font-extrabold transition-all cursor-pointer"
            style={{
              background: splitRatio === 0 ? 'var(--accent-mauve)' : 'transparent',
              color: splitRatio === 0 ? 'white' : 'var(--text-muted)'
            }}>
            📝 CODE
          </button>
        </div>

        {/* Panel Toggles */}
        <div className="flex gap-1">
          <button onClick={toggleSidebar} title="Toggle Explorer Sidebar (Ctrl+B)"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-xs border cursor-pointer"
            style={{
              background: showSidebar ? 'var(--bg-surface1)' : 'var(--bg-base)',
              color: showSidebar ? 'var(--accent-teal)' : 'var(--text-muted)',
              borderColor: 'var(--border)'
            }}>
            📁
          </button>
          <button onClick={toggleBottomPanel} title="Toggle Bottom Console Panel (Ctrl+`)"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-xs border cursor-pointer"
            style={{
              background: showBottomPanel ? 'var(--bg-surface1)' : 'var(--bg-base)',
              color: showBottomPanel ? 'var(--accent-teal)' : 'var(--text-muted)',
              borderColor: 'var(--border)'
            }}>
            ⌨️
          </button>
        </div>

        {/* Templates */}
        <div className="relative">
          <button onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all"
            style={{ background: showTemplates ? 'var(--accent-mauve)' : 'var(--bg-surface0)', color: showTemplates ? 'white' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
            📋 Templates
          </button>
          {showTemplates && (
            <div className="absolute top-8 right-0 z-20 rounded-xl overflow-hidden shadow-xl"
              style={{ background: 'var(--bg-mantle)', border: '1px solid var(--border)', width: 220 }}>
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => loadTemplate(t.load)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors"
                  style={{ color: 'var(--text)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface0)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <span className="text-lg">{t.icon}</span>
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    <p style={{ color: 'var(--text-subtle)', fontSize: 10 }}>{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Language */}
        <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}
          className="text-xs px-2 py-1 rounded-lg outline-none"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}>
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="arduino">Arduino C++</option>
        </select>

        {/* Sync mode cycle button */}
        <button onClick={handleToggleSync}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium"
          title={syncMode === 'blocks-primary' ? 'Blocks→Code live. Click for free code mode.' : syncMode === 'code-primary' ? 'Code free. Click for auto-sync (⟳).' : 'Auto-sync active. Click to go back to blocks-only.'}
          style={{
            background: syncMode === 'bidirectional' ? 'var(--accent-green)' : syncMode === 'code-primary' ? 'var(--accent-yellow)' : 'var(--accent-mauve)',
            color: 'var(--bg-base)'
          }}>
          {syncMode === 'blocks-primary' ? '⟳ Live' : syncMode === 'code-primary' ? '✏️ Edit' : '⟳ Sync'}
        </button>

        {[
          { icon: '💾', title: 'Save workspace',  fn: handleSave },
          { icon: '📂', title: 'Load workspace',  fn: handleLoad },
          { icon: '🗑️', title: 'Clear',           fn: handleClear }
        ].map((b) => (
          <button key={b.icon} onClick={b.fn} title={b.title}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface0)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            {b.icon}
          </button>
        ))}

        {/* Run / Debug Controls */}
        {runStatus === 'running' ? (
          <div className="flex items-center gap-1 p-0.5 rounded-lg border" style={{ background: 'var(--bg-surface0)', borderColor: 'var(--border)' }}>
            <button onClick={handlePauseToggle} title={isPaused ? "Resume execution" : "Pause execution"}
              className="px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer"
              style={{ background: isPaused ? 'var(--accent-green)' : 'var(--accent-yellow)', color: 'var(--bg-base)' }}>
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
            {isPaused && (
              <button onClick={handleStep} title="Step one block / instruction"
                className="px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer"
                style={{ background: 'var(--bg-surface1)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                👣 Step
              </button>
            )}
            <button onClick={handleStop} title="Stop execution"
              className="px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer"
              style={{ background: 'var(--accent-red)', color: 'white' }}>
              ■ Stop
            </button>
          </div>
        ) : (
          <button onClick={handleRun}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer"
            style={{ background: 'var(--accent-green)', color: 'var(--bg-base)' }}>
            ▶ Run
          </button>
        )}

        <button onClick={handleOpenInEditor}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          Open in Editor →
        </button>

        {/* 🤖 Arena toggle */}
        <button
          onClick={() => { setShowArena(s => !s); setShowExport(false) }}
          title="Toggle Kitsune Robot Arena"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
          style={{
            background: rightPanel === 'arena' ? 'var(--accent-mauve)' : 'var(--bg-surface0)',
            color: rightPanel === 'arena' ? 'white' : 'var(--text-muted)',
            border: '1px solid var(--border)'
          }}>
          🤖 Arena
        </button>

        {/* 🔌 Hardware Export */}
        <button
          onClick={() => { setShowExport(s => !s); setShowArena(false) }}
          title="Export to Micro:bit / Arduino"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
          style={{
            background: rightPanel === 'export' ? 'var(--accent-teal)' : 'var(--bg-surface0)',
            color: rightPanel === 'export' ? 'white' : 'var(--text-muted)',
            border: '1px solid var(--border)'
          }}>
          🔌 Export
        </button>
      </div>

      {/* Kitsune beginner guide */}
      {level === 'beginner' && (
        <div className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0 text-xs"
          style={{ background: 'var(--accent-mauve)18', borderBottom: '1px solid var(--accent-mauve)33' }}>
          <span>🦊</span>
          <span style={{ color: 'var(--accent-mauve)' }}>
            {blockCount === 0
              ? 'Pick a template above to get started, or drag any block from the left panel!'
              : blockCount < 3
              ? 'Nice! Connect blocks by dragging the dots on the sides. Keep going!'
              : blockCount < 6
              ? "Great progress! Click ▶ Open in Editor to see the code, or keep adding blocks."
              : "You're building something real! When you're ready, open it in the code editor."}
          </span>
        </div>
      )}

      {/* Dual view — resizable split */}
      <div ref={splitWrapRef} className="flex flex-1 overflow-hidden" style={{ userSelect: 'none' }}>

        {/* LEFT: Blockly */}
        <div style={{ flex: `0 0 ${splitRatio}%`, position: 'relative', overflow: 'hidden' }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* DRAG HANDLE */}
        <div
          onMouseDown={handleDragStart}
          style={{
            width: 6, flexShrink: 0, cursor: 'col-resize',
            background: 'var(--border)',
            borderLeft: '1px solid var(--border)',
            borderRight: '1px solid var(--border)',
            transition: 'background 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-mauve)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--border)')}
          title="Drag to resize"
        >
          <div style={{ width: 2, height: 32, background: 'var(--bg-surface2)', borderRadius: 2 }} />
        </div>

        {/* RIGHT: Monaco code output */}
        <div className="flex flex-col" style={{ flex: 1, minWidth: 0 }}>
          {/* Code header */}
          <div className="flex items-center gap-2 px-3 flex-shrink-0"
            style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)', height: '36px' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              {lang === 'python' ? 'Python' : 'JavaScript'} Output
            </span>
            {syncMode === 'blocks-primary' && (
              <span className="text-xs px-1.5 py-0.5 rounded-full animate-pulse"
                style={{ background: 'var(--accent-green)', color: 'var(--bg-base)', fontSize: 10 }}>
                ● blocks→code
              </span>
            )}
            {syncMode === 'bidirectional' && (
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--accent-green)22', color: 'var(--accent-green)', border: '1px solid var(--accent-green)55', fontSize: 10 }}>
                ⟳ auto-sync
              </span>
            )}
            {syncMode === 'code-primary' && codeChanged && (
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--accent-yellow)22', color: 'var(--accent-yellow)', border: '1px solid var(--accent-yellow)55', fontSize: 10 }}>
                ● unsaved to blocks
              </span>
            )}
            <div className="flex-1" />
            {/* AI → Blocks button */}
            {(syncMode === 'code-primary' || syncMode === 'bidirectional') && (
              <button
                onClick={handleAIToBlocks}
                disabled={aiConverting}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-all"
                style={{
                  background: aiConverting ? 'var(--bg-surface1)' : 'var(--accent-mauve)22',
                  border: '1px solid var(--accent-mauve)55',
                  color: aiConverting ? 'var(--text-subtle)' : 'var(--accent-mauve)',
                  opacity: aiConverting ? 0.7 : 1,
                }}
                title="Let Kitsune convert this code back to blocks">
                {aiConverting ? '⟳ Converting…' : '🦊 → Blocks'}
              </button>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(code).then(() => toast.success('Copied!'))}
              className="text-xs px-2 py-0.5 rounded"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              📋 Copy
            </button>
          </div>

          {/* Monaco */}
          <div className="flex-1 overflow-hidden relative">
            <MonacoEditor
              language={lang}
              value={code}
              theme={monacoTheme}
              onChange={(v) => { if (v !== undefined && syncMode !== 'blocks-primary') handleCodeChange(v) }}
              onMount={(editor) => {
                // When user tries to type in read-only mode → auto-unlock to code-primary
                editor.onDidAttemptReadOnlyEdit(() => {
                  setSyncMode('code-primary')
                  setCodeChanged(true)
                  toast.info('✏️ Switched to Edit mode — type freely! Click ↑ Sync to update blocks.')
                })
              }}
              options={{
                readOnly: syncMode === 'blocks-primary',
                readOnlyMessage: { value: 'Click here or press any key to edit code freely ✏️' },
                fontSize: settings.fontSize,
                fontFamily: settings.fontFamily,
                fontLigatures: true,
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 12, bottom: 12 },
                scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
                bracketPairColorization: { enabled: true },
                renderLineHighlight: syncMode !== 'blocks-primary' ? 'line' : 'none',
                cursorStyle: syncMode === 'blocks-primary' ? 'underline' : 'line',
              }}
            />
            {/* Clickable unlock overlay in blocks-primary mode */}
            {syncMode === 'blocks-primary' && (
              <div
                onClick={() => { setSyncMode('code-primary'); toast.info('✏️ Edit mode — type freely, then click ↑ Sync to Blocks') }}
                style={{
                  position: 'absolute', inset: 0, cursor: 'text',
                  background: 'rgba(0,0,0,0.01)', zIndex: 2,
                }}
                title="Click to edit code freely"
              />
            )}
          </div>

          {/* Inline run output */}
          {showRunOutput && (
            <div className="flex-shrink-0 flex flex-col"
              style={{ borderTop: '2px solid var(--accent-mauve)', background: 'var(--bg-crust)' }}>
              
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-1 flex-shrink-0"
                style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-mantle)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: 'var(--accent-mauve)' }}>▶ RUNNER WORKSPACE</span>
                  {runStatus === 'running' && (
                    <span className="text-xs animate-pulse" style={{ color: 'var(--accent-yellow)' }}>
                      ⟳ {runElapsed != null ? `${(runElapsed/1000).toFixed(1)}s` : 'running…'}
                    </span>
                  )}
                  {runStatus === 'done'  && <span className="text-xs" style={{ color: 'var(--accent-green)' }}>✓ {runElapsed != null ? (runElapsed/1000).toFixed(2) : '0'}s</span>}
                  {runStatus === 'error' && <span className="text-xs" style={{ color: 'var(--accent-red)'   }}>✗ Error</span>}
                </div>
                <button onClick={() => { setShowRunOutput(false); setRunLines([]) }}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ color: 'var(--text-subtle)', border: '1px solid var(--border)' }}>✕</button>
              </div>

              {/* Splitscreen layout */}
              <div className="flex flex-col md:flex-row overflow-hidden" style={{ maxHeight: 320 }}>
                {/* Left panel: Log Console */}
                <div className="flex-1 overflow-y-auto p-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, minHeight: 120 }}>
                  {runLines.length === 0 && runStatus === 'running' && (
                    <span style={{ color: 'var(--text-subtle)' }}>Running…</span>
                  )}
                  {runLines.map(l => (
                    <div key={l.id} style={{
                      color: l.type === 'err' ? 'var(--accent-red)' : l.type === 'sys' ? 'var(--text-muted)' : 'var(--text)',
                      whiteSpace: 'pre-wrap', lineHeight: 1.6
                    }}>{l.text}</div>
                  ))}
                  <div ref={runOutputRef} />
                </div>

                {/* Right panel: 🔌 Hardware Export */}
                {rightPanel === 'export' && (
                  <div className="w-full md:w-[520px] flex-shrink-0 overflow-hidden border-t md:border-t-0 md:border-l" style={{ background: 'var(--bg-mantle)', borderColor: 'var(--border)' }}>
                    <HardwareExportPanel code={code} />
                  </div>
                )}

                {/* Right panel: Kitsune Arena Simulator — toggle with 🤖 Arena button */}
                {rightPanel === 'arena' && (
                  <div className="w-full md:w-[600px] flex-shrink-0 overflow-y-auto border-t md:border-t-0 md:border-l" style={{ background: 'var(--bg-mantle)', borderColor: 'var(--border)' }}>
                    <RobotSimulator
                      runLines={runLines}
                      runStatus={runStatus}
                      tmpPath={`${currentFolder ?? (navigator.userAgent.includes('Win') ? 'C:\\Temp' : '/tmp')}/blocks_output.${lang === 'python' ? 'py' : 'js'}`}
                    />
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Bottom hint / sync bar */}
          <div className="px-3 py-1.5 text-xs flex items-center gap-2 flex-shrink-0"
            style={{ background: 'var(--bg-mantle)', borderTop: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
            {syncMode === 'blocks-primary' && (
              <>
                <span>⟳ Code auto-updates from blocks</span>
                <button
                  onClick={() => { setSyncMode('code-primary'); toast.info('✏️ Edit mode — type freely!') }}
                  className="ml-auto px-2.5 py-1 rounded-lg font-semibold"
                  style={{ background: 'var(--bg-surface1)', color: 'var(--accent-mauve)', border: '1px solid var(--accent-mauve)44' }}>
                  ✏️ Edit code
                </button>
              </>
            )}
            {syncMode === 'code-primary' && (
              <>
                <span>✏️ Edit code — click to sync ↑ to blocks</span>
                {codeChanged && lang === 'javascript' && (
                  <button
                    onClick={() => syncCodeToBlocks(code)}
                    disabled={syncing}
                    className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold"
                    style={{ background: 'var(--accent-mauve)', color: 'white', border: 'none', cursor: 'pointer', opacity: syncing ? 0.6 : 1 }}>
                    {syncing ? '⟳' : '↑'} Sync to Blocks
                  </button>
                )}
                {!codeChanged && <button onClick={handleToggleSync} className="ml-auto underline" style={{ color: 'var(--accent-mauve)' }}>⟳ Auto-sync mode</button>}
              </>
            )}
            {syncMode === 'bidirectional' && (
              <>
                <span style={{ color: 'var(--accent-green)' }}>⟳ Auto-sync</span>
                {syncCoverage < 1 && (
                  <span style={{ color: 'var(--accent-yellow)', fontSize: 10 }}>
                    — {Math.round(syncCoverage * 100)}% coverage
                  </span>
                )}
                {syncing && <span className="animate-pulse" style={{ color: 'var(--accent-mauve)' }}>syncing…</span>}
                <button onClick={handleToggleSync} className="ml-auto underline" style={{ color: 'var(--text-subtle)' }}>Back to blocks-only</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Templates ──────────────────────────────────────────────────────
const TEMPLATES: { id: string; name: string; desc: string; icon: string; load: (ws: Blockly.WorkspaceSvg) => void }[] = [
  {
    id: 'line-follower', name: 'Line Follower', icon: '🔄',
    desc: 'Steer robot along a neon floor track',
    load: (ws) => {
      const loop = ws.newBlock('controls_whileUntil'); loop.initSvg(); loop.render(); loop.moveBy(80, 80)
      const cond = ws.newBlock('logic_boolean'); cond.setFieldValue('TRUE', 'BOOL'); cond.initSvg(); cond.render()
      loop.getInput('BOOL')?.connection?.connect(cond.outputConnection!)

      const ifBlock = ws.newBlock('controls_if'); ifBlock.initSvg(); ifBlock.render()
      loop.getInput('DO')?.connection?.connect(ifBlock.previousConnection!)

      // 1. Condition IF: left == 1 && right == 0
      const checkLeft = ws.newBlock('logic_operation'); checkLeft.setFieldValue('AND', 'OP'); checkLeft.initSvg(); checkLeft.render()
      ifBlock.getInput('IF0')?.connection?.connect(checkLeft.outputConnection!)

      const leftEq = ws.newBlock('logic_compare'); leftEq.setFieldValue('EQ', 'OP'); leftEq.initSvg(); leftEq.render()
      const sLeft = ws.newBlock('robot_sensor'); sLeft.setFieldValue('line_left', 'SENSOR'); sLeft.initSvg(); sLeft.render()
      const n1 = ws.newBlock('math_number'); n1.setFieldValue('1', 'NUM'); n1.initSvg(); n1.render()
      leftEq.getInput('A')?.connection?.connect(sLeft.outputConnection!)
      leftEq.getInput('B')?.connection?.connect(n1.outputConnection!)
      checkLeft.getInput('A')?.connection?.connect(leftEq.outputConnection!)

      const rightEq0 = ws.newBlock('logic_compare'); rightEq0.setFieldValue('EQ', 'OP'); rightEq0.initSvg(); rightEq0.render()
      const sRight = ws.newBlock('robot_sensor'); sRight.setFieldValue('line_right', 'SENSOR'); sRight.initSvg(); sRight.render()
      const n0 = ws.newBlock('math_number'); n0.setFieldValue('0', 'NUM'); n0.initSvg(); n0.render()
      rightEq0.getInput('A')?.connection?.connect(sRight.outputConnection!)
      rightEq0.getInput('B')?.connection?.connect(n0.outputConnection!)
      checkLeft.getInput('B')?.connection?.connect(rightEq0.outputConnection!)

      const turnLeft = ws.newBlock('robot_move'); turnLeft.setFieldValue('LEFT', 'DIRECTION'); turnLeft.setFieldValue('40', 'SPEED'); turnLeft.initSvg(); turnLeft.render()
      ifBlock.getInput('DO0')?.connection?.connect(turnLeft.previousConnection!)

      // 2. Else IF 1: left == 0 && right == 1
      ;(ifBlock as any).elseifCount_ = 2;
      ;(ifBlock as any).elseCount_ = 1;
      (ifBlock as any).updateShape_?.()

      const checkRight = ws.newBlock('logic_operation'); checkRight.setFieldValue('AND', 'OP'); checkRight.initSvg(); checkRight.render()
      ifBlock.getInput('IF1')?.connection?.connect(checkRight.outputConnection!)

      const leftEq0 = ws.newBlock('logic_compare'); leftEq0.setFieldValue('EQ', 'OP'); leftEq0.initSvg(); leftEq0.render()
      const sLeft2 = ws.newBlock('robot_sensor'); sLeft2.setFieldValue('line_left', 'SENSOR'); sLeft2.initSvg(); sLeft2.render()
      const n0_2 = ws.newBlock('math_number'); n0_2.setFieldValue('0', 'NUM'); n0_2.initSvg(); n0_2.render()
      leftEq0.getInput('A')?.connection?.connect(sLeft2.outputConnection!)
      leftEq0.getInput('B')?.connection?.connect(n0_2.outputConnection!)
      checkRight.getInput('A')?.connection?.connect(leftEq0.outputConnection!)

      const rightEq1 = ws.newBlock('logic_compare'); rightEq1.setFieldValue('EQ', 'OP'); rightEq1.initSvg(); rightEq1.render()
      const sRight2 = ws.newBlock('robot_sensor'); sRight2.setFieldValue('line_right', 'SENSOR'); sRight2.initSvg(); sRight2.render()
      const n1_2 = ws.newBlock('math_number'); n1_2.setFieldValue('1', 'NUM'); n1_2.initSvg(); n1_2.render()
      rightEq1.getInput('A')?.connection?.connect(sRight2.outputConnection!)
      rightEq1.getInput('B')?.connection?.connect(n1_2.outputConnection!)
      checkRight.getInput('B')?.connection?.connect(rightEq1.outputConnection!)

      const turnRight = ws.newBlock('robot_move'); turnRight.setFieldValue('RIGHT', 'DIRECTION'); turnRight.setFieldValue('40', 'SPEED'); turnRight.initSvg(); turnRight.render()
      ifBlock.getInput('DO1')?.connection?.connect(turnRight.previousConnection!)

      // 3. Else IF 2: left == 0 && right == 0 (both off line, move forward!)
      const checkBoth0 = ws.newBlock('logic_operation'); checkBoth0.setFieldValue('AND', 'OP'); checkBoth0.initSvg(); checkBoth0.render()
      ifBlock.getInput('IF2')?.connection?.connect(checkBoth0.outputConnection!)

      const leftEq0_3 = ws.newBlock('logic_compare'); leftEq0_3.setFieldValue('EQ', 'OP'); leftEq0_3.initSvg(); leftEq0_3.render()
      const sLeft3 = ws.newBlock('robot_sensor'); sLeft3.setFieldValue('line_left', 'SENSOR'); sLeft3.initSvg(); sLeft3.render()
      const n0_3 = ws.newBlock('math_number'); n0_3.setFieldValue('0', 'NUM'); n0_3.initSvg(); n0_3.render()
      leftEq0_3.getInput('A')?.connection?.connect(sLeft3.outputConnection!)
      leftEq0_3.getInput('B')?.connection?.connect(n0_3.outputConnection!)
      checkBoth0.getInput('A')?.connection?.connect(leftEq0_3.outputConnection!)

      const rightEq0_3 = ws.newBlock('logic_compare'); rightEq0_3.setFieldValue('EQ', 'OP'); rightEq0_3.initSvg(); rightEq0_3.render()
      const sRight3 = ws.newBlock('robot_sensor'); sRight3.setFieldValue('line_right', 'SENSOR'); sRight3.initSvg(); sRight3.render()
      const n0_3_r = ws.newBlock('math_number'); n0_3_r.setFieldValue('0', 'NUM'); n0_3_r.initSvg(); n0_3_r.render()
      rightEq0_3.getInput('A')?.connection?.connect(sRight3.outputConnection!)
      rightEq0_3.getInput('B')?.connection?.connect(n0_3_r.outputConnection!)
      checkBoth0.getInput('B')?.connection?.connect(rightEq0_3.outputConnection!)

      const forward = ws.newBlock('robot_move'); forward.setFieldValue('FORWARD', 'DIRECTION'); forward.setFieldValue('50', 'SPEED'); forward.initSvg(); forward.render()
      ifBlock.getInput('DO2')?.connection?.connect(forward.previousConnection!)

      // 4. Else: stop
      const stop = ws.newBlock('robot_move'); stop.setFieldValue('STOP', 'DIRECTION'); stop.setFieldValue('0', 'SPEED'); stop.initSvg(); stop.render()
      ifBlock.getInput('ELSE')?.connection?.connect(stop.previousConnection!)
    }
  },
  {
    id: 'obstacle-avoid', name: 'Obstacle Avoidance', icon: '🤖',
    desc: 'Avoid obstacles using distance sensor',
    load: (ws) => {
      const loop = ws.newBlock('controls_whileUntil'); loop.initSvg(); loop.render(); loop.moveBy(80, 80)
      const cond = ws.newBlock('logic_boolean'); cond.setFieldValue('TRUE', 'BOOL'); cond.initSvg(); cond.render()
      loop.getInput('BOOL')?.connection?.connect(cond.outputConnection!)

      const ifBlock = ws.newBlock('controls_if'); ifBlock.initSvg(); ifBlock.render()
      loop.getInput('DO')?.connection?.connect(ifBlock.previousConnection!)

      // condition: readSensor < 20
      const comp = ws.newBlock('logic_compare'); comp.setFieldValue('LT', 'OP'); comp.initSvg(); comp.render()
      ifBlock.getInput('IF0')?.connection?.connect(comp.outputConnection!)

      const sensor = ws.newBlock('robot_sensor'); sensor.setFieldValue('ultrasonic', 'SENSOR'); sensor.initSvg(); sensor.render()
      comp.getInput('A')?.connection?.connect(sensor.outputConnection!)

      const dist = ws.newBlock('math_number'); dist.setFieldValue('20', 'NUM'); dist.initSvg(); dist.render()
      comp.getInput('B')?.connection?.connect(dist.outputConnection!)

      // then: back up, sleep, turn right, sleep
      const back = ws.newBlock('robot_move'); back.setFieldValue('BACKWARD', 'DIRECTION'); back.setFieldValue('50', 'SPEED'); back.initSvg(); back.render()
      ifBlock.getInput('DO0')?.connection?.connect(back.previousConnection!)

      const s1 = ws.newBlock('robot_sleep'); s1.setFieldValue('0.5', 'SECONDS'); s1.initSvg(); s1.render()
      back.nextConnection?.connect(s1.previousConnection!)

      const turn = ws.newBlock('robot_move'); turn.setFieldValue('RIGHT', 'DIRECTION'); turn.setFieldValue('60', 'SPEED'); turn.initSvg(); turn.render()
      s1.nextConnection?.connect(turn.previousConnection!)

      const s2 = ws.newBlock('robot_sleep'); s2.setFieldValue('0.3', 'SECONDS'); s2.initSvg(); s2.render()
      turn.nextConnection?.connect(s2.previousConnection!)

      // else: move forward 80
      ;(ifBlock as any).elseCount_ = 1; (ifBlock as any).updateShape_?.()
      
      const forward = ws.newBlock('robot_move'); forward.setFieldValue('FORWARD', 'DIRECTION'); forward.setFieldValue('80', 'SPEED'); forward.initSvg(); forward.render()
      ifBlock.getInput('ELSE')?.connection?.connect(forward.previousConnection!)
    }
  },
  {
    id: 'calculator', name: 'Simple Calculator', icon: '🧮',
    desc: 'Add two numbers and show result',
    load: (ws) => {
      const print = ws.newBlock('text_print'); print.initSvg(); print.render(); print.moveBy(80, 80)
      const join = ws.newBlock('text_join'); (join as any).itemCount_ = 3; (join as any).updateShape_?.(); join.initSvg(); join.render()
      print.getInput('VALUE')?.connection?.connect(join.outputConnection!)
      const lbl = ws.newBlock('text'); lbl.setFieldValue('10 + 5 = ', 'TEXT'); lbl.initSvg(); lbl.render()
      join.getInput('ADD0')?.connection?.connect(lbl.outputConnection!)
      const arith = ws.newBlock('math_arithmetic'); arith.setFieldValue('ADD', 'OP'); arith.initSvg(); arith.render()
      join.getInput('ADD1')?.connection?.connect(arith.outputConnection!)
      const a = ws.newBlock('math_number'); a.setFieldValue('10', 'NUM'); a.initSvg(); a.render()
      const b = ws.newBlock('math_number'); b.setFieldValue('5', 'NUM'); b.initSvg(); b.render()
      arith.getInput('A')?.connection?.connect(a.outputConnection!)
      arith.getInput('B')?.connection?.connect(b.outputConnection!)
    }
  },
  {
    id: 'greeting', name: 'Personalised Greeting', icon: '🙌',
    desc: 'Say hello with a name variable',
    load: (ws) => {
      const setVar = ws.newBlock('variables_set'); setVar.initSvg(); setVar.render(); setVar.moveBy(80, 80)
      const name = ws.newBlock('text'); name.setFieldValue('Kitsune', 'TEXT'); name.initSvg(); name.render()
      setVar.getInput('VALUE')?.connection?.connect(name.outputConnection!)
      const print = ws.newBlock('text_print'); print.initSvg(); print.render()
      setVar.nextConnection?.connect(print.previousConnection!)
      const join = ws.newBlock('text_join'); join.initSvg(); join.render()
      print.getInput('VALUE')?.connection?.connect(join.outputConnection!)
      const hi = ws.newBlock('text'); hi.setFieldValue('Hello, ', 'TEXT'); hi.initSvg(); hi.render()
      join.getInput('ADD0')?.connection?.connect(hi.outputConnection!)
      const getVar = ws.newBlock('variables_get'); getVar.initSvg(); getVar.render()
      join.getInput('ADD1')?.connection?.connect(getVar.outputConnection!)
    }
  },
  {
    id: 'evenodd', name: 'Even or Odd?', icon: '🎯',
    desc: 'Check if a number is even or odd',
    load: (ws) => {
      const ifBlock = ws.newBlock('controls_ifelse'); ifBlock.initSvg(); ifBlock.render(); ifBlock.moveBy(80, 80)
      const eq = ws.newBlock('logic_compare'); eq.setFieldValue('EQ', 'OP'); eq.initSvg(); eq.render()
      ifBlock.getInput('IF0')?.connection?.connect(eq.outputConnection!)
      const mod = ws.newBlock('math_modulo'); mod.initSvg(); mod.render()
      eq.getInput('A')?.connection?.connect(mod.outputConnection!)
      const num = ws.newBlock('math_number'); num.setFieldValue('7', 'NUM'); num.initSvg(); num.render()
      mod.getInput('DIVIDEND')?.connection?.connect(num.outputConnection!)
      const two = ws.newBlock('math_number'); two.setFieldValue('2', 'NUM'); two.initSvg(); two.render()
      mod.getInput('DIVISOR')?.connection?.connect(two.outputConnection!)
      const zero = ws.newBlock('math_number'); zero.setFieldValue('0', 'NUM'); zero.initSvg(); zero.render()
      eq.getInput('B')?.connection?.connect(zero.outputConnection!)
      const evenPrint = ws.newBlock('text_print'); evenPrint.initSvg(); evenPrint.render()
      ifBlock.getInput('DO0')?.connection?.connect(evenPrint.previousConnection!)
      const evenTxt = ws.newBlock('text'); evenTxt.setFieldValue('Even number! ✅', 'TEXT'); evenTxt.initSvg(); evenTxt.render()
      evenPrint.getInput('VALUE')?.connection?.connect(evenTxt.outputConnection!)
      const oddPrint = ws.newBlock('text_print'); oddPrint.initSvg(); oddPrint.render()
      ifBlock.getInput('ELSE')?.connection?.connect(oddPrint.previousConnection!)
      const oddTxt = ws.newBlock('text'); oddTxt.setFieldValue('Odd number! 🔢', 'TEXT'); oddTxt.initSvg(); oddTxt.render()
      oddPrint.getInput('VALUE')?.connection?.connect(oddTxt.outputConnection!)
    }
  },

  // ─── Advanced Templates ──────────────────────────────────────────
  {
    id: 'temp-convert', name: 'Temp Converter', icon: '🌡️',
    desc: 'Celsius → Fahrenheit formula',
    load: (ws) => {
      // print "100°C = " + (100 * 9 / 5 + 32) + "°F"
      const p1 = ws.newBlock('text_print'); p1.initSvg(); p1.render(); p1.moveBy(80, 80)
      const j1 = ws.newBlock('text_join');
      (j1 as any).itemCount_ = 3; (j1 as any).updateShape_?.()
      j1.initSvg(); j1.render()
      p1.getInput('VALUE')?.connection?.connect(j1.outputConnection!)
      const lbl = ws.newBlock('text'); lbl.setFieldValue('100°C = ', 'TEXT'); lbl.initSvg(); lbl.render()
      j1.getInput('ADD0')?.connection?.connect(lbl.outputConnection!)
      // 100 * 9 / 5 + 32
      const addBlock = ws.newBlock('math_arithmetic'); addBlock.setFieldValue('ADD', 'OP'); addBlock.initSvg(); addBlock.render()
      j1.getInput('ADD1')?.connection?.connect(addBlock.outputConnection!)
      const divBlock = ws.newBlock('math_arithmetic'); divBlock.setFieldValue('DIVIDE', 'OP'); divBlock.initSvg(); divBlock.render()
      addBlock.getInput('A')?.connection?.connect(divBlock.outputConnection!)
      const n32 = ws.newBlock('math_number'); n32.setFieldValue('32', 'NUM'); n32.initSvg(); n32.render()
      addBlock.getInput('B')?.connection?.connect(n32.outputConnection!)
      const mulBlock = ws.newBlock('math_arithmetic'); mulBlock.setFieldValue('MULTIPLY', 'OP'); mulBlock.initSvg(); mulBlock.render()
      divBlock.getInput('A')?.connection?.connect(mulBlock.outputConnection!)
      const n5 = ws.newBlock('math_number'); n5.setFieldValue('5', 'NUM'); n5.initSvg(); n5.render()
      divBlock.getInput('B')?.connection?.connect(n5.outputConnection!)
      const n100 = ws.newBlock('math_number'); n100.setFieldValue('100', 'NUM'); n100.initSvg(); n100.render()
      mulBlock.getInput('A')?.connection?.connect(n100.outputConnection!)
      const n9 = ws.newBlock('math_number'); n9.setFieldValue('9', 'NUM'); n9.initSvg(); n9.render()
      mulBlock.getInput('B')?.connection?.connect(n9.outputConnection!)
      const unit = ws.newBlock('text'); unit.setFieldValue('°F', 'TEXT'); unit.initSvg(); unit.render()
      j1.getInput('ADD2')?.connection?.connect(unit.outputConnection!)
      // Second line: 0°C
      const p2 = ws.newBlock('text_print'); p2.initSvg(); p2.render()
      p1.nextConnection?.connect(p2.previousConnection!)
      const j2 = ws.newBlock('text_join');
      (j2 as any).itemCount_ = 3; (j2 as any).updateShape_?.()
      j2.initSvg(); j2.render()
      p2.getInput('VALUE')?.connection?.connect(j2.outputConnection!)
      const lbl2 = ws.newBlock('text'); lbl2.setFieldValue('0°C = ', 'TEXT'); lbl2.initSvg(); lbl2.render()
      j2.getInput('ADD0')?.connection?.connect(lbl2.outputConnection!)
      const n32b = ws.newBlock('math_number'); n32b.setFieldValue('32', 'NUM'); n32b.initSvg(); n32b.render()
      j2.getInput('ADD1')?.connection?.connect(n32b.outputConnection!)
      const unit2 = ws.newBlock('text'); unit2.setFieldValue('°F', 'TEXT'); unit2.initSvg(); unit2.render()
      j2.getInput('ADD2')?.connection?.connect(unit2.outputConnection!)
    }
  },
  {
    id: 'dice-roll', name: 'Dice Roll Game', icon: '🎲',
    desc: 'Random number + win/lose check',
    load: (ws) => {
      // set roll = random(1, 6)
      const setRoll = ws.newBlock('variables_set'); setRoll.initSvg(); setRoll.render(); setRoll.moveBy(80, 80)
      const rnd = ws.newBlock('math_random_int'); rnd.initSvg(); rnd.render()
      setRoll.getInput('VALUE')?.connection?.connect(rnd.outputConnection!)
      const from1 = ws.newBlock('math_number'); from1.setFieldValue('1', 'NUM'); from1.initSvg(); from1.render()
      rnd.getInput('FROM')?.connection?.connect(from1.outputConnection!)
      const to6 = ws.newBlock('math_number'); to6.setFieldValue('6', 'NUM'); to6.initSvg(); to6.render()
      rnd.getInput('TO')?.connection?.connect(to6.outputConnection!)
      // print "You rolled: " + roll
      const pRoll = ws.newBlock('text_print'); pRoll.initSvg(); pRoll.render()
      setRoll.nextConnection?.connect(pRoll.previousConnection!)
      const j1 = ws.newBlock('text_join'); j1.initSvg(); j1.render()
      pRoll.getInput('VALUE')?.connection?.connect(j1.outputConnection!)
      const lblRoll = ws.newBlock('text'); lblRoll.setFieldValue('You rolled: ', 'TEXT'); lblRoll.initSvg(); lblRoll.render()
      j1.getInput('ADD0')?.connection?.connect(lblRoll.outputConnection!)
      const getRoll1 = ws.newBlock('variables_get'); getRoll1.initSvg(); getRoll1.render()
      j1.getInput('ADD1')?.connection?.connect(getRoll1.outputConnection!)
      // if roll >= 4: print "Big roll! WIN 🎉" else: print "Small roll 😅"
      const ifBlock = ws.newBlock('controls_ifelse'); ifBlock.initSvg(); ifBlock.render()
      pRoll.nextConnection?.connect(ifBlock.previousConnection!)
      const cmp = ws.newBlock('logic_compare'); cmp.setFieldValue('GTE', 'OP'); cmp.initSvg(); cmp.render()
      ifBlock.getInput('IF0')?.connection?.connect(cmp.outputConnection!)
      const getRoll2 = ws.newBlock('variables_get'); getRoll2.initSvg(); getRoll2.render()
      cmp.getInput('A')?.connection?.connect(getRoll2.outputConnection!)
      const n4 = ws.newBlock('math_number'); n4.setFieldValue('4', 'NUM'); n4.initSvg(); n4.render()
      cmp.getInput('B')?.connection?.connect(n4.outputConnection!)
      const pWin = ws.newBlock('text_print'); pWin.initSvg(); pWin.render()
      ifBlock.getInput('DO0')?.connection?.connect(pWin.previousConnection!)
      const winTxt = ws.newBlock('text'); winTxt.setFieldValue('Big roll — WIN! 🎉', 'TEXT'); winTxt.initSvg(); winTxt.render()
      pWin.getInput('VALUE')?.connection?.connect(winTxt.outputConnection!)
      const pLose = ws.newBlock('text_print'); pLose.initSvg(); pLose.render()
      ifBlock.getInput('ELSE')?.connection?.connect(pLose.previousConnection!)
      const loseTxt = ws.newBlock('text'); loseTxt.setFieldValue('Small roll — try again 😅', 'TEXT'); loseTxt.initSvg(); loseTxt.render()
      pLose.getInput('VALUE')?.connection?.connect(loseTxt.outputConnection!)
    }
  },
  {
    id: 'fizzbuzz', name: 'FizzBuzz', icon: '⚡',
    desc: 'Classic loop + nested if/else',
    load: (ws) => {
      const forLoop = ws.newBlock('controls_for'); forLoop.initSvg(); forLoop.render(); forLoop.moveBy(80, 80)
      const nFrom = ws.newBlock('math_number'); nFrom.setFieldValue('1', 'NUM'); nFrom.initSvg(); nFrom.render()
      forLoop.getInput('FROM')?.connection?.connect(nFrom.outputConnection!)
      const nTo = ws.newBlock('math_number'); nTo.setFieldValue('15', 'NUM'); nTo.initSvg(); nTo.render()
      forLoop.getInput('TO')?.connection?.connect(nTo.outputConnection!)
      const nBy = ws.newBlock('math_number'); nBy.setFieldValue('1', 'NUM'); nBy.initSvg(); nBy.render()
      forLoop.getInput('BY')?.connection?.connect(nBy.outputConnection!)
      // outer if: i%3===0
      const outerIf = ws.newBlock('controls_ifelse'); outerIf.initSvg(); outerIf.render()
      forLoop.getInput('DO')?.connection?.connect(outerIf.previousConnection!)
      const cmp3 = ws.newBlock('logic_compare'); cmp3.setFieldValue('EQ', 'OP'); cmp3.initSvg(); cmp3.render()
      outerIf.getInput('IF0')?.connection?.connect(cmp3.outputConnection!)
      const mod3 = ws.newBlock('math_modulo'); mod3.initSvg(); mod3.render()
      cmp3.getInput('A')?.connection?.connect(mod3.outputConnection!)
      const getI1 = ws.newBlock('variables_get'); getI1.initSvg(); getI1.render()
      mod3.getInput('DIVIDEND')?.connection?.connect(getI1.outputConnection!)
      const n3 = ws.newBlock('math_number'); n3.setFieldValue('3', 'NUM'); n3.initSvg(); n3.render()
      mod3.getInput('DIVISOR')?.connection?.connect(n3.outputConnection!)
      const z1 = ws.newBlock('math_number'); z1.setFieldValue('0', 'NUM'); z1.initSvg(); z1.render()
      cmp3.getInput('B')?.connection?.connect(z1.outputConnection!)
      // true: print Fizz
      const pFizz = ws.newBlock('text_print'); pFizz.initSvg(); pFizz.render()
      outerIf.getInput('DO0')?.connection?.connect(pFizz.previousConnection!)
      const tFizz = ws.newBlock('text'); tFizz.setFieldValue('Fizz 🟢', 'TEXT'); tFizz.initSvg(); tFizz.render()
      pFizz.getInput('VALUE')?.connection?.connect(tFizz.outputConnection!)
      // else: inner if i%5===0
      const innerIf = ws.newBlock('controls_ifelse'); innerIf.initSvg(); innerIf.render()
      outerIf.getInput('ELSE')?.connection?.connect(innerIf.previousConnection!)
      const cmp5 = ws.newBlock('logic_compare'); cmp5.setFieldValue('EQ', 'OP'); cmp5.initSvg(); cmp5.render()
      innerIf.getInput('IF0')?.connection?.connect(cmp5.outputConnection!)
      const mod5 = ws.newBlock('math_modulo'); mod5.initSvg(); mod5.render()
      cmp5.getInput('A')?.connection?.connect(mod5.outputConnection!)
      const getI2 = ws.newBlock('variables_get'); getI2.initSvg(); getI2.render()
      mod5.getInput('DIVIDEND')?.connection?.connect(getI2.outputConnection!)
      const n5 = ws.newBlock('math_number'); n5.setFieldValue('5', 'NUM'); n5.initSvg(); n5.render()
      mod5.getInput('DIVISOR')?.connection?.connect(n5.outputConnection!)
      const z2 = ws.newBlock('math_number'); z2.setFieldValue('0', 'NUM'); z2.initSvg(); z2.render()
      cmp5.getInput('B')?.connection?.connect(z2.outputConnection!)
      const pBuzz = ws.newBlock('text_print'); pBuzz.initSvg(); pBuzz.render()
      innerIf.getInput('DO0')?.connection?.connect(pBuzz.previousConnection!)
      const tBuzz = ws.newBlock('text'); tBuzz.setFieldValue('Buzz 🔵', 'TEXT'); tBuzz.initSvg(); tBuzz.render()
      pBuzz.getInput('VALUE')?.connection?.connect(tBuzz.outputConnection!)
      const pNum = ws.newBlock('text_print'); pNum.initSvg(); pNum.render()
      innerIf.getInput('ELSE')?.connection?.connect(pNum.previousConnection!)
      const getI3 = ws.newBlock('variables_get'); getI3.initSvg(); getI3.render()
      pNum.getInput('VALUE')?.connection?.connect(getI3.outputConnection!)
    }
  },
  {
    id: 'list-ops', name: 'List Operations', icon: '📋',
    desc: 'Create a list, get its length and first item',
    load: (ws) => {
      // set myList = [10, 20, 30, 40, 50]
      const setList = ws.newBlock('variables_set'); setList.initSvg(); setList.render(); setList.moveBy(80, 80)
      const listCreate = ws.newBlock('lists_create_with');
      (listCreate as any).itemCount_ = 5; (listCreate as any).updateShape_?.()
      listCreate.initSvg(); listCreate.render()
      setList.getInput('VALUE')?.connection?.connect(listCreate.outputConnection!);
      [10, 20, 30, 40, 50].forEach((n, i) => {
        const num = ws.newBlock('math_number'); num.setFieldValue(String(n), 'NUM'); num.initSvg(); num.render()
        listCreate.getInput(`ADD${i}`)?.connection?.connect(num.outputConnection!)
      })
      // print length
      const p1 = ws.newBlock('text_print'); p1.initSvg(); p1.render()
      setList.nextConnection?.connect(p1.previousConnection!)
      const j1 = ws.newBlock('text_join');
      (j1 as any).itemCount_ = 3; (j1 as any).updateShape_?.()
      j1.initSvg(); j1.render()
      p1.getInput('VALUE')?.connection?.connect(j1.outputConnection!)
      const l1 = ws.newBlock('text'); l1.setFieldValue('List length: ', 'TEXT'); l1.initSvg(); l1.render()
      j1.getInput('ADD0')?.connection?.connect(l1.outputConnection!)
      const lenBlock = ws.newBlock('lists_length'); lenBlock.initSvg(); lenBlock.render()
      j1.getInput('ADD1')?.connection?.connect(lenBlock.outputConnection!)
      const getL1 = ws.newBlock('variables_get'); getL1.initSvg(); getL1.render()
      lenBlock.getInput('VALUE')?.connection?.connect(getL1.outputConnection!)
      const l2 = ws.newBlock('text'); l2.setFieldValue(' items', 'TEXT'); l2.initSvg(); l2.render()
      j1.getInput('ADD2')?.connection?.connect(l2.outputConnection!)
      // print first item
      const p2 = ws.newBlock('text_print'); p2.initSvg(); p2.render()
      p1.nextConnection?.connect(p2.previousConnection!)
      const j2 = ws.newBlock('text_join'); j2.initSvg(); j2.render()
      p2.getInput('VALUE')?.connection?.connect(j2.outputConnection!)
      const l3 = ws.newBlock('text'); l3.setFieldValue('First item: ', 'TEXT'); l3.initSvg(); l3.render()
      j2.getInput('ADD0')?.connection?.connect(l3.outputConnection!)
      const getIdx = ws.newBlock('lists_getIndex')
      getIdx.setFieldValue('GET', 'MODE'); getIdx.setFieldValue('FROM_START', 'WHERE')
      getIdx.initSvg(); getIdx.render()
      j2.getInput('ADD1')?.connection?.connect(getIdx.outputConnection!)
      const getL2 = ws.newBlock('variables_get'); getL2.initSvg(); getL2.render()
      getIdx.getInput('VALUE')?.connection?.connect(getL2.outputConnection!)
      const nIdx = ws.newBlock('math_number'); nIdx.setFieldValue('1', 'NUM'); nIdx.initSvg(); nIdx.render()
      getIdx.getInput('AT')?.connection?.connect(nIdx.outputConnection!)
    }
  }
]

// ─── Toolboxes (3 levels) ────────────────────────────────────────────

const TOOLBOX_BEGINNER = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category', name: '📢 Output', colour: '#a6e3a1',
      contents: [
        { kind: 'block', type: 'text_print' },
        { kind: 'block', type: 'text', fields: { TEXT: 'Hello World' } }
      ]
    },
    {
      kind: 'category', name: '🔢 Numbers', colour: '#fab387',
      contents: [
        { kind: 'block', type: 'math_number', fields: { NUM: 0 } },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_random_int',
          inputs: { FROM: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
                    TO:   { shadow: { type: 'math_number', fields: { NUM: 100 } } } } }
      ]
    },
    {
      kind: 'category', name: '🔄 Repeat', colour: '#a6e3a1',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext',
          inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 5 } } } } },
        { kind: 'block', type: 'controls_whileUntil' }
      ]
    },
    {
      kind: 'category', name: '🧠 If / Then', colour: '#89b4fa',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'controls_ifelse' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_boolean' }
      ]
    },
    { kind: 'sep' },
    {
      kind: 'category', name: '🤖 STEM Robotics', colour: '#e85d04',
      contents: [
        { kind: 'block', type: 'robot_move' },
        { kind: 'block', type: 'robot_led' },
        { kind: 'block', type: 'robot_sensor' },
        { kind: 'block', type: 'robot_tone' },
        { kind: 'block', type: 'robot_sleep' },
        { kind: 'block', type: 'robot_show_text' },
        { kind: 'block', type: 'robot_clear_screen' },
        { kind: 'block', type: 'robot_button' },
        { kind: 'block', type: 'robot_servo' }
      ]
    },
    { kind: 'sep' },
    { kind: 'category', name: '📦 Variables', categorystyle: 'variable_category', custom: 'VARIABLE' }
  ]
}

const TOOLBOX_INTERMEDIATE = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category', name: '📢 Output', colour: '#a6e3a1',
      contents: [
        { kind: 'block', type: 'text_print' },
        { kind: 'block', type: 'text_prompt_ext' }
      ]
    },
    {
      kind: 'category', name: '🧠 Logic', categorystyle: 'logic_category',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'controls_ifelse' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' }
      ]
    },
    {
      kind: 'category', name: '🔄 Loops', categorystyle: 'loop_category',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext',
          inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 10 } } } } },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for',
          inputs: { FROM: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
                    TO:   { shadow: { type: 'math_number', fields: { NUM: 10 } } },
                    BY:   { shadow: { type: 'math_number', fields: { NUM: 1 } } } } }
      ]
    },
    {
      kind: 'category', name: '🔢 Math', categorystyle: 'math_category',
      contents: [
        { kind: 'block', type: 'math_number', fields: { NUM: 0 } },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_single' },
        { kind: 'block', type: 'math_round' },
        { kind: 'block', type: 'math_modulo' },
        { kind: 'block', type: 'math_random_int',
          inputs: { FROM: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
                    TO:   { shadow: { type: 'math_number', fields: { NUM: 100 } } } } }
      ]
    },
    {
      kind: 'category', name: '💬 Text', categorystyle: 'text_category',
      contents: [
        { kind: 'block', type: 'text', fields: { TEXT: 'Hello World' } },
        { kind: 'block', type: 'text_join' },
        { kind: 'block', type: 'text_length' },
        { kind: 'block', type: 'text_changeCase' },
        { kind: 'block', type: 'text_print' }
      ]
    },
    {
      kind: 'category', name: '📋 Lists', categorystyle: 'list_category',
      contents: [
        { kind: 'block', type: 'lists_create_with' },
        { kind: 'block', type: 'lists_length' },
        { kind: 'block', type: 'lists_getIndex' },
        { kind: 'block', type: 'lists_setIndex' }
      ]
    },
    { kind: 'sep' },
    {
      kind: 'category', name: '🤖 STEM Robotics', colour: '#e85d04',
      contents: [
        { kind: 'block', type: 'robot_move' },
        { kind: 'block', type: 'robot_led' },
        { kind: 'block', type: 'robot_sensor' },
        { kind: 'block', type: 'robot_tone' },
        { kind: 'block', type: 'robot_sleep' },
        { kind: 'block', type: 'robot_show_text' },
        { kind: 'block', type: 'robot_clear_screen' },
        { kind: 'block', type: 'robot_button' },
        { kind: 'block', type: 'robot_servo' }
      ]
    },
    { kind: 'sep' },
    { kind: 'category', name: '📦 Variables', categorystyle: 'variable_category', custom: 'VARIABLE' },
    { kind: 'category', name: '🔧 Functions', categorystyle: 'procedure_category', custom: 'PROCEDURE' }
  ]
}

// ─── Toolbox ────────────────────────────────────────────────────────
const TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category', name: 'Logic', categorystyle: 'logic_category',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'controls_ifelse' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
        { kind: 'block', type: 'logic_ternary' }
      ]
    },
    {
      kind: 'category', name: 'Loops', categorystyle: 'loop_category',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext',
          inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 10 } } } } },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for',
          inputs: { FROM: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
                    TO:   { shadow: { type: 'math_number', fields: { NUM: 10 } } },
                    BY:   { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
        { kind: 'block', type: 'controls_forEach' },
        { kind: 'block', type: 'controls_flow_statements' }
      ]
    },
    {
      kind: 'category', name: 'Math', categorystyle: 'math_category',
      contents: [
        { kind: 'block', type: 'math_number', fields: { NUM: 0 } },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_single' },
        { kind: 'block', type: 'math_round' },
        { kind: 'block', type: 'math_modulo' },
        { kind: 'block', type: 'math_random_int',
          inputs: { FROM: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
                    TO:   { shadow: { type: 'math_number', fields: { NUM: 100 } } } } }
      ]
    },
    {
      kind: 'category', name: 'Text', categorystyle: 'text_category',
      contents: [
        { kind: 'block', type: 'text', fields: { TEXT: 'Hello World' } },
        { kind: 'block', type: 'text_join' },
        { kind: 'block', type: 'text_append',
          inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
        { kind: 'block', type: 'text_length' },
        { kind: 'block', type: 'text_changeCase' },
        { kind: 'block', type: 'text_trim' },
        { kind: 'block', type: 'text_print' },
        { kind: 'block', type: 'text_prompt_ext' }
      ]
    },
    {
      kind: 'category', name: 'Lists', categorystyle: 'list_category',
      contents: [
        { kind: 'block', type: 'lists_create_empty' },
        { kind: 'block', type: 'lists_create_with' },
        { kind: 'block', type: 'lists_length' },
        { kind: 'block', type: 'lists_isEmpty' },
        { kind: 'block', type: 'lists_getIndex' },
        { kind: 'block', type: 'lists_setIndex' },
        { kind: 'block', type: 'lists_sort' },
        { kind: 'block', type: 'lists_reverse' }
      ]
    },
    { kind: 'sep' },
    {
      kind: 'category', name: '🤖 STEM Robotics', colour: '#e85d04',
      contents: [
        { kind: 'block', type: 'robot_move' },
        { kind: 'block', type: 'robot_led' },
        { kind: 'block', type: 'robot_sensor' },
        { kind: 'block', type: 'robot_tone' },
        { kind: 'block', type: 'robot_sleep' },
        { kind: 'block', type: 'robot_show_text' },
        { kind: 'block', type: 'robot_clear_screen' },
        { kind: 'block', type: 'robot_button' },
        { kind: 'block', type: 'robot_servo' }
      ]
    },
    { kind: 'sep' },
    { kind: 'category', name: 'Variables', categorystyle: 'variable_category',  custom: 'VARIABLE' },
    { kind: 'category', name: 'Functions', categorystyle: 'procedure_category', custom: 'PROCEDURE' }
  ]
}
