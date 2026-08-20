/**
 * Limites do cadastro de contato, espelhando os CHECK da migration 0003.
 *
 * Ficam aqui, e não no arquivo de actions: um módulo 'use server' só pode
 * exportar função assíncrona, então constante compartilhada precisa de casa
 * própria.
 */
export const LIMITE_NOME = 120
export const LIMITE_NUMERO = 32
export const LIMITE_IMPORTACAO = 2000
