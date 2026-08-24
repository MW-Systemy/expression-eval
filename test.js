const expr = require('./');
const assert = require('assert');

// Expressions that evaluate, and to what.
const fixtures = [

  // array expression
  {expr: '([1,true,"three"]).length',  expected: 3     },

  // binary expression
  {expr: '1+2',         expected: 3},
  {expr: '2-1',         expected: 1},
  {expr: '2*2',         expected: 4},
  {expr: '6/3',         expected: 2},
  {expr: '5|3',         expected: 7},
  {expr: '5&3',         expected: 1},
  {expr: '5^3',         expected: 6},
  {expr: '4<<2',        expected: 16},
  {expr: '256>>4',      expected: 16},
  {expr: '-14>>>2',     expected: 1073741820},
  {expr: '10%6',        expected: 4},
  {expr: '"a"+"b"',     expected: 'ab'},
  {expr: 'one + three', expected: 4},

  // conditional expression
  {expr: '(true ? "true" : "false")',               expected: 'true'  },
  {expr: '( ( bool || false ) ? "true" : "false")', expected: 'true'  },
  {expr: '( true ? ( 123*456 ) : "false")',         expected: 123*456 },
  {expr: '( false ? "true" : one + two )',          expected: 3       },

  // identifier
  {expr: 'string', expected: 'string' },
  {expr: 'number', expected: 123      },
  {expr: 'bool',   expected: true     },

  // literal
  {expr: '"foo"', expected: 'foo' }, // string literal
  {expr: "'foo'", expected: 'foo' }, // string literal
  {expr: '123',   expected: 123   }, // numeric literal
  {expr: 'true',  expected: true  }, // boolean literal

  // logical expression
  {expr: 'true || false',   expected: true  },
  {expr: 'true && false',   expected: false },
  {expr: '1 == "1"',        expected: true  },
  {expr: '2 != "2"',        expected: false },
  {expr: '1.234 === 1.234', expected: true  },
  {expr: '123 !== "123"',   expected: true  },
  {expr: '1 < 2',           expected: true  },
  {expr: '1 > 2',           expected: false },
  {expr: '2 <= 2',          expected: true  },
  {expr: '1 >= 2',          expected: false },

  // Logical short-circuiting still skips the right-hand side entirely. These matter
  // more than they look: refusal happens at evaluation, so an un-evaluated call must
  // stay un-evaluated rather than becoming an error.
  {expr: 'true || throw()',  expected: true  },
  {expr: 'false || true',    expected: true  },
  {expr: 'false && throw()', expected: false },
  {expr: 'true && false',    expected: false },

  // unary expression
  {expr: '-one',   expected: -1   },
  {expr: '+two',   expected: 2    },
  {expr: '!false', expected: true },
  {expr: '!!true', expected: true },
  {expr: '~15',    expected: -16  },
  {expr: '+[]',    expected: 0    },

];

// Constructs this fork refuses. Each must throw UnsafeExpressionError — not return
// undefined, which would make a rejected expression indistinguishable from one that
// legitimately evaluated to nothing.
const refused = [
  // the payload this fork exists to stop, and its pieces
  'x["constructor"]["constructor"]("return 40+2")()',
  'x["constructor"]',

  // calls of every shape
  'func(5)',
  'func(1+2)',
  'isArray([1,2,3])',

  // computed member access
  '([1,2,3])[0]',
  '(["one","two","three"])[1]',
  '([true,false,true])[2]',
  'list[3]',
  'numMap[1 + two]',
  'foo["bar"]',
];

// Behaviour inherited from the forked jsep this package depends on, recorded because
// it surprises anyone arriving from upstream: `.` is an identifier character here, so
// `foo.bar` is a single Identifier named "foo.bar" rather than member access. These
// resolve against the context by that whole name, and are undefined when absent.
// They were already failing before calls were refused; the expectations describe what
// this fork actually does.
const dottedIdentifiers = [
  {expr: 'foo.bar',    expected: undefined},
  {expr: 'this.three', expected: undefined},
  {expr: 'dotted.name', expected: 'resolved by full name'},
];

const context = {
  string: 'string',
  number: 123,
  bool: true,
  one: 1,
  two: 2,
  three: 3,
  foo: {bar: 'baz', baz: 'wow', func: function(x) { return this[x]; }},
  numMap: {10: 'ten', 3: 'three'},
  list: [1,2,3,4,5],
  func: function(x) { return x + 1; },
  isArray: Array.isArray,
  x: {},
  'dotted.name': 'resolved by full name',
  throw: () => { throw new Error('Should not be called.'); }
};

var tests = 0;
var passed = 0;

function checkValue(o, val) {
  assert.strictEqual(val, o.expected, `Failed: ${o.expr} (${val}) === ${o.expected}`);
}

[...fixtures, ...dottedIdentifiers].forEach((o) => {
  tests++;
  try {
    var val = expr.compile(o.expr)(context);
  } catch (e) {
    console.error(`Error: ${o.expr}, expected ${o.expected}`);
    throw e;
  }
  checkValue(o, val);
  passed++;
});

refused.forEach((source) => {
  tests++;
  assert.throws(
    () => expr.compile(source)(context),
    (e) => e instanceof expr.UnsafeExpressionError,
    `Expected ${source} to be refused with UnsafeExpressionError`
  );
  passed++;
});

async function testAsync() {
  for (let o of [...fixtures, ...dottedIdentifiers]) {
    tests++;
    try {
      var val = await expr.compileAsync(o.expr)(context);
    } catch (e) {
      console.error(`Error: ${o.expr}, expected ${o.expected}`);
      throw e;
    }
    checkValue(o, val);
    passed++;
  }
  for (let source of refused) {
    tests++;
    await assert.rejects(
      async () => expr.compileAsync(source)(context),
      (e) => e instanceof expr.UnsafeExpressionError,
      `Expected async ${source} to be refused with UnsafeExpressionError`
    );
    passed++;
  }
}

testAsync().then(() => {
  console.log('%s/%s tests passed.', passed, tests);
})
