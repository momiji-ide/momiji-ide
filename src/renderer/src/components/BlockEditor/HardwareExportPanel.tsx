import { useState, useMemo } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { exportHardwareCode, fileExtension, filePrefix, type HardwareTarget } from '../../utils/hardwareExport'
import { toast } from '../../utils/toast'
import { useAppStore } from '../../store/appStore'

interface Props { code: string }   // the Blockly-generated JS or Python code

export function HardwareExportPanel({ code }: Props) {
  const { settings }                  = useAppStore()
  const [target, setTarget]           = useState<HardwareTarget>('microbit')
  const [showPinGuide, setShowPinGuide] = useState(false)
  const monacoTheme                   = settings.theme === 'dark' ? 'momiji-dark' : 'momiji-light'

  const hasRobotCode = code.includes('robot.')

  const exportedCode = useMemo(
    () => exportHardwareCode(target, code),
    [target, code]
  )

  const handleDownload = () => {
    const blob = new Blob([exportedCode], { type: 'text/plain' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `${filePrefix(target)}.${fileExtension(target)}`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(`Downloaded ${a.download}`)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(exportedCode).then(() => toast.success('Copied to clipboard!'))
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          🔌 Export to Hardware
        </span>
        {!hasRobotCode && (
          <span className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--accent-yellow)22', color: 'var(--accent-yellow)', border: '1px solid var(--accent-yellow)44' }}>
            ⚠ No robot blocks found
          </span>
        )}
      </div>

      {/* Target selector */}
      <div className="flex items-center gap-3 px-3 py-2.5 flex-shrink-0"
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Target:</span>
        <div className="flex gap-1">
          {([
            { id: 'microbit', label: '🔷 Micro:bit', sub: 'MicroPython' },
            { id: 'arduino',  label: '⚡ Arduino',   sub: 'C++' },
          ] as { id: HardwareTarget; label: string; sub: string }[]).map(t => (
            <button key={t.id} onClick={() => setTarget(t.id)}
              className="flex flex-col items-start px-3 py-1.5 rounded-lg text-xs border transition-all"
              style={{
                background: target === t.id ? 'var(--accent-mauve)' : 'var(--bg-surface0)',
                color: target === t.id ? 'white' : 'var(--text)',
                borderColor: target === t.id ? 'var(--accent-mauve)' : 'var(--border)',
              }}>
              <span className="font-semibold">{t.label}</span>
              <span style={{ fontSize: 9, opacity: 0.8 }}>{t.sub}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowPinGuide(g => !g)}
          className="ml-auto text-xs px-2 py-1 rounded border"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          {showPinGuide ? '✕ Hide' : '📌 Pin Guide'}
        </button>
      </div>

      {/* Pin guide */}
      {showPinGuide && (
        <div className="px-3 py-2 text-xs flex-shrink-0 overflow-x-auto"
          style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
          {target === 'microbit' ? (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ color: 'var(--accent-mauve)' }}>
                  <th style={{ textAlign:'left', padding:'2px 10px 2px 0', fontWeight:600 }}>Component</th>
                  <th style={{ textAlign:'left', padding:'2px 10px 2px 0', fontWeight:600 }}>Micro:bit Pin</th>
                  <th style={{ textAlign:'left', padding:'2px 0', fontWeight:600 }}>Notes</th>
                </tr>
              </thead>
              <tbody style={{ color: 'var(--text)' }}>
                {[
                  ['Left Motor FWD',   'P0',  'Write analog 0-1023'],
                  ['Left Motor BWD',   'P8',  'Write analog 0-1023'],
                  ['Right Motor FWD',  'P1',  'Write analog 0-1023'],
                  ['Right Motor BWD',  'P12', 'Write analog 0-1023'],
                  ['Line Sensor L',    'P3',  'Read digital 0/1'],
                  ['Line Sensor R',    'P4',  'Read digital 0/1'],
                  ['Servo',            'P15', 'Write analog 26-128'],
                  ['LED Display',      'Built-in', 'display.show() / display.scroll()'],
                  ['Buttons A/B',      'Built-in', 'button_a.is_pressed()'],
                ].map(([comp, pin, note]) => (
                  <tr key={comp} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '3px 10px 3px 0', color: 'var(--text-muted)' }}>{comp}</td>
                    <td style={{ padding: '3px 10px 3px 0', fontFamily: 'monospace', color: 'var(--accent-teal)' }}>{pin}</td>
                    <td style={{ padding: '3px 0', color: 'var(--text-subtle)', fontSize: 10 }}>{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ color: 'var(--accent-mauve)' }}>
                  <th style={{ textAlign:'left', padding:'2px 10px 2px 0', fontWeight:600 }}>Component</th>
                  <th style={{ textAlign:'left', padding:'2px 10px 2px 0', fontWeight:600 }}>Arduino Pin</th>
                  <th style={{ textAlign:'left', padding:'2px 0', fontWeight:600 }}>Notes</th>
                </tr>
              </thead>
              <tbody style={{ color: 'var(--text)' }}>
                {[
                  ['L Motor PWM FWD',  '3 (PWM)',   'analogWrite / L298N IN1'],
                  ['L Motor DIR BWD',  '4',         'digitalWrite / L298N IN2'],
                  ['R Motor PWM FWD',  '5 (PWM)',   'analogWrite / L298N IN3'],
                  ['R Motor DIR BWD',  '6',         'digitalWrite / L298N IN4'],
                  ['Line Sensor L',    '7',         'digitalRead (HIGH=on line)'],
                  ['Line Sensor R',    '8',         'digitalRead'],
                  ['Ultrasonic TRIG',  '9',         'digitalWrite'],
                  ['Ultrasonic ECHO',  '10',        'pulseIn'],
                  ['Servo',            '11 (PWM)',  'Servo.attach(11)'],
                  ['Buzzer',           '12',        'tone(pin, freq, ms)'],
                  ['Status LED',       '13',        'Built-in LED'],
                ].map(([comp, pin, note]) => (
                  <tr key={comp} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '3px 10px 3px 0', color: 'var(--text-muted)' }}>{comp}</td>
                    <td style={{ padding: '3px 10px 3px 0', fontFamily: 'monospace', color: 'var(--accent-teal)' }}>{pin}</td>
                    <td style={{ padding: '3px 0', color: 'var(--text-subtle)', fontSize: 10 }}>{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Code output */}
      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          language={target === 'microbit' ? 'python' : 'cpp'}
          value={exportedCode}
          theme={monacoTheme}
          options={{
            readOnly: true, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
            minimap: { enabled: false }, lineNumbers: 'on', scrollBeyondLastLine: false,
            wordWrap: 'off', padding: { top: 8 }, scrollbar: { verticalScrollbarSize: 4 }
          }}
        />
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ background: 'var(--bg-mantle)', borderTop: '1px solid var(--border)' }}>
        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
          {exportedCode.split('\n').length} lines ·{' '}
          {target === 'microbit' ? 'Flash with Mu Editor or Thonny' : 'Open with Arduino IDE'}
        </span>
        <div className="flex-1" />
        <button onClick={handleCopy}
          className="px-3 py-1 rounded-lg text-xs font-medium border"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          📋 Copy
        </button>
        <button onClick={handleDownload}
          className="px-3 py-1 rounded-lg text-xs font-semibold"
          style={{ background: 'var(--accent-mauve)', color: 'white', border: 'none', cursor: 'pointer' }}>
          ⬇ Download .{fileExtension(target)}
        </button>
      </div>
    </div>
  )
}
