[
  "sub" "endsub"
  "if" "elseif" "else" "endif"
  "do" "while" "endwhile"
  "repeat" "endrepeat"
  "call" "return" "break" "continue"
  "O" "N"
] @keyword

[
  "**" "*" "/" "mod" "+" "-"
  "eq" "ne" "gt" "ge" "lt" "le"
  "and" "or" "xor"
  "="
] @operator

[ "=" ] @punctuation
[ "[" "]" ] @punctuation.bracket

(literal) @number
"sign" @number

[
  "letter_A" "letter_B" "letter_C"
  "letter_D" "letter_E" "letter_F" "letter_H"
  "letter_I" "letter_J" "letter_K"
  "letter_L" "letter_P" "letter_Q" "letter_R" "letter_S" "letter_T"
  "letter_U" "letter_V" "letter_W"
  "letter_X" "letter_Y" "letter_Z"
  "@" "^" "$"
] @parameter

(g) @function.special
(m) @function.macro
(call [(o_name) (o_number)] @function)
(sub [(o_name) (o_number)] @function)
(endsub [(o_name) (o_number)] @function)
(return [(o_name) (o_number)] @function)
(if [(o_name) (o_number)] @label)
(elseif [(o_name) (o_number)] @label)
(else [(o_name) (o_number)] @label)
(endif [(o_name) (o_number)] @label)
(do [(o_name) (o_number)] @label)
(while [(o_name) (o_number)] @label)
(endwhile [(o_name) (o_number)] @label)
(repeat [(o_name) (o_number)] @label)
(endrepeat [(o_name) (o_number)] @label)
(break [(o_name) (o_number)] @label)
(continue [(o_name) (o_number)] @label)
(block_number) @label

(
  [ (named_local_parameter) (named_global_parameter) (numbered_parameter) ]
  @variable
)

"text" @string

(
  (control_comment
    control: _ @keyword
    arg: _? @string)
)

(comment) @comment

