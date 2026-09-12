``
compozy exec \
  --ide claude \
  --model opus \
  --prompt-file task-condominio-completo.md
``

compozy exec \
  --ide opencode \
  --model opencode/mimo-v2.5-free \
  --add-dir . \
  --prompt-file code-review.md

compozy exec \
--ide claude \
--model haiku \
--prompt-file task-imlementacao.md \
--verbose

compozy exec \
--ide claude \
--model haiku \
--prompt-file fase8-devops.md


  compozy exec --verbose --ide claude --model haiku --prompt-file task-condominio-completo.md
