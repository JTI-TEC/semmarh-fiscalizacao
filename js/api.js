/* SEMMARH — camada de comunicação com a API (Google Apps Script).
 *
 * Reproduz a interface "google.script.run.withSuccessHandler(...).withFailureHandler(...).funcao(...)"
 * usando fetch + JSON. O token da sessão fica em sessionStorage (some ao fechar a aba) e é enviado
 * em cada chamada. Nenhuma senha ou chave é guardada aqui.
 *
 * O POST usa Content-Type "text/plain" de propósito: é uma "requisição simples" do navegador e
 * dispensa o pré-voo CORS (OPTIONS), que o Apps Script não responde.
 */
(function (global) {
  'use strict';
  var cfg = global.SEMMARH_CONFIG || {};
  var CHAVE_TOKEN = 'semmarh_token';
  var CODIGOS_SESSAO = { NAO_AUTENTICADO: 1, SESSAO_INVALIDA: 1, SESSAO_EXPIRADA: 1 };

  function guardar() { try { return global.sessionStorage; } catch (e) { return null; } }
  function token() { var s = guardar(); return s ? (s.getItem(CHAVE_TOKEN) || '') : ''; }
  function definirToken(t) { var s = guardar(); if (s) s.setItem(CHAVE_TOKEN, t || ''); }
  function limparToken() { var s = guardar(); if (s) s.removeItem(CHAVE_TOKEN); }

  function urlValida() {
    return typeof cfg.API_URL === 'string' && /^https:\/\/script\.google\.com\/.+\/exec$/.test(cfg.API_URL);
  }
  function erroConfig() {
    return new Error('A URL da API ainda não foi configurada. Edite o arquivo js/config.js e cole o endereço terminado em /exec.');
  }

  function chamar(fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (!urlValida()) return Promise.reject(erroConfig());
    var controle = typeof AbortController === 'function' ? new AbortController() : null;
    var relogio = controle ? setTimeout(function () { controle.abort(); }, cfg.TIMEOUT_MS || 60000) : null;
    return fetch(cfg.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args, token: token() }),
      redirect: 'follow',
      signal: controle ? controle.signal : undefined
    }).catch(function (e) {
      throw new Error(e && e.name === 'AbortError'
        ? 'O servidor demorou demais para responder. Tente novamente.'
        : 'Não foi possível conectar ao servidor. Verifique a internet e a URL da API em js/config.js.');
    }).then(function (resp) {
      if (relogio) clearTimeout(relogio);
      return resp.json().catch(function () {
        throw new Error('Resposta inválida do servidor. Confira se a API foi publicada com acesso "Qualquer pessoa".');
      });
    }).then(function (json) {
      if (json && json.ok) return json.dados === undefined ? null : json.dados;
      var erro = new Error((json && json.mensagem) || 'Erro desconhecido.');
      erro.codigo = json && json.codigo;
      if (CODIGOS_SESSAO[erro.codigo]) {
        limparToken();
        if (typeof global.aoSessaoExpirada === 'function') global.aoSessaoExpirada(erro.message);
      }
      throw erro;
    });
  }

  function criarExecutor(aoSucesso, aoFalhar) {
    return new Proxy({}, { get: function (_, nome) {
      if (nome === 'withSuccessHandler') return function (f) { return criarExecutor(f, aoFalhar); };
      if (nome === 'withFailureHandler') return function (f) { return criarExecutor(aoSucesso, f); };
      if (typeof nome !== 'string' || nome === 'then') return undefined;
      return function () {
        var args = [nome].concat(Array.prototype.slice.call(arguments));
        chamar.apply(null, args).then(function (dados) {
          try { if (aoSucesso) aoSucesso(dados); } catch (e) { console.error(e); }
        }, function (erro) {
          try { if (aoFalhar) aoFalhar(erro); else console.error(erro); } catch (e) { console.error(e); }
        });
      };
    } });
  }

  function statusServidor() {
    if (!urlValida()) return Promise.reject(erroConfig());
    return fetch(cfg.API_URL, { method: 'GET', redirect: 'follow' })
      .catch(function () { throw new Error('sem conexão com a URL da API'); })
      .then(function (r) { return r.json().catch(function () { throw new Error('a URL não respondeu como API (publique com acesso "Qualquer pessoa")'); }); });
  }

  global.google = { script: { run: criarExecutor(null, null) } };   // compatível com o código existente
  global.SemmarhApi = { chamar: chamar, token: token, definirToken: definirToken, limparToken: limparToken, statusServidor: statusServidor };
})(window);
