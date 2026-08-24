const jsep = require('jsep/src/jsep.js');

/**
 * Evaluation code from JSEP project, under MIT License.
 * Copyright (c) 2013 Stephen Oney, http://jsep.from.so/
 */

/**
 * Thrown for a construct this fork refuses to evaluate.
 *
 * ## Why this fork refuses anything
 *
 * Upstream `expression-eval` evaluates call syntax and computed member access, and
 * that combination is an arbitrary-code-execution primitive whenever the expression
 * itself is untrusted input:
 *
 *     x["constructor"]["constructor"]("return 40+2")()   //=> 42
 *
 * `x` need not be anything special — every object leads to `Function` through its
 * constructor. Any application that stores user-authored expressions and evaluates
 * them later is therefore one stored string away from running attacker code.
 *
 * Upstream's position is that the caller should not feed it untrusted input. That is
 * a reasonable stance for a general-purpose library and a poor one for this fork,
 * whose only consumer evaluates expressions typed by one user and rendered for
 * another. So the capability is removed rather than documented around.
 *
 * ## What is refused
 *
 *   - `CallExpression` — nothing may be invoked. This alone closes the hole: a
 *     constructor reached without a call is an inert object.
 *   - computed `MemberExpression` (`a[b]`) — a property name computed at runtime is
 *     how an attacker reaches `"constructor"` without writing it as an identifier.
 *
 * Static member access (`a.b`) is untouched, being neither of those. Note it is also
 * largely unreachable here: the forked jsep this package depends on treats `.` as an
 * identifier character, so `foo.bar` parses as one Identifier named `"foo.bar"`.
 *
 * ## When it is refused
 *
 * At evaluation, not at parse. That keeps short-circuiting honest — `true || f()`
 * still returns `true` without touching `f()`, as it always did — and it is
 * sufficient, because a refused node that is never evaluated never ran. A caller
 * wanting the stricter guarantee that such an expression cannot even compile should
 * walk the AST from `parse()` before evaluating; refusing eagerly here would change
 * the language's semantics rather than just its capabilities.
 */
class UnsafeExpressionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsafeExpressionError';
  }
}

const binops = {
  '||':  function (a, b) { return a || b; },
  '&&':  function (a, b) { return a && b; },
  '|':   function (a, b) { return a | b; },
  '^':   function (a, b) { return a ^ b; },
  '&':   function (a, b) { return a & b; },
  '==':  function (a, b) { return a == b; }, // jshint ignore:line
  '!=':  function (a, b) { return a != b; }, // jshint ignore:line
  '===': function (a, b) { return a === b; },
  '!==': function (a, b) { return a !== b; },
  '<':   function (a, b) { return a < b; },
  '>':   function (a, b) { return a > b; },
  '<=':  function (a, b) { return a <= b; },
  '>=':  function (a, b) { return a >= b; },
  '<<':  function (a, b) { return a << b; },
  '>>':  function (a, b) { return a >> b; },
  '>>>': function (a, b) { return a >>> b; },
  '+':   function (a, b) { return a + b; },
  '-':   function (a, b) { return a - b; },
  '*':   function (a, b) { return a * b; },
  '/':   function (a, b) { return a / b; },
  '%':   function (a, b) { return a % b; }
};

const unops = {
  '-' :  function (a) { return -a; },
  '+' :  function (a) { return +a; },
  '~' :  function (a) { return ~a; },
  '!' :  function (a) { return !a; },
};

function evaluateArray ( list, context ) {
  return list.map(function (v) { return evaluate(v, context); });
}

async function evaluateArrayAsync( list, context ) {
  const res = await Promise.all(list.map((v) => evaluateAsync(v, context)));
  return res;
}

function evaluateMember ( node, context ) {
  if ( node.computed ) {
    throw new UnsafeExpressionError('Computed member access (a[b]) is not supported.');
  }
  const object = evaluate(node.object, context);
  return [object, object[node.property.name]];
}

async function evaluateMemberAsync( node, context ) {
  if ( node.computed ) {
    throw new UnsafeExpressionError('Computed member access (a[b]) is not supported.');
  }
  const object = await evaluateAsync(node.object, context);
  return [object, object[node.property.name]];
}

function evaluate ( node, context ) {

  switch ( node.type ) {

    case 'ArrayExpression':
      return evaluateArray( node.elements, context );

    case 'BinaryExpression':
      return binops[ node.operator ]( evaluate( node.left, context ), evaluate( node.right, context ) );

    case 'CallExpression':
      throw new UnsafeExpressionError('Function calls are not supported.');

    case 'ConditionalExpression':
      return evaluate( node.test, context )
        ? evaluate( node.consequent, context )
        : evaluate( node.alternate, context );

    case 'Identifier':
      return context[node.name];

    case 'Literal':
      return node.value;

    case 'LogicalExpression':
      if (node.operator === '||') {
        return evaluate( node.left, context ) || evaluate( node.right, context );
      } else if (node.operator === '&&') {
        return evaluate( node.left, context ) && evaluate( node.right, context );
      }
      return binops[ node.operator ]( evaluate( node.left, context ), evaluate( node.right, context ) );

    case 'MemberExpression':
      return evaluateMember(node, context)[1];

    case 'ThisExpression':
      return context;

    case 'UnaryExpression':
      return unops[ node.operator ]( evaluate( node.argument, context ) );

    default:
      return undefined;
  }

}

async function evaluateAsync( node, context ) {

  switch ( node.type ) {

    case 'ArrayExpression':
      return await evaluateArrayAsync( node.elements, context );

    case 'BinaryExpression': {
      const [left, right] = await Promise.all([
        evaluateAsync( node.left, context ),
        evaluateAsync( node.right, context )
      ]);
      return binops[ node.operator ]( left, right );
    }

    case 'CallExpression':
      throw new UnsafeExpressionError('Function calls are not supported.');

    case 'ConditionalExpression':
      return (await evaluateAsync( node.test, context ))
        ? await evaluateAsync( node.consequent, context )
        : await evaluateAsync( node.alternate, context );

    case 'Identifier':
      return context[node.name];

    case 'Literal':
      return node.value;

    case 'LogicalExpression': {
      if (node.operator === '||') {
        return (
          (await evaluateAsync( node.left, context )) ||
          (await evaluateAsync( node.right, context ))
        );
      } else if (node.operator === '&&') {
        return (
          (await evaluateAsync( node.left, context )) &&
          (await evaluateAsync( node.right, context ))
        );
      }

      const [left, right] = await Promise.all([
        evaluateAsync( node.left, context ),
        evaluateAsync( node.right, context )
      ]);

      return binops[ node.operator ]( left, right );
    }

    case 'MemberExpression':
      return (await evaluateMemberAsync(node, context))[1];

    case 'ThisExpression':
      return context;

    case 'UnaryExpression':
      return unops[ node.operator ](await evaluateAsync( node.argument, context ));

    default:
      return undefined;
  }
}

function compile (expression) {
  return evaluate.bind(null, jsep(expression));
}

function compileAsync(expression) {
  return evaluateAsync.bind(null, jsep(expression));
}

module.exports = {
  parse: jsep,
  eval: evaluate,
  evalAsync: evaluateAsync,
  compile: compile,
  compileAsync: compileAsync,
  // Exported so a caller can tell "you may not do that" apart from "that is not
  // valid syntax" — the two want different messages in front of a user.
  UnsafeExpressionError: UnsafeExpressionError
};
