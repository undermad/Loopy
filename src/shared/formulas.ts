export type FormulaError = 'empty' | 'syntax' | 'unknown' | 'number' | 'cycle';

export type FormulaResult = { value: number } | { error: FormulaError; name?: string };

const MAX_LENGTH = 500;

type Token =
  { type: 'number'; value: number } | { type: 'name'; value: string } | { type: 'op'; value: string };

class Failure extends Error {
  constructor(
    readonly reason: FormulaError,
    readonly culprit?: string,
  ) {
    super(reason);
  }
}

const TOKEN =
  /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?)|(>=|<=|==|!=|[-+*/%^(),<>]))/y;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < source.length) {
    if (/^\s*$/.test(source.slice(TOKEN.lastIndex))) break;
    const match = TOKEN.exec(source);
    if (!match) throw new Failure('syntax');
    const [, number, name, op] = match;
    if (number !== undefined) tokens.push({ type: 'number', value: Number(number) });
    else if (name !== undefined) tokens.push({ type: 'name', value: name });
    else if (op !== undefined) tokens.push({ type: 'op', value: op });
  }
  return tokens;
}

const FUNCTIONS: Record<string, { arity: number | 'many'; run: (args: number[]) => number }> = {
  min: { arity: 'many', run: (args) => Math.min(...args) },
  max: { arity: 'many', run: (args) => Math.max(...args) },
  round: { arity: 1, run: ([x = 0]) => Math.round(x) },
  floor: { arity: 1, run: ([x = 0]) => Math.floor(x) },
  ceil: { arity: 1, run: ([x = 0]) => Math.ceil(x) },
  abs: { arity: 1, run: ([x = 0]) => Math.abs(x) },
  sqrt: { arity: 1, run: ([x = 0]) => Math.sqrt(x) },
  clamp: { arity: 3, run: ([x = 0, low = 0, high = 0]) => Math.min(Math.max(x, low), high) },
  if: { arity: 3, run: ([test = 0, yes = 0, no = 0]) => (test !== 0 ? yes : no) },
};

const COMPARE: Record<string, (a: number, b: number) => boolean> = {
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
  '>': (a, b) => a > b,
  '<': (a, b) => a < b,
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
};

class Parser {
  private index = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly scope: Readonly<Record<string, number>>,
  ) {}

  run(): number {
    const value = this.comparison();
    if (this.index < this.tokens.length) throw new Failure('syntax');
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private isOp(value: string): boolean {
    const token = this.peek();
    return token?.type === 'op' && token.value === value;
  }

  private expect(value: string): void {
    if (!this.isOp(value)) throw new Failure('syntax');
    this.index += 1;
  }

  private comparison(): number {
    let left = this.additive();
    for (let token = this.peek(); token?.type === 'op' && token.value in COMPARE; token = this.peek()) {
      this.index += 1;
      const compare = COMPARE[token.value];
      const right = this.additive();
      left = compare?.(left, right) ? 1 : 0;
    }
    return left;
  }

  private additive(): number {
    let value = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const plus = this.isOp('+');
      this.index += 1;
      const right = this.term();
      value = plus ? value + right : value - right;
    }
    return value;
  }

  private term(): number {
    let value = this.unary();
    for (let token = this.peek(); token?.type === 'op' && '*/%'.includes(token.value); token = this.peek()) {
      this.index += 1;
      const right = this.unary();
      value = token.value === '*' ? value * right : token.value === '/' ? value / right : value % right;
    }
    return value;
  }

  private unary(): number {
    if (this.isOp('-')) {
      this.index += 1;
      return -this.unary();
    }
    if (this.isOp('+')) {
      this.index += 1;
      return this.unary();
    }
    return this.power();
  }

  private power(): number {
    const base = this.primary();
    if (!this.isOp('^')) return base;
    this.index += 1;
    return base ** this.unary();
  }

  private primary(): number {
    const token = this.peek();
    if (!token) throw new Failure('syntax');
    this.index += 1;
    if (token.type === 'number') return token.value;
    if (token.type === 'op') {
      if (token.value !== '(') throw new Failure('syntax');
      const value = this.comparison();
      this.expect(')');
      return value;
    }
    if (this.isOp('(')) return this.call(token.value);
    const value = this.scope[token.value];
    if (value === undefined) throw new Failure('unknown', token.value);
    return value;
  }

  private call(name: string): number {
    const definition = FUNCTIONS[name.toLowerCase()];
    if (!definition) throw new Failure('unknown', name);
    this.expect('(');
    const args: number[] = [];
    if (!this.isOp(')')) {
      args.push(this.comparison());
      while (this.isOp(',')) {
        this.index += 1;
        args.push(this.comparison());
      }
    }
    this.expect(')');
    const fits = definition.arity === 'many' ? args.length > 0 : args.length === definition.arity;
    if (!fits) throw new Failure('syntax');
    return definition.run(args);
  }
}

export function evaluateFormula(expression: string, scope: Readonly<Record<string, number>>): FormulaResult {
  if (expression.trim() === '') return { error: 'empty' };
  if (expression.length > MAX_LENGTH) return { error: 'syntax' };
  try {
    const value = new Parser(tokenize(expression), scope).run();
    return Number.isFinite(value) ? { value } : { error: 'number' };
  } catch (error) {
    if (error instanceof Failure) {
      return error.culprit ? { error: error.reason, name: error.culprit } : { error: error.reason };
    }
    throw error;
  }
}

export function formulaNames(expression: string): string[] {
  try {
    const tokens = tokenize(expression);
    return tokens
      .filter((token, index) => {
        const next = tokens[index + 1];
        return token.type === 'name' && !(next?.type === 'op' && next.value === '(');
      })
      .map((token) => String(token.value));
  } catch {
    return [];
  }
}
export interface DiceRoll {
  notation: string;
  min: number;
  max: number;
  average: number;
}

const NOTATION = /^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/;
const TERM = /([+-]?)(\d*)(d?)(\d+)/g;
const MAX_DICE = 100;
const MAX_SIDES = 1000;

export function parseDice(text: string): DiceRoll | null {
  const notation = text.replace(/\s+/g, '').toLowerCase();
  if (!NOTATION.test(notation)) return null;
  let min = 0;
  let max = 0;
  let average = 0;
  let dice = 0;
  for (const [, sign, count, isDie, number] of notation.matchAll(TERM)) {
    const direction = sign === '-' ? -1 : 1;
    const value = Number(number);
    if (!isDie) {
      min += direction * value;
      max += direction * value;
      average += direction * value;
      continue;
    }
    const amount = count === '' ? 1 : Number(count);
    dice += amount;
    if (amount < 1 || value < 2 || value > MAX_SIDES || dice > MAX_DICE) return null;
    const low = amount;
    const high = amount * value;
    min += direction > 0 ? low : -high;
    max += direction > 0 ? high : -low;
    average += (direction * amount * (value + 1)) / 2;
  }
  return { notation, min, max, average };
}

export interface DiceParts {
  count: number;
  sides: number;
  modifier: number;
}

const SIMPLE = /^(\d*)d(\d+)([+-]\d+)?$/;

export function diceParts(notation: string): DiceParts | null {
  const match = SIMPLE.exec(notation.replace(/\s+/g, '').toLowerCase());
  if (!match) return null;
  return {
    count: match[1] ? Number(match[1]) : 1,
    sides: Number(match[2]),
    modifier: match[3] ? Number(match[3]) : 0,
  };
}

export function diceNotation({ count, sides, modifier }: DiceParts): string {
  const tail = modifier === 0 ? '' : modifier > 0 ? `+${String(modifier)}` : String(modifier);
  return `${String(count)}d${String(sides)}${tail}`;
}

export function rollDice(
  notation: string,
  random: () => number = Math.random,
): { total: number; rolls: number[] } | null {
  const roll = parseDice(notation);
  if (!roll) return null;
  let total = 0;
  const rolls: number[] = [];
  for (const [, sign, count, isDie, number] of roll.notation.matchAll(TERM)) {
    const direction = sign === '-' ? -1 : 1;
    const value = Number(number);
    if (!isDie) {
      total += direction * value;
      continue;
    }
    const amount = count === '' ? 1 : Number(count);
    for (let die = 0; die < amount; die += 1) {
      const face = Math.min(value, Math.floor(random() * value) + 1) * direction;
      rolls.push(face);
      total += face;
    }
  }
  return { total, rolls };
}
