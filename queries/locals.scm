(sub) @local.scope

(assignment
  (numbered_parameter) @local.definition
  (#match? @local.definition "^([0-9]|[12][0-9]|30)$"))

(
  (numbered_parameter) @local.reference
  (#match? @local.reference "^([0-9]|[12][0-9]|30)$"))
