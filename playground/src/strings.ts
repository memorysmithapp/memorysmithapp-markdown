// The words of MemorySmith's reading page in Brazilian Portuguese, which a host gives through
// `strings`: the page offers them to show that the package carries no language of its own.

import type { NoteStrings } from '@memorysmithapp/markdown-renderer';

export const PORTUGUESE: Partial<NoteStrings> = {
  callouts: {
    note: 'Nota',
    info: 'Informação',
    todo: 'A fazer',
    abstract: 'Resumo',
    summary: 'Resumo',
    tldr: 'Em resumo',
    tip: 'Dica',
    hint: 'Sugestão',
    important: 'Importante',
    success: 'Sucesso',
    check: 'Verificado',
    done: 'Concluído',
    question: 'Pergunta',
    help: 'Ajuda',
    faq: 'Perguntas frequentes',
    warning: 'Aviso',
    caution: 'Cuidado',
    attention: 'Atenção',
    failure: 'Falha',
    fail: 'Falhou',
    missing: 'Ausente',
    danger: 'Perigo',
    error: 'Erro',
    bug: 'Defeito',
    example: 'Exemplo',
    quote: 'Citação',
    cite: 'Citação',
  },
  footnotes: 'Notas',
  footnoteBack: (number) => `Voltar à referência ${number}`,
  pendingLink: 'Link pendente: a nota alvo ainda não existe.',
  refusedLink: 'Este endereço não é dos que a superfície de leitura segue, então o texto fica e o link não.',
  attachmentMissing: 'Este caderno não guarda nenhum arquivo com esse nome.',
  copy: 'Copiar',
  copied: 'Copiado',
  remoteImages: (hosts) =>
    hosts.length === 1
      ? `Abrir esta nota buscou uma imagem em ${hosts.join(', ')}, então esse site recebeu seu endereço e o momento em que você leu.`
      : `Abrir esta nota buscou imagens em ${hosts.length} outros sites — ${hosts.join(', ')} —, então cada um deles recebeu seu endereço e o momento em que você leu.`,
  linkChoice: (target) => `As notas a que o link “${target}” pode levar`,
  linkLeadsNowhere: 'Este link ainda não leva a lugar nenhum',
  linkLeadsToSeveral: 'Este link leva a mais de uma nota',
  targetPending: (target) =>
    `Nenhuma nota se chama “${target}” ainda. O link fica guardado e resolve sozinho quando alguma se chamar.`,
  targetNamed: (target, count) =>
    count === 1 ? `“${target}” é o nome de uma nota.` : `“${target}” é o nome de ${count} notas, cada uma em sua pasta. Escolha qual abrir.`,
  targetAliased: (target, count) =>
    count === 1
      ? `Nenhuma nota se chama “${target}”. Uma nota carrega esse apelido.`
      : `Nenhuma nota se chama “${target}”, então ele casou com ${count} notas que o carregam como apelido — e uma delas devolve o link no dia em que alguém escrever uma nota com este nome.`,
  embedSectionMissing: (section) => `A seção "${section}" não existe nesta nota.`,
  unnamedNote: 'Nota sem nome',
  loading: 'Carregando…',
  failed: 'Algo deu errado.',
  close: 'Fechar',
  cancel: 'Cancelar',
};
