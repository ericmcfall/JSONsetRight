// Token kinds returned by jsonc-parser's scanner. The library declares these as a TypeScript
// "const enum", which can't be imported under this project's isolatedModules setting, so the
// values (from jsonc-parser's SyntaxKind) are repeated here.
import type { SyntaxKind } from "jsonc-parser";

export const Token = {
  CloseBrace: 2 as SyntaxKind,
  CloseBracket: 4 as SyntaxKind,
  Comma: 5 as SyntaxKind,
  LineComment: 12 as SyntaxKind,
  BlockComment: 13 as SyntaxKind,
  LineBreak: 14 as SyntaxKind,
  Whitespace: 15 as SyntaxKind,
  EOF: 17 as SyntaxKind,
};

export function isTrivia(token: SyntaxKind): boolean {
  return (
    token === Token.Whitespace ||
    token === Token.LineBreak ||
    token === Token.LineComment ||
    token === Token.BlockComment
  );
}
