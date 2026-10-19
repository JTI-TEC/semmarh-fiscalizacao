/* ───────────────────────────────────────────────────────────────────────────
   CONFIGURAÇÃO DO SISTEMA — este é o ÚNICO arquivo que você edita.
   Cole abaixo o endereço (URL) da API publicada no Apps Script (termina em /exec).
   Este endereço NÃO é uma senha: sem login, ninguém acessa os dados.
   NUNCA coloque senhas, chaves ou tokens neste arquivo (ele é público no GitHub).
   ─────────────────────────────────────────────────────────────────────────── */
window.SEMMARH_CONFIG = {
  API_URL: 'COLE_AQUI_A_URL_DO_APPS_SCRIPT',
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
