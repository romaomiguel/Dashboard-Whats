/**
 * Substituto de `server-only` nos testes.
 *
 * O pacote real lança ao ser importado fora de um Server Component, e o
 * ambiente do Vitest é jsdom. Como o que se testa aqui é a lógica do módulo,
 * e não onde o Next permite executá-lo, o guard é trocado por nada.
 */
export {}
