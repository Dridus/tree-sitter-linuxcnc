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
  return seq("(", kw(keyword), ",", optional($.comment_parameters), ")");
}

const DECIMAL_RE = /[-+]?(\d+([.]\d+)?|[.]\d+)/;

function axes($, letters) {
  return choice(
    ...letters.split("").map(letter =>
      alias(
        seq(kw(letter), $._value),
        $[`${letter.toLowerCase()}_axis`]
      )
    )
  );
}

function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)))
}

function sepBy(sep, rule) {
  return optional(sepBy1(sep, rule))
}

module.exports = grammar({
  name: "linuxcnc_gcode",

  extras: $ => [
    /\s/,
    /\\( |\t|\v|\f)/,
  ],

  rules: {
    source_file: $ => sepBy(/\r?\n/, optional($.line)),

    line: $ => seq(
      field("block_delete", optional(alias("/", $.block_delete))),
      field("block_number", optional(seq(alias(/[nN]/, "N"), alias(/\d+/, $.block_number)))),
      repeat1($._word),
    ),

    _word: $ => choice(
      axes($, "ABCIJKUVWXYZ"),
      $.polar_distance,
      $.polar_angle,
      $.g,
      $.m,
      $.feed_rate,
      $.spindle_speed,
      $.tool_number,
      $._o,
      $._comment,
    ),

    polar_distance: $ => alias(seq("@", $._value), $.distance),
    polar_angle: $ => alias(seq("^", $._value), $.distance),
    feed_rate: $ => seq(alias(/[fF]/, "F"), $._value),
    spindle_speed: $ => seq(alias(/[sS]/, "S"), $._value),
    tool_number: $ => seq(alias(/[tT]/, "T"), $._value),

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

    _o: $ => seq(
      alias(/[oO]/, "O"),
      choice(
        alias(/\d+/, $.o_number),
        seq("<", alias(token(/[^>]+/), $.o_name), ">"),
        alias($.expression, $.o_indirect),
      ),
      choice(
        kw("sub"),
        seq(kw("call"), repeat($.expression)),
        seq(kw("return"), optional($.expression)),
        kw("endsub"),
        seq(kw("if"), $.expression),
        kw("endif"),
        seq(kw("while"), $.expression),
        kw("endwhile"),
        kw("break"),
        kw("continue"),
        seq(kw("repeat"), $.expression),
        kw("endrepeat"),
      ),
    ),

    _comment: $ => choice(
      $.msg,
      $.probeopen,
      $.probeclose,
      $.logopen,
      $._comment,
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

    _value: $ => choice($.literal, $.expression),

    expression: $ => seq("[", $._expr, "]"),

    _expr: $ => choice(
      prec(7, $._parameter),
      prec(7, $.literal),
      $._binary_expr,
    ),

    _parameter: $ => choice(
      seq("#<", alias(/[^>]+/, $.named_parameter), ">"),
      alias(/#\d+/, $.numbered_parameter),
    ),

    literal: $ => DECIMAL_RE,

    _binary_expr: $ => choice(
      $.pow_expr,
      $.mul_expr,
      $.div_expr,
      prec.left(5, $.mod_expr),
      prec.left(4, $.add_expr),
      prec.left(4, $.sub_expr),
      prec.left(3, $.eq_expr),
      prec.left(3, $.ne_expr),
      prec.left(3, $.gt_expr),
      prec.left(3, $.ge_expr),
      prec.left(3, $.lt_expr),
      prec.left(3, $.le_expr),
      prec.left(2, $.and_expr),
      prec.left(2, $.or_expr),
      prec.left(2, $.xor_expr),
    ),

    pow_expr: $ => prec(6, seq($._expr, "**", $._expr)),
    mul_expr: $ => prec.left(5, seq($._expr, "*", $._expr)),
    div_expr: $ => prec.left(5, seq($._expr, "/", $._expr)),
    mod_expr: $ => prec.left(5, seq($._expr, "%", $._expr)),
    add_expr: $ => prec.left(4, seq($._expr, "+", $._expr)),
    sub_expr: $ => prec.left(4, seq($._expr, "-", $._expr)),
    eq_expr: $ => prec(3, seq($._expr, kw("eq"), $._expr)),
    ne_expr: $ => prec(3, seq($._expr, kw("ne"), $._expr)),
    gt_expr: $ => prec(3, seq($._expr, kw("gt"), $._expr)),
    ge_expr: $ => prec(3, seq($._expr, kw("ge"), $._expr)),
    lt_expr: $ => prec(3, seq($._expr, kw("lt"), $._expr)),
    le_expr: $ => prec(3, seq($._expr, lw("le"), $._expr)),
    and_expr: $ => prec.left(2, seq($._expr, kw("and"), $._expr)),
    or_expr: $ => prec.left(2, seq($._expr, kw("or"), $._expr)),
    xor_expr: $ => prec.left(2, seq($._expr, kw("xor"), $._expr)),

    "function": $ => choice(
      seq(kw("ATAN"), $.expression, "/", $.expression),
      kws("ABS ACOS ASIN COS EXP FIX FUP ROUND LN SN SIN SQRT TAN EXISTS"),
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

    comment: $ => seq("(", token(prec(-1, /[^)]*/)), ")"),

    comment_parameters: $ => repeat1(
      choice(
        $._parameter,
        /[^)#]+/,
      ),
    ),
  }
});
