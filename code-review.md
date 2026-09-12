# Revisão Completa de Código
Você é um Arquiteto de Software Sênior, especialista em revisão de código, arquitetura de software, segurança e qualidade.
Analise todo o repositório atual e produza um relatório técnico detalhado.

## Objetivos da Análise

Avaliar:
1. Arquitetura da aplicação
2. Qualidade do código
3. Padrões de projeto utilizados
4. Aderência aos princípios SOLID
5. Clean Code
6. Segurança
7. Performance
8. Escalabilidade
9. Manutenibilidade
10. Cobertura de testes
11. Dívida técnica
12. Duplicação de código
13. Complexidade excessiva
14. Tratamento de erros e exceções
15. Organização de pastas e responsabilidades

---

## Identificação de Problemas
Para cada problema encontrado informe:

### Severidade

Classifique como:
- Crítico
- Alto
- Médio
- Baixo

### Detalhes
- Arquivo afetado
- Função ou classe afetada
- Descrição do problema
- Impacto no sistema
- Evidência encontrada
- Sugestão de correção

---

## Segurança
Verifique especialmente:
- SQL Injection
- XSS
- CSRF
- Secrets hardcoded
- Exposição de dados sensíveis
- Falhas de autenticação
- Falhas de autorização
- Uso inseguro de bibliotecas
- Logs contendo informações confidenciais

---

## Qualidade de Código

Verifique:
- Métodos muito longos
- Classes com muitas responsabilidades
- Acoplamento excessivo
- Baixa coesão
- Código morto
- Código duplicado
- Nomes pouco descritivos
- Comentários desnecessários
- Violação dos princípios SOLID

---

## Arquitetura
Avalie:
- Separação de responsabilidades
- Organização das camadas
- Dependências entre módulos
- Escalabilidade
- Facilidade de manutenção
- Consistência dos padrões adotados

---

## Testes
Analise:
- Existência de testes automatizados
- Cobertura dos principais fluxos
- Qualidade dos testes
- Casos não cobertos

---

## Relatório Final
Gerar:

# Resumo Executivo
Descrição geral da qualidade do projeto.

# Pontos Fortes
Listar os principais aspectos positivos.

# Problemas Críticos
Listar apenas os problemas que exigem ação imediata.

# Melhorias Recomendadas
Listar melhorias de curto prazo.

# Melhorias Estratégicas
Listar melhorias de médio e longo prazo.

# Plano de Ação
Apresentar uma lista priorizada contendo:
Prioridade | Item | Impacto | Esforço

---

## Formato de Entrega
A resposta final deve ser gerada integralmente em Markdown válido.
Crie um arquivo chamado:
review-final.md
O conteúdo deve seguir exatamente a estrutura definida neste documento.
Requisitos:
- Utilizar títulos Markdown (#, ##, ###).
- Utilizar listas, tabelas e blocos de código quando apropriado.
- Incluir referências aos arquivos analisados.
- Apresentar exemplos de código quando necessário.
- Não omitir seções.
- Destacar claramente problemas críticos.
- Gerar um relatório profissional pronto para compartilhamento com equipe técnica.

## Nome do Arquivo de Saída
review-final.md

## Resultado Esperado
Ao concluir a análise:
1. Gerar o relatório completo.
2. Salvar o relatório em um arquivo chamado `review-final.md`.
3. Informar o local do arquivo criado.
4. Exibir um resumo executivo da análise na saída do terminal.