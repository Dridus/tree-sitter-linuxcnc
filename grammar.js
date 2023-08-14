function kw(keyword) {
  return alias(caseInsensitiveRe(keyword), keyword);
}

function kws(keywords) {
  return choice(...keywords.split(" ").map(kw));
}

function caseInsensitiveRe(word) {
  return new RegExp(
    word
      .split("")
      .map(letter => {
        let lower = letter.toLowerCase();
        let upper = letter.toUpperCase();
        if (lower != upper) {
          return `[${letter.toLowerCase()}${letter.toUpperCase()}]`;
        } else {
          return letter;
        }
      })
      .join(""),
  );
}

function controlCommentWithArg(keyword, arg) {
  return seq("(", kw(keyword), ",", field("arg", alias(/[^)]*/, arg)), ")");
}

function controlComment(keyword) {
  return seq("(", kw(keyword), ")");
}

function controlCommentWithMessage($, keyword) {
  return seq("(", kw(keyword), ",", optional($._comment_parameters), ")");
}

const DECIMAL_RE = /[-+]?(\d+([.]\d+)?|[.]\d+)/;

function valueWords($, letters) {
  return choice(
    ...letters.split("").map(letter =>
      alias(
        seq(kw(letter), $._value),
        $[letter.toLowerCase()]
      )
    )
  );
}

function valueWord($, tok, name) {
  return alias(
    seq(alias(tok, tok), $._value),
    $[name]
  )
}

function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)))
}

function sepBy(sep, rule) {
  return optional(sepBy1(sep, rule))
}

function oLine($, ...body) {
  return seq(
    alias(/[oO]/, "O"),
    choice(
      alias(/\d+/, $.o_number),
      seq("<", alias(token(/[^>]+/), $.o_name), ">"),
      alias($.expression, $.o_indirect),
    ),
    ...body
  )
}

function body($) {
  return alias(repeat($.line), $.body)
}

module.exports = grammar({
  name: "linuxcnc_gcode",

  extras: $ => [
    /\s/,
    /\\( |\t|\v|\f)/,
  ],

  conflicts: $ => [
    [$.elseif],
    [$.else],
    [$.while, $.do_while],
  ],

  rules: {
    source_file: $ => repeat($.line),

    _newline: $ => /\r?\n/,

    line: $ => seq(
      field("block_delete", optional(alias("/", $.block_delete))),
      field("block_number", optional(seq(alias(/[nN]/, "N"), alias(/\d+/, $.block_number)))),
      repeat1($._wordish),
      $._newline
    ),

    _wordish: $ => choice(
      valueWords($, "ABCDEFHIJKULPQRSTVWXYZ"),
      valueWord($, "$", "spindle"),
      $.polar_distance,
      $.polar_angle,
      $.g,
      $.m,
      $.assignment,
      $._o,
      $._comment,
    ),

    polar_distance: $ => seq("@", $._value),
    polar_angle: $ => seq("^", $._value),
    assignment: $ => seq($._parameter, "=", $._value),

    g: $ => choice(
      kws("G0 G1 G2 G3 G4 G5 G5.1 G5.2 G5.3 G7 G8 G10 G17 G17.1 G18 G18.1 G19 G19.1 G20 G21"),
      kws("G28 G28.1 G30 G30.1 G33 G33.1 G38.2 G38.3 G38.4 G38.5 G40 G41 G41.1 G42 G42.1 G43"),
      kws("G43.1 G43.2 G49 G52 G53 G54 G55 G56 G57 G58 G59 G59.1 G59.2 G59.3 G61 G61.1 G64"),
      kws("G73 G74 G76 G80 G81 G82 G83 G84 G85 G86 G87 G88 G89 G90 G90.1 G91 G91.1 G92 G92.1"),
      kws("G92.2 G92.3 G93 G94 G95 G96 G97 G98 G99"),
    ),

    m: $ => choice(
      kws("M0 M1 M2 M30 M60 M3 M4 M5 M6 M7 M8 M9 M19 M48 M49 M50 M51 M52 M53 M61 M62 M63 M64"),
      kws("M65 M66 M67 M68 M70 M71 M72 M73 M98 M99"),
      alias(/[mM]1\d{2}/, "M1xx"),
    ),

    _o: $ => choice(
      $.sub,
      $.if,
      $.do,
      $.while,
      $.repeat,
      $.call,
      $["return"],
      $["break"],
      $["continue"]
    ),

    sub: $ => oLine($,
      kw("sub"),
      body($),
      $.endsub
    ),

    endsub: $ => oLine($,
      kw("endsub"),
      optional($.expression)
    ),

    if: $ => oLine($,
      kw("if"),
      field("condition", $.expression),
      $._newline,
      body($),
      repeat($.elseif),
      optional($.else),
      $.endif
    ),

    elseif: $ => oLine($,
      kw("elseif"),
      field("condition", $.expression),
      $._newline,
      body($)
    ),

    "else": $ => oLine($,
      kw("else"),
      $._newline,
      body($)
    ),

    endif: $ => oLine($, kw("endif")),

    do: $ => oLine($,
      kw("do"),
      $._newline,
      body($),
      $.do_while
    ),

    do_while: $ => oLine($,
      kw("while"),
      $.expression
    ),

    while: $ => oLine($,
      kw("while"),
      field("condition", $.expression),
      $._newline,
      body($),
      $.endwhile
    ),

    endwhile: $ => oLine($, kw("endwhile")),

    repeat: $ => oLine($,
      kw("repeat"),
      field("count", $.expression),
      $._newline,
      body($),
      $.endrepeat
    ),

    endrepeat: $ => oLine($, kw("endrepeat")),

    call: $ => oLine($, kw("call"), repeat($.expression)),
    "return": $ => oLine($, kw("return"), repeat($.expression)),
    "break": $ => oLine($, kw("break")),
    "continue": $ => oLine($, kw("continue")),

    _value: $ => choice(
      $.literal,
      $._parameter,
      $.expression
      // LinuxCNC docs claim a bare function can be used here but that seems a tad too spooky,
      // so skip on it for now
    ),

    expression: $ => seq("[", $._expr, "]"),

    _expr: $ => choice(
      prec(7, $._parameter),
      prec(7, $.literal),
      $.atan_call_expr,
      $.func_call_expr,
      $.binary_expr,
    ),

    _parameter: $ => choice(
      seq("#<", choice(
        alias(/_[^>]+/, $.named_global_parameter),
        alias(/[^_>][^>]*/, $.named_local_parameter),
      ), ">"),
      alias(/#\d+/, $.numbered_parameter),
    ),

    literal: $ => DECIMAL_RE,

    binary_expr: $ => {
      function kwop(keyword) {
        return alias(caseInsensitiveRe(keyword), $[keyword]);
      }

      function kwops(keywords, prec) {
        return keywords.split(" ").map((s) => [kwop(s), prec]);
      }

      const table = [
        [alias("**", $.pow), 6],
        [alias("*", $.mul), 5],
        [alias("/", $.div), 5],
        [kwop("mod"), 5],
        [alias("+", $.add), 4],
        [alias("-", $.sub), 4],
        ...kwops("eq ne gt ge lt le", 3),
        ...kwops("and or xor", 2)
      ];

      return choice(...table.map(([operator, precedence]) => {
        return prec.left(precedence, seq(
          field("left", $._expr),
          field("operator", operator),
          field("right", $._expr)
        ));
      }));
    },

    atan_call_expr: $ => seq(
      kw("ATAN"),
      $.expression,
      "/",
      $.expression
    ),

    func_call_expr: $ => seq(
      kws("ABS ACOS ASIN COS EXP FIX FUP ROUND LN SN SIN SQRT TAN EXISTS"),
      $.expression
    ),

    _comment: $ => choice(
      $.msg,
      $.probeopen,
      $.probeclose,
      $.logopen,
      $.logappend,
      $.logclose,
      $.log,
      $.debug,
      $.print,
      prec(-1, $.comment),
    ),

    probeopen: $ => controlCommentWithArg("probeopen", $.filename),
    probeclose: $ => controlComment("probeclose"),
    logopen: $ => controlCommentWithArg("logopen", $.filename),
    logappend: $ => controlCommentWithArg("logappend", $.filename),
    logclose: $ => controlComment("logclose"),
    msg: $ => controlCommentWithMessage($, "msg"),
    log: $ => controlCommentWithMessage($, "log"),
    debug: $ => controlCommentWithMessage($, "debug"),
    print: $ => controlCommentWithMessage($, "print"),

    comment: $ => choice(
      seq("(", token(prec(-1, /[^)]*/)), ")"),
      seq(";", /[^\r\n]*/)
    ),

    _comment_parameters: $ => repeat1(
      choice(
        $._parameter,
        /[^)#]+/,
      ),
    ),
  }
});
