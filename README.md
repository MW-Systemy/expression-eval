# expression-eval

[![Latest NPM release](https://img.shields.io/npm/v/expression-eval.svg)](https://www.npmjs.com/package/expression-eval)
[![Minzipped size](https://badgen.net/bundlephobia/minzip/expression-eval)](https://bundlephobia.com/result?p=expression-eval)
[![License](https://img.shields.io/npm/l/expression-eval.svg)](https://github.com/donmccurdy/expression-eval/blob/master/LICENSE)
[![Build Status](https://travis-ci.com/donmccurdy/expression-eval.svg?branch=master)](https://travis-ci.com/donmccurdy/expression-eval)

JavaScript expression parsing and evaluation.

Powered by [jsep](https://github.com/soney/jsep).

## Installation

```
npm install --save expression-eval
```

## API

### Parsing

```javascript
const expr = require('expression-eval');
const ast = expr.parse('1 + foo');
```

The result of the parse is an AST (abstract syntax tree), like:

```json
{
  "type": "BinaryExpression",
  "operator": "+",
  "left": {
    "type": "Literal",
    "value": 1,
    "raw": "1"
  },
  "right": {
    "type": "Identifier",
    "name": "foo"
  }
}
```

### Evaluation

```javascript
const expr = require('expression-eval');
const ast = expr.parse('a + b / c'); // abstract syntax tree (AST)
const value = expr.eval(ast, {a: 2, b: 2, c: 5}); // 2.4
```

Alternatively, use `evalAsync` for asynchronous evaluation.

### Compilation

```javascript
const expr = require('expression-eval');
const fn = expr.compile('foo.bar + 10');
fn({foo: {bar: 'baz'}}); // 'baz10'
```

Alternatively, use `compileAsync` for asynchronous compilation.

## Security

**This fork differs from upstream here, and that is the reason it exists.**

Upstream documents that it _cannot guarantee that user-provided expressions, or user-provided inputs to evaluation, will not modify the state or behavior of your application_, and gives this example:

```js
const ast = expr.parse('foo[bar](baz)()');
expr.eval(ast, {
  foo: String,
  bar: 'constructor',
  baz: 'console.log("im in ur logs");'
});
// upstream prints: "im in ur logs"
// this fork throws: UnsafeExpressionError
```

That advice — do not evaluate untrusted expressions — is sound for a general-purpose library and unusable for the application this fork serves, which stores expressions written by one user and renders them for another. The capability is therefore removed rather than documented around.

### What is refused

Both are refused at **evaluation**, throwing `UnsafeExpressionError`:

- **`CallExpression`** — nothing may be invoked. This alone closes the hole: a constructor reached without a call is an inert object.
- **computed `MemberExpression`** (`a[b]`) — a property name computed at runtime is how `"constructor"` is reached without writing it as an identifier.

Static member access (`a.b`) is untouched, being neither of those.

```js
expr.compile('1 + foo')({foo: 2});        // 3
expr.compile('a[b]')({a: {}, b: 'x'});    // throws UnsafeExpressionError
expr.compile('f()')({f: () => 1});        // throws UnsafeExpressionError
```

### Why evaluation and not parsing

Short-circuiting stays honest: `true || f()` still returns `true` without touching `f()`, exactly as before. A node that is never evaluated never ran, so this is sufficient. A caller wanting the stronger guarantee that such an expression cannot even *compile* should walk the AST from `parse()` first — refusing eagerly inside the library would change the language's semantics rather than only its capabilities.

### Still your problem

Narrowing the grammar does not make arbitrary input safe. Expressions can still be slow, can still read anything you put in the context object, and can still return values your application then trusts. Do not put anything in the evaluation context that the expression's author should not have.

### Relationship to `.` in this fork

This package depends on a [forked jsep](https://github.com/MW-Systemy/jsep) in which `.` is an identifier character, so `foo.bar` parses as a single `Identifier` named `"foo.bar"` and resolves against the context by that whole name. Member access via `.` is therefore largely unreachable here regardless of the above.

## License

MIT License.
