// ─── Hardware Export — Momiji IDE ────────────────────────────────────────────
// Transpiles Blockly-generated code (robot.xxx() API calls) to real
// hardware code: Micro:bit MicroPython or Arduino C++.

export type HardwareTarget = 'microbit' | 'arduino'

// ─── Shared robot API regex replacers ─────────────────────────────────────────
// These patterns cover what the Blockly robot_xxx generators emit.

interface ReplaceRule { from: RegExp; to: string | ((m: RegExpMatchArray) => string) }

const MOVE_MAP: Record<string, string> = {
  FORWARD: 'forward', BACKWARD: 'backward', LEFT: 'left', RIGHT: 'right', STOP: 'stop'
}
const LED_DISPLAY_MAP: Record<string, string> = {
  RED:    "Image('09090:99999:99999:09990:00900')",   // heart
  GREEN:  "Image('00100:01110:11111:01110:00100')",   // star
  BLUE:   "Image.DIAMOND",
  ORANGE: "Image.HAPPY",
  OFF:    'None',
}
const LED_ARDUINO_MAP: Record<string, number> = {
  RED: 0xff0000, GREEN: 0x00ff00, BLUE: 0x0000ff, ORANGE: 0xff6600, OFF: 0
}

// ─── Micro:bit MicroPython ────────────────────────────────────────────────────
const MB_PREAMBLE = `# Momiji IDE — Micro:bit MicroPython 🍁
from microbit import *
import music

# ── Motor & Pin Config (change to match your board) ──────────
#   Default wiring: BitBot / Yahboom Tiny:bit style
L_FWD  = pin0   # left motor forward
L_BWD  = pin8   # left motor backward
R_FWD  = pin1   # right motor forward
R_BWD  = pin12  # right motor backward
LINE_L = pin3   # left line sensor
LINE_R = pin4   # right line sensor
SERVO  = pin15  # servo signal

def _speed(pct): return int(pct * 10.23)   # % → 0-1023 analog

def move_forward(pct):
    s = _speed(pct)
    L_FWD.write_analog(s); L_BWD.write_analog(0)
    R_FWD.write_analog(s); R_BWD.write_analog(0)

def move_backward(pct):
    s = _speed(pct)
    L_FWD.write_analog(0); L_BWD.write_analog(s)
    R_FWD.write_analog(0); R_BWD.write_analog(s)

def move_left(pct):
    s = _speed(pct)
    L_FWD.write_analog(0); L_BWD.write_analog(s)
    R_FWD.write_analog(s); R_BWD.write_analog(0)

def move_right(pct):
    s = _speed(pct)
    L_FWD.write_analog(s); L_BWD.write_analog(0)
    R_FWD.write_analog(0); R_BWD.write_analog(s)

def move_stop():
    for p in [L_FWD, L_BWD, R_FWD, R_BWD]: p.write_analog(0)

def set_servo(deg):
    # Maps 0-180° → ~26-128 (micro:bit analog for 0.5-2.5ms pulse at 50Hz)
    val = int(26 + (deg / 180) * 102)
    SERVO.write_analog(val)

# ─────────────────────────────────────────────────────────────
`

function robotApiToMicrobit(code: string): string {
  // motor move
  code = code.replace(/robot\.move\("FORWARD",\s*(\d+)\)/g,  'move_forward($1)')
  code = code.replace(/robot\.move\("BACKWARD",\s*(\d+)\)/g, 'move_backward($1)')
  code = code.replace(/robot\.move\("LEFT",\s*(\d+)\)/g,     'move_left($1)')
  code = code.replace(/robot\.move\("RIGHT",\s*(\d+)\)/g,    'move_right($1)')
  code = code.replace(/robot\.move\("STOP",\s*\d+\)/g,       'move_stop()')

  // LED
  for (const [color, img] of Object.entries(LED_DISPLAY_MAP)) {
    if (img === 'None') {
      code = code.replace(new RegExp(`robot\\.setLed\\("${color}"\\)`, 'g'), 'display.clear()')
    } else {
      code = code.replace(new RegExp(`robot\\.setLed\\("${color}"\\)`, 'g'), `display.show(${img})`)
    }
  }

  // sensors
  code = code.replace(/robot\.readSensor\("distance"\)/g,    'int(pin2.read_digital() * 100)')
  code = code.replace(/robot\.readSensor\("line_left"\)/g,   'LINE_L.read_digital()')
  code = code.replace(/robot\.readSensor\("line_right"\)/g,  'LINE_R.read_digital()')
  code = code.replace(/robot\.readSensor\("button_a"\)/g,    'int(button_a.is_pressed())')
  code = code.replace(/robot\.readSensor\("button_b"\)/g,    'int(button_b.is_pressed())')
  code = code.replace(/robot\.readSensor\("temperature"\)/g, 'temperature()')
  code = code.replace(/robot\.readSensor\("light"\)/g,       'display.read_light_level()')

  // tone — seconds → ms
  code = code.replace(/robot\.playTone\((\d+),\s*(\d+)\)/g, 'music.pitch($1, $2)')

  // sleep — sec → ms
  code = code.replace(/robot\.sleep\((\d+(?:\.\d+)?)\)/g,
    (_, s) => `sleep(${Math.round(parseFloat(s) * 1000)})`)

  // display text / clear
  code = code.replace(/robot\.showText\("([^"]*)",\s*\d+,\s*\d+\)/g, 'display.scroll("$1")')
  code = code.replace(/robot\.clearScreen\(\)/g, 'display.clear()')

  // servo
  code = code.replace(/robot\.setServo\("[^"]*",\s*(\d+)\)/g, 'set_servo($1)')

  // button checks
  code = code.replace(/robot\.isButtonPressed\("A"\)/g, 'button_a.is_pressed()')
  code = code.replace(/robot\.isButtonPressed\("B"\)/g, 'button_b.is_pressed()')

  // console.log / print
  code = code.replace(/console\.log\(([^)]+)\)/g, 'print($1)')

  // JS → Python: braces / semicolons / keywords
  code = code.replace(/while\s*\(true\)\s*\{/g,      'while True:')
  code = code.replace(/while\s*\((.+?)\)\s*\{/g,     'while $1:')
  code = code.replace(/if\s*\((.+?)\)\s*\{/g,        'if $1:')
  code = code.replace(/\}\s*else\s*\{/g,              'else:')
  code = code.replace(/else\s*if\s*\((.+?)\)\s*\{/g, 'elif $1:')
  code = code.replace(/for\s*\(let\s+(\w+)\s*=\s*(\d+);\s*\1\s*<\s*(\d+);\s*\1\+\+\)\s*\{/g,
    'for $1 in range($2, $3):')
  code = code.replace(/for\s*\(let\s+(\w+)\s*=\s*(\d+);\s*\1\s*<\s*(\d+);\s*\1\s*\+=\s*(\d+)\)\s*\{/g,
    'for $1 in range($2, $3, $4):')
  code = code.replace(/\}/g, '')
  code = code.replace(/;/g, '')
  code = code.replace(/\blet\s+/g, ''); code = code.replace(/\bconst\s+/g, ''); code = code.replace(/\bvar\s+/g, '')
  code = code.replace(/\/\//g, '#')
  code = code.replace(/true/g, 'True'); code = code.replace(/false/g, 'False')
  code = code.replace(/null/g, 'None'); code = code.replace(/undefined/g, 'None')
  code = code.replace(/&&/g, ' and '); code = code.replace(/\|\|/g, ' or '); code = code.replace(/!/g, 'not ')
  code = code.replace(/String\(([^)]+)\)/g, 'str($1)')
  code = code.replace(/Number\(([^)]+)\)/g, 'int($1)')

  // collapse excess blank lines
  code = code.replace(/\n{3,}/g, '\n\n')

  return code.trim()
}

export function generateMicrobitCode(jsCode: string): string {
  const body = robotApiToMicrobit(jsCode)
  return MB_PREAMBLE + '\n# ── Your Code ────────────────────────────────────\n' + body + '\n'
}

// ─── Arduino C++ ─────────────────────────────────────────────────────────────
const ARDUINO_PREAMBLE = `// Momiji IDE — Arduino Sketch 🍁
// Generated for standard L298N motor driver wiring.
// Adjust pin constants below to match your circuit.

#include <Servo.h>

// ── Pin Configuration ─────────────────────────────────────
#define MOTOR_L_FWD  3   // Left motor PWM forward
#define MOTOR_L_BWD  4   // Left motor direction
#define MOTOR_R_FWD  5   // Right motor PWM forward
#define MOTOR_R_BWD  6   // Right motor direction
#define LINE_L_PIN   7   // Left line sensor (digital)
#define LINE_R_PIN   8   // Right line sensor (digital)
#define TRIG_PIN     9   // Ultrasonic trigger
#define ECHO_PIN     10  // Ultrasonic echo
#define SERVO_PIN    11  // Servo PWM
#define BUZZER_PIN   12  // Buzzer
#define LED_PIN      13  // Status LED

Servo _servo;
// ──────────────────────────────────────────────────────────

void motor_forward(int pct) {
  int s = map(pct, 0, 100, 0, 255);
  analogWrite(MOTOR_L_FWD, s); digitalWrite(MOTOR_L_BWD, LOW);
  analogWrite(MOTOR_R_FWD, s); digitalWrite(MOTOR_R_BWD, LOW);
}
void motor_backward(int pct) {
  int s = map(pct, 0, 100, 0, 255);
  analogWrite(MOTOR_L_FWD, 0); analogWrite(MOTOR_L_BWD, s);
  analogWrite(MOTOR_R_FWD, 0); analogWrite(MOTOR_R_BWD, s);
}
void motor_left(int pct) {
  int s = map(pct, 0, 100, 0, 255);
  analogWrite(MOTOR_L_FWD, 0); analogWrite(MOTOR_L_BWD, s);
  analogWrite(MOTOR_R_FWD, s); digitalWrite(MOTOR_R_BWD, LOW);
}
void motor_right(int pct) {
  int s = map(pct, 0, 100, 0, 255);
  analogWrite(MOTOR_L_FWD, s); digitalWrite(MOTOR_L_BWD, LOW);
  analogWrite(MOTOR_R_FWD, 0); analogWrite(MOTOR_R_BWD, s);
}
void motor_stop() {
  analogWrite(MOTOR_L_FWD, 0); analogWrite(MOTOR_L_BWD, 0);
  analogWrite(MOTOR_R_FWD, 0); analogWrite(MOTOR_R_BWD, 0);
}
long read_distance() {
  digitalWrite(TRIG_PIN, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  return pulseIn(ECHO_PIN, HIGH) / 58L;
}

void setup() {
  Serial.begin(9600);
  pinMode(MOTOR_L_FWD, OUTPUT); pinMode(MOTOR_L_BWD, OUTPUT);
  pinMode(MOTOR_R_FWD, OUTPUT); pinMode(MOTOR_R_BWD, OUTPUT);
  pinMode(LINE_L_PIN,  INPUT);  pinMode(LINE_R_PIN,  INPUT);
  pinMode(TRIG_PIN,    OUTPUT); pinMode(ECHO_PIN,    INPUT);
  pinMode(BUZZER_PIN,  OUTPUT); pinMode(LED_PIN,     OUTPUT);
  _servo.attach(SERVO_PIN);
}

// ── Your Code ─────────────────────────────────────────────
void loop() {
`
const ARDUINO_SUFFIX = `}\n`

function robotApiToArduino(code: string): string {
  // motor
  code = code.replace(/robot\.move\("FORWARD",\s*(\d+)\)/g,  'motor_forward($1)')
  code = code.replace(/robot\.move\("BACKWARD",\s*(\d+)\)/g, 'motor_backward($1)')
  code = code.replace(/robot\.move\("LEFT",\s*(\d+)\)/g,     'motor_left($1)')
  code = code.replace(/robot\.move\("RIGHT",\s*(\d+)\)/g,    'motor_right($1)')
  code = code.replace(/robot\.move\("STOP",\s*\d+\)/g,       'motor_stop()')

  // LED (uses status LED on pin 13)
  for (const [color, hex] of Object.entries(LED_ARDUINO_MAP)) {
    const on = hex !== 0 ? 1 : 0
    code = code.replace(new RegExp(`robot\\.setLed\\("${color}"\\)`, 'g'),
      `digitalWrite(LED_PIN, ${on})`)
  }

  // sensors
  code = code.replace(/robot\.readSensor\("distance"\)/g,    'read_distance()')
  code = code.replace(/robot\.readSensor\("line_left"\)/g,   'digitalRead(LINE_L_PIN)')
  code = code.replace(/robot\.readSensor\("line_right"\)/g,  'digitalRead(LINE_R_PIN)')
  code = code.replace(/robot\.readSensor\("button_a"\)/g,    'digitalRead(2)')  // button on pin 2
  code = code.replace(/robot\.readSensor\("button_b"\)/g,    'digitalRead(3)')
  code = code.replace(/robot\.readSensor\("temperature"\)/g, '(analogRead(A0) * 0.48828125)')
  code = code.replace(/robot\.readSensor\("light"\)/g,       'analogRead(A1)')

  // tone
  code = code.replace(/robot\.playTone\((\d+),\s*(\d+)\)/g, 'tone(BUZZER_PIN, $1, $2)')

  // sleep — sec → ms
  code = code.replace(/robot\.sleep\((\d+(?:\.\d+)?)\)/g,
    (_, s) => `delay(${Math.round(parseFloat(s) * 1000)})`)

  // display → Serial
  code = code.replace(/robot\.showText\("([^"]*)",\s*\d+,\s*\d+\)/g, 'Serial.println("$1")')
  code = code.replace(/robot\.clearScreen\(\)/g, '// (clearScreen — no display)')

  // servo
  code = code.replace(/robot\.setServo\("[^"]*",\s*(\d+)\)/g, '_servo.write($1)')

  // buttons
  code = code.replace(/robot\.isButtonPressed\("A"\)/g, '(digitalRead(2) == HIGH)')
  code = code.replace(/robot\.isButtonPressed\("B"\)/g, '(digitalRead(3) == HIGH)')

  // console.log
  code = code.replace(/console\.log\(([^)]+)\)/g, 'Serial.println($1)')

  // Python-specific constructs (if code came from Python generator)
  code = code.replace(/print\(([^)]+)\)/g, 'Serial.println($1)')
  code = code.replace(/while True:/g, 'while (true) {')
  code = code.replace(/while (.+):/g, 'while ($1) {')
  code = code.replace(/if (.+):/g, 'if ($1) {')
  code = code.replace(/else:/g, '} else {')
  code = code.replace(/elif (.+):/g, '} else if ($1) {')

  code = code.replace(/True/g, 'true'); code = code.replace(/False/g, 'false')
  code = code.replace(/\bnot\s+/g, '!'); code = code.replace(/\band\b/g, '&&'); code = code.replace(/\bor\b/g, '||')

  // indent body lines
  code = code.split('\n').map(l => l.trim() ? '  ' + l : '').join('\n')
  code = code.replace(/\n{3,}/g, '\n\n')

  return code.trim()
}

export function generateArduinoCode(code: string): string {
  const body = robotApiToArduino(code)
  return ARDUINO_PREAMBLE + body + '\n' + ARDUINO_SUFFIX
}

// ─── Shared helper ────────────────────────────────────────────────────────────
export function exportHardwareCode(target: HardwareTarget, code: string): string {
  return target === 'microbit'
    ? generateMicrobitCode(code)
    : generateArduinoCode(code)
}

export function fileExtension(target: HardwareTarget): string {
  return target === 'microbit' ? 'py' : 'ino'
}

export function filePrefix(target: HardwareTarget): string {
  return target === 'microbit' ? 'microbit_robot' : 'arduino_robot'
}
