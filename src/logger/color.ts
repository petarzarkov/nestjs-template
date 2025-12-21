// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',

  // Bright foreground colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // Bright background colors
  bgBrightRed: '\x1b[101m',
  bgBrightGreen: '\x1b[102m',
  bgBrightYellow: '\x1b[103m',
  bgBrightBlue: '\x1b[104m',
  bgBrightMagenta: '\x1b[105m',
  bgBrightCyan: '\x1b[106m',
  bgBrightWhite: '\x1b[107m',
} as const;

export class Color {
  static black(text: string): string {
    return `${colors.black}${text}${colors.reset}`;
  }

  static red(text: string): string {
    return `${colors.red}${text}${colors.reset}`;
  }

  static green(text: string): string {
    return `${colors.green}${text}${colors.reset}`;
  }

  static yellow(text: string): string {
    return `${colors.yellow}${text}${colors.reset}`;
  }

  static blue(text: string): string {
    return `${colors.blue}${text}${colors.reset}`;
  }

  static magenta(text: string): string {
    return `${colors.magenta}${text}${colors.reset}`;
  }

  static cyan(text: string): string {
    return `${colors.cyan}${text}${colors.reset}`;
  }

  static white(text: string): string {
    return `${colors.white}${text}${colors.reset}`;
  }

  static gray(text: string): string {
    return `${colors.dim}${text}${colors.reset}`;
  }

  // Bright variants
  static brightRed(text: string): string {
    return `${colors.brightRed}${text}${colors.reset}`;
  }

  static brightGreen(text: string): string {
    return `${colors.brightGreen}${text}${colors.reset}`;
  }

  static brightYellow(text: string): string {
    return `${colors.brightYellow}${text}${colors.reset}`;
  }

  static brightBlue(text: string): string {
    return `${colors.brightBlue}${text}${colors.reset}`;
  }

  static brightMagenta(text: string): string {
    return `${colors.brightMagenta}${text}${colors.reset}`;
  }

  static brightCyan(text: string): string {
    return `${colors.brightCyan}${text}${colors.reset}`;
  }

  static brightWhite(text: string): string {
    return `${colors.brightWhite}${text}${colors.reset}`;
  }

  // Background variants
  static bgRed(text: string): string {
    return `${colors.bgRed}${text}${colors.reset}`;
  }

  static bgGreen(text: string): string {
    return `${colors.bgGreen}${text}${colors.reset}`;
  }

  static bgYellow(text: string): string {
    return `${colors.bgYellow}${text}${colors.reset}`;
  }

  static bgBlue(text: string): string {
    return `${colors.bgBlue}${text}${colors.reset}`;
  }

  static bgMagenta(text: string): string {
    return `${colors.bgMagenta}${text}${colors.reset}`;
  }

  static bgCyan(text: string): string {
    return `${colors.bgCyan}${text}${colors.reset}`;
  }

  static bgWhite(text: string): string {
    return `${colors.bgWhite}${text}${colors.reset}`;
  }

  // Combined styles
  static bgRedWhite(text: string): string {
    return `${colors.bgRed}${colors.white}${text}${colors.reset}`;
  }

  static bgGreenBlack(text: string): string {
    return `${colors.bgGreen}${colors.black}${text}${colors.reset}`;
  }

  static bgYellowBlack(text: string): string {
    return `${colors.bgYellow}${colors.black}${text}${colors.reset}`;
  }

  static bgBlueWhite(text: string): string {
    return `${colors.bgBlue}${colors.white}${text}${colors.reset}`;
  }

  static bgMagentaWhite(text: string): string {
    return `${colors.bgMagenta}${colors.white}${text}${colors.reset}`;
  }

  static bgCyanBlack(text: string): string {
    return `${colors.bgCyan}${colors.black}${text}${colors.reset}`;
  }

  static bgWhiteBlack(text: string): string {
    return `${colors.bgWhite}${colors.black}${text}${colors.reset}`;
  }
}
