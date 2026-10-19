/* ───────────────────────────────────────────────────────────────────────────
   CONFIGURAÇÃO DO SISTEMA — este é o ÚNICO arquivo que você edita.
   Cole abaixo o endereço (URL) da API publicada no Apps Script (termina em /exec).
   Este endereço NÃO é uma senha: sem login, ninguém acessa os dados.
   NUNCA coloque senhas, chaves ou tokens neste arquivo (ele é público no GitHub).
   ─────────────────────────────────────────────────────────────────────────── */
window.SEMMARH_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyX_E9qD6ALUY65qq6N5LjFwBEeFB6LQ27u8ChXjzWZYOhBHB3N8R0P1aYgk8096RJO/exec',
  TIMEOUT_MS: 60000,

  // Módulos opcionais: troque true por false para esconder.
  MODULOS: {
    agenda: true,
    acoesRapidas: true,
    ultimasNotificacoes: true,
    cadastros: true,
    comparecimento: true
  }
};
