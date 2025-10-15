// src/cleaveLastStatement.test.ts
import { describe, it, expect } from 'vitest';
import { cleaveLastStatement } from './repl';

const J = (head: string, tail: string) => ({ head, tail });

describe('cleaveLastStatement', () => {
  it('returns empty for empty input', () => {
    expect(cleaveLastStatement('')).toEqual(J('', ''));
  });

  it('splits a simple trailing statement', () => {
    const src = 'a = 1\nb = 2';
    expect(cleaveLastStatement(src)).toEqual(J('a = 1', 'b = 2'));
  });

  it('normalizes CRLF and still splits', () => {
    const src = 'x=1\r\n\r\ny=2\r\n';
    expect(cleaveLastStatement(src)).toEqual({ head: 'x=1\n', tail: 'y=2' });
  });

  it('does not split when last line is a block header', () => {
    const src = 'if cond:\n';
    expect(cleaveLastStatement(src)).toEqual(J(src, ''));
  });

  it('does not split when last line is within a parent block (same indent as sibling)', () => {
    const src =
`from pybricks.robotics import DriveBase
for count in range(4):
  bot.straight(100)
  bot.turn(90)`;
    expect(cleaveLastStatement(src)).toEqual(J(src, ''));
  });

  it('does not split when inside nested blocks', () => {
    const src =
`def f():
  for i in range(3):
    do_thing()
    do_other()`;
    expect(cleaveLastStatement(src)).toEqual(J(src, ''));
  });

  it('does not split when paren/bracket/brace depth is open across body', () => {
    const src =
`value = (
  1 + 2
)`;
    expect(cleaveLastStatement(src)).toEqual(J(src, ''));
  });

  it('does not split if last line is a line continuation (backslash)', () => {
    const src = 'x = 1 + 2 \\\n';
    expect(cleaveLastStatement(src)).toEqual(J(src, ''));
  });

  it('does not split if the last line ends with backslash (incomplete statement)', () => {
    const src = 'x = 1 + 2 \\\n3 \\\n';
    expect(cleaveLastStatement(src)).toEqual(J(src, ''));
  });

  it('does split when previous line had a backslash but last line completes it (should NOT split because depth/cont)', () => {
    const src = 'x = 1 + \\\n2';
    // Body has a trailing backslash → treat as continued; don’t cleave
    expect(cleaveLastStatement(src)).toEqual(J(src, ''));
  });

  it('handles colons inside strings (not a block header)', () => {
    const src = `print("key: value")\nprint("done")`;
    expect(cleaveLastStatement(src)).toEqual(J(`print("key: value")`, `print("done")`));
  });

  it('handles hashes in strings and comments on block header line', () => {
    const src =
`if ready:  # start loop
  print("hash # inside string")
  work()`;
    expect(cleaveLastStatement(src)).toEqual(J(src, ''));
  });

  it('splits when last line is dedented standalone after a block', () => {
    const src =
`if x:
  a = 1
b = 2`;
    expect(cleaveLastStatement(src)).toEqual(J(`if x:\n  a = 1`, `b = 2`));
  });

  it('keeps trailing newline behavior stable', () => {
    const src = 'a=1\nb=2\n';
    expect(cleaveLastStatement(src)).toEqual(J('a=1\n', 'b=2'));
  });

  it('single line input yields tail (since it is the last statement)', () => {
    const src = 'print(42)';
    expect(cleaveLastStatement(src)).toEqual(J('', 'print(42)'));
  });

  it('for loop doesn\'t cleave turn(90)', () => {
    const src =
`for count in range(4):
  bot.straight(100)
  bot.turn(90)
`;
    expect(cleaveLastStatement(src)).toEqual(J(`for count in range(4):
  bot.straight(100)
  bot.turn(90)
`, ''));
  });
});
