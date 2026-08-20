/** Espelha o enum public.midia_tipo da migration 0004. */
export const TIPOS_MIDIA = ['imagem', 'video', 'audio', 'documento'] as const

export type TipoMidia = (typeof TIPOS_MIDIA)[number]

/** Teto do WhatsApp para mídia, e o mesmo CHECK da migration. */
export const LIMITE_TAMANHO = 16 * 1024 * 1024

export const BUCKET_MIDIAS = 'midias'

export const ROTULO_TIPO: Record<TipoMidia, string> = {
  imagem: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
  documento: 'Documento',
}

export function ehTipoValido(valor: string): valor is TipoMidia {
  return (TIPOS_MIDIA as readonly string[]).includes(valor)
}

/**
 * Classifica pelo MIME que o navegador informa; o que não for imagem, vídeo
 * ou áudio entra como documento, que é o balde de tudo mais.
 */
export function tipoDoArquivo(mime: string): TipoMidia {
  if (mime.startsWith('image/')) return 'imagem'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'documento'
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/**
 * Caminho do arquivo no bucket: a primeira pasta é o id do dono, que é o que
 * a policy do storage compara com auth.uid().
 *
 * O nome guardado é higienizado — acento, espaço e barra viram traço — para
 * não depender de como cada navegador escapa a URL do objeto.
 */
export function caminhoNoBucket(ownerId: string, nomeArquivo: string): string {
  const seguro = nomeArquivo
    .normalize('NFD')
    // Faixa dos combinantes: separa o acento da letra e descarta o acento.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    // Sequência de pontos não vira nome de arquivo: sem barra não há
    // travessia, mas '..' num nome só serve para confundir quem lê o bucket.
    .replace(/\.{2,}/g, '.')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(-80)

  return `${ownerId}/${crypto.randomUUID()}-${seguro || 'arquivo'}`
}
