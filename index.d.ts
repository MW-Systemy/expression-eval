import * as jsep from "jsep";

declare function compile(expression: string | jsep.Expression): (context: object) => any;
declare function compileAsync(expression: string | jsep.Expression): (context: object) => Promise<any>;
declare function evaluate(node: jsep.Expression, context: object): any;
declare function evaluateAsync(node: jsep.Expression, context: object): Promise<any>;

/**
 * Thrown at evaluation for a construct this fork refuses: a function call, or
 * computed member access (`a[b]`). See the note at the top of index.js.
 */
declare class UnsafeExpressionError extends Error {
  name: 'UnsafeExpressionError';
}

export {
  compile,
  compileAsync,
  jsep as parse,
  evaluate as eval,
  evaluateAsync as evalAsync,
  UnsafeExpressionError,
};
