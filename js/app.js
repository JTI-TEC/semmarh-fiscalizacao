/* SEMMARH — Fiscalização Ambiental (interface). Sem segredos: só conversa com a API via js/api.js */
var usuarioLogado = null;
var listaEmpreendedoresCache = [];
var assinaturaCtx = null;
var assinaturaDesenhando = false;
var listaTermosCache = [];
var listaHistoricoUnificada = [];
var paginaHistoricoAtual = 1;
var ITENS_POR_PAGINA_HISTORICO = 8;
var listaAgendaCache = [];
var assinaturaCompCtx = null;
var assinaturaCompDesenhando = false;
var listaComparecimentosCache = [];
var relatorioAtual = [];
var MAPA_BUSCA_CNPJ = {
      notif: { cpfCnpj:'notifCpfCnpj', razaoSocial:'notifRazaoSocial', logradouro:'notifLogradouro',
                numero:'notifNumeroEnd', bairro:'notifBairro', cidade:'notifCidade', uf:'notifUf',
                atividade:'notifAtividade', cep:'notifCep', status:'statusBuscaNotif' },
      cad:   { cpfCnpj:'cadCpfCnpj', razaoSocial:'cadRazaoSocial', logradouro:'cadLogradouro',
                numero:'cadNumero', bairro:'cadBairro', cidade:'cadCidade', uf:'cadUf',
                atividade:'cadAtividade', status:'statusBuscaCad' }
    };

// ═══ Utilitários de segurança e datas ═══════════════════════════════════
function esc(v) {
  return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
// Texto seguro para usar DENTRO de onclick="fn(...)" (vira um literal JS entre aspas)
function jsArg(v) { return esc(JSON.stringify(String(v === null || v === undefined ? '' : v))); }
function dois(n) { return (n < 10 ? '0' : '') + n; }
function parseDataISO(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function parseDataBR(str) {
  var m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(str || '').trim());
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return parseDataISO(str);
}
function hojeLocalISO() { var d = new Date(); return d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate()); }
function MODULO(nome) { var m = (window.SEMMARH_CONFIG || {}).MODULOS || {}; return m[nome] !== false; }
function aplicarModulos() {
  document.querySelectorAll('[data-modulo]').forEach(function (el) {
    if (!MODULO(el.getAttribute('data-modulo'))) el.classList.add('oculto');
  });
}

// ═══ Navegação, login e sessão ══════════════════════════════════════════
function mostrarPagina(nome, botao) {
  if (nome === 'admin' && (!usuarioLogado || usuarioLogado.perfil !== 'admin')) return;
  var alvo = document.getElementById('pagina-' + nome);
  if (!alvo) return;
  document.querySelectorAll('.pagina').forEach(function (p) { p.classList.remove('ativa'); });
  alvo.classList.add('ativa');
  document.querySelectorAll('.sidebar-nav button').forEach(function (b) {
    b.classList.toggle('ativo', b.getAttribute('data-pagina') === nome);
  });
  window.scrollTo(0, 0);
  if (nome === 'cadastros') carregarEmpreendedores();
  if (nome === 'notificacao') abrirNotificacao();
  if (nome === 'historico') { paginaHistoricoAtual = 1; atualizarHistoricoCompleto(); }
  if (nome === 'inicio') atualizarDashboard();
  if (nome === 'comparecimento') { requestAnimationFrame(inicializarCanvasAssinaturaComp); carregarComparecimentos(); }
  if (nome === 'admin') atualizarAdminDashboard();
}

function fazerLogin() {
  var username = document.getElementById('inputUsername').value.trim();
  var senha = document.getElementById('inputSenha').value;
  var btn = document.getElementById('btnEntrar');
  var erro = document.getElementById('erroLogin');
  erro.style.display = 'none';
  if (!username || !senha) {
    erro.textContent = 'Preencha usuário e senha.';
    erro.style.display = 'block';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Entrando...';
  google.script.run
    .withSuccessHandler(function (r) {
      btn.disabled = false;
      btn.textContent = 'Entrar';
      if (r && r.sucesso) {
        SemmarhApi.definirToken(r.token);
        usuarioLogado = r.usuario;
        document.getElementById('inputSenha').value = '';
        entrarNoSistema();
      } else {
        erro.textContent = (r && r.mensagem) || 'Não foi possível entrar.';
        erro.style.display = 'block';
      }
    })
    .withFailureHandler(function (err) {
      btn.disabled = false;
      btn.textContent = 'Entrar';
      erro.textContent = err.message;
      erro.style.display = 'block';
    })
    .autenticar(username, senha);
}

function entrarNoSistema() {
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('nomeUsuario').textContent = usuarioLogado.nome;
  document.getElementById('inicioNomeUsuario').textContent = usuarioLogado.nome;
  var ehAdmin = usuarioLogado.perfil === 'admin';
  document.querySelectorAll('[data-somente-admin]').forEach(function (el) { el.style.display = ehAdmin ? '' : 'none'; });
  mostrarPagina('inicio');
}

function sair(mensagem) {
  usuarioLogado = null;
  SemmarhApi.limparToken();
  listaTermosCache = []; listaEmpreendedoresCache = []; listaComparecimentosCache = [];
  listaAgendaCache = []; listaHistoricoUnificada = []; relatorioAtual = [];
  document.getElementById('inputUsername').value = '';
  document.getElementById('inputSenha').value = '';
  var erro = document.getElementById('erroLogin');
  if (typeof mensagem === 'string' && mensagem) { erro.textContent = mensagem; erro.style.display = 'block'; }
  else erro.style.display = 'none';
  fecharModalSenha();
  document.getElementById('app').style.display = 'none';
  document.getElementById('tela-login').style.display = 'flex';
}

// chamada pela camada de API quando o servidor diz que a sessão acabou
window.aoSessaoExpirada = function (mensagem) {
  if (usuarioLogado) sair(mensagem || 'Sessão expirada. Faça login novamente.');
};

function verificarServidor() {
  var el = document.getElementById('statusServidor');
  if (!el) return;
  SemmarhApi.statusServidor().then(function (r) {
    if (r && r.ok) {
      el.textContent = r.instalado ? 'Servidor conectado (API v' + r.versao + ')'
        : 'Servidor conectado, mas a planilha NÃO está instalada: execute setupPlanilha no Apps Script.';
      el.className = 'status-servidor ' + (r.instalado ? 'status-ok' : 'status-erro');
    } else { throw new Error('resposta inesperada'); }
  }).catch(function (e) {
    el.textContent = 'Servidor indisponível: ' + e.message;
    el.className = 'status-servidor status-erro';
  });
}

function iniciarApp() {
  aplicarModulos();
  verificarServidor();
  if (SemmarhApi.token()) {   // volta para o sistema se a sessão ainda for válida (ex.: F5)
    google.script.run
      .withSuccessHandler(function (u) { if (u) { usuarioLogado = u; entrarNoSistema(); } })
      .withFailureHandler(function () { SemmarhApi.limparToken(); })
      .sessaoAtual();
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarApp);
else iniciarApp();

// ── Alterar / redefinir senha ───────────────────────────────────────────
var modalSenhaAlvo = null;
function abrirModalSenha(alvo) {
  modalSenhaAlvo = alvo || null;
  document.getElementById('modalSenhaTitulo').textContent = alvo ? 'Redefinir senha de ' + alvo.username : 'Alterar minha senha';
  document.getElementById('modalSenhaAtualWrap').style.display = alvo ? 'none' : '';
  ['modalSenhaAtual', 'modalSenhaNova', 'modalSenhaRepete'].forEach(function (id) { document.getElementById(id).value = ''; });
  document.getElementById('modalSenhaErro').style.display = 'none';
  document.getElementById('modalSenha').style.display = 'flex';
}
function fecharModalSenha() { var m = document.getElementById('modalSenha'); if (m) m.style.display = 'none'; }
function confirmarModalSenha() {
  var atual = document.getElementById('modalSenhaAtual').value;
  var nova = document.getElementById('modalSenhaNova').value;
  var repete = document.getElementById('modalSenhaRepete').value;
  var erro = document.getElementById('modalSenhaErro');
  function falha(m) { erro.textContent = m; erro.style.display = 'block'; }
  if (nova.length < 8) return falha('A nova senha deve ter pelo menos 8 caracteres.');
  if (nova !== repete) return falha('As senhas digitadas não são iguais.');
  var ok = function (r) {
    if (!r || !r.sucesso) return falha((r && r.mensagem) || 'Não foi possível alterar a senha.');
    if (modalSenhaAlvo) { fecharModalSenha(); alert('Senha redefinida.'); }
    else { alert('Senha alterada. Entre novamente com a nova senha.'); sair(); }
  };
  var exec = google.script.run.withSuccessHandler(ok).withFailureHandler(function (e) { falha(e.message); });
  if (modalSenhaAlvo) exec.redefinirSenhaUsuario(modalSenhaAlvo.id, nova);
  else exec.alterarMinhaSenha(atual, nova);
}

// ═══ Assinatura: exporta reduzida (cabe na célula do Sheets) ════════════
function canvasVazio(canvas) {
  if (!canvas || !canvas.width) return true;
  var d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  for (var i = 3; i < d.length; i += 4) { if (d[i] !== 0) return false; }
  return true;
}
function exportarAssinatura(idCanvas) {
  var c = document.getElementById(idCanvas);
  if (canvasVazio(c)) return '';
  var w = Math.min(c.width, 360), h = Math.max(1, Math.round(c.height * w / c.width));
  var t = document.createElement('canvas');
  t.width = w; t.height = h;
  t.getContext('2d').drawImage(c, 0, 0, w, h);
  return t.toDataURL('image/png');
}

// ═══ Cadastros ══════════════════════════════════════════════════════════
function carregarEmpreendedores() {
  document.getElementById('listaCadastros').innerHTML = '<div class="vazio">Carregando...</div>';
  google.script.run
    .withSuccessHandler(function (lista) { listaEmpreendedoresCache = lista || []; renderizarListaCadastros(listaEmpreendedoresCache); })
    .withFailureHandler(function (err) { document.getElementById('listaCadastros').innerHTML = '<div class="vazio">Erro ao carregar: ' + esc(err.message) + '</div>'; })
    .listarEmpreendedores();
}

function renderizarListaCadastros(lista) {
  try {
    lista = lista || [];
    var container = document.getElementById('listaCadastros');
    if (!lista.length) { container.innerHTML = '<div class="vazio">Nenhum empreendedor cadastrado</div>'; return; }
    container.innerHTML = lista.map(function (e) {
      return '<div class="item-lista"><div class="topo-item"><div>' +
        '<div class="numero">' + esc(e.razaoSocial || '(sem nome)') + '</div>' +
        '<div class="sub">' + esc(e.cpfCnpj) + '</div></div></div>' +
        '<div class="sub" style="margin-top:6px;">' + esc(e.logradouro || '') + ', ' + esc(e.numero || '') + ' — ' + esc(e.bairro || '') + '</div>' +
        '<div class="botoes-form" style="margin-top:8px;">' +
        '<button class="outline" onclick="editarCadastro(' + jsArg(e.cpfCnpj) + ')">Editar</button>' +
        '<button class="outline" style="color:var(--vermelho-700)" onclick="excluirCadastro(' + jsArg(e.cpfCnpj) + ')">Excluir</button>' +
        '</div></div>';
    }).join('');
  } catch (erroRender) {
    var c = document.getElementById('listaCadastros');
    if (c) c.innerHTML = '<div class="vazio" style="color:var(--vermelho-700);">Erro ao exibir a lista: ' + esc(erroRender.message) + '</div>';
  }
}

// ═══ Notificações / Histórico ═══════════════════════════════════════════
function carregarTermos(callback) {
  google.script.run
    .withSuccessHandler(function (lista) { listaTermosCache = lista || []; if (callback) callback(); })
    .withFailureHandler(function (err) {
      var corpo = document.getElementById('corpoTabelaHistorico');
      if (corpo) corpo.innerHTML = '<tr><td colspan="7" class="vazio">Erro: ' + esc(err.message) + '</td></tr>';
      var ult = document.getElementById('ultimasNotificacoes');
      if (ult) ult.innerHTML = '<div class="vazio">Erro ao carregar: ' + esc(err.message) + '</div>';
    })
    .listarTermos();
}

function calcularAlertaPrazo(termo) {
  if (!termo.prazoDate || termo.status === 'Resolvido') return null;
  var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  var prazo = parseDataISO(termo.prazoDate);
  if (!prazo) return null;
  if (prazo < hoje) return 'vencido';
  if (prazo.getTime() === hoje.getTime()) return 'hoje';
  return null;
}

function montarListaUnificadaHistorico() {
  var doTermos = listaTermosCache.map(function (t, i) {
    var statusExibicao = t.status;
    if (t.status === 'Pendente' && calcularAlertaPrazo(t) === 'vencido') statusExibicao = 'Vencida';
    return { idOriginal: t.id, tipoOriginal: 'termo', numero: t.numero, empreendedor: t.razaoSocial, tipo: 'Notificação',
      data: t.data, dataOrdenacao: parseDataBR(t.data), status: statusExibicao, origem: t, ordem: i };
  });
  var base = listaTermosCache.length;
  var doComparecimentos = listaComparecimentosCache.map(function (c, i) {
    var d = parseDataISO(c.dataComparecimento) || parseDataBR(c.criadoEm);
    return { idOriginal: c.id, tipoOriginal: 'comparecimento', numero: c.termoNotificacaoNumero || '—', empreendedor: c.nomeEmpresa,
      tipo: 'Comparecimento', data: d ? dois(d.getDate()) + '/' + dois(d.getMonth() + 1) + '/' + d.getFullYear() : '',
      dataOrdenacao: d, status: 'Compareceu', origem: c, ordem: base + i };
  });
  listaHistoricoUnificada = doTermos.concat(doComparecimentos);
}

function atualizarHistoricoCompleto() {
  carregarTermos(function () {
    carregarComparecimentosParaHistorico(function () {
      montarListaUnificadaHistorico();
      renderizarHistorico();
    });
  });
}

var PODE_COMPARTILHAR_ARQUIVO = (function () {
  try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] })); }
  catch (e) { return false; }
})();

function renderizarHistorico() {
  try {
    var termoBusca = (document.getElementById('buscaHistorico').value || '').toLowerCase();
    var statusFiltro = document.getElementById('filtroStatusHistorico').value;
    var di = parseDataISO(document.getElementById('filtroDataInicioHistorico').value);
    var df = parseDataISO(document.getElementById('filtroDataFimHistorico').value);
    if (df) df = new Date(df.getFullYear(), df.getMonth(), df.getDate(), 23, 59, 59);

    var lista = listaHistoricoUnificada.slice().sort(function (a, b) {
      var da = a.dataOrdenacao ? a.dataOrdenacao.getTime() : 0;
      var db = b.dataOrdenacao ? b.dataOrdenacao.getTime() : 0;
      return db !== da ? db - da : b.ordem - a.ordem;
    });
    if (statusFiltro !== 'Todos') lista = lista.filter(function (x) { return x.status === statusFiltro; });
    if (termoBusca) lista = lista.filter(function (x) { return (x.numero + ' ' + (x.empreendedor || '')).toLowerCase().indexOf(termoBusca) !== -1; });
    if (di) lista = lista.filter(function (x) { return x.dataOrdenacao && x.dataOrdenacao >= di; });
    if (df) lista = lista.filter(function (x) { return x.dataOrdenacao && x.dataOrdenacao <= df; });

    var totalPaginas = Math.max(1, Math.ceil(lista.length / ITENS_POR_PAGINA_HISTORICO));
    if (paginaHistoricoAtual > totalPaginas) paginaHistoricoAtual = totalPaginas;
    var inicio = (paginaHistoricoAtual - 1) * ITENS_POR_PAGINA_HISTORICO;
    var pagina = lista.slice(inicio, inicio + ITENS_POR_PAGINA_HISTORICO);

    var corpo = document.getElementById('corpoTabelaHistorico');
    if (!pagina.length) {
      corpo.innerHTML = '<tr><td colspan="7" class="vazio">Nenhum registro encontrado</td></tr>';
    } else {
      corpo.innerHTML = pagina.map(function (item) {
        var badge = item.status === 'Compareceu' ? 'compareceu' : item.status === 'Resolvido' ? 'resolvido' : item.status === 'Vencida' ? 'vencida' : 'pendente';
        var statusHtml = '<span class="hist-badge ' + badge + '">' + esc(item.status) + '</span>';
        var acoes, caixa = '';
        if (item.tipoOriginal === 'termo') {
          var t = item.origem, id = jsArg(t.id);
          statusHtml += ' <select class="hist-status-sel" title="Alterar status" onchange="mudarStatusTermo(' + id + ', this.value)">' +
            ['Pendente', 'Compareceu', 'Resolvido'].map(function (s) { return '<option' + (t.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>';
          caixa = '<input type="checkbox" class="chk-termo" value="' + esc(t.id) + '" onchange="atualizarSelecaoHistorico()">';
          acoes = '<button title="Ver PDF" onclick="abrirPdfTermo(' + id + ', this)">📄</button>' +
            '<button title="Baixar PDF" onclick="baixarPdfTermo(' + id + ', this)">⬇️</button>' +
            (PODE_COMPARTILHAR_ARQUIVO ? '<button title="Compartilhar o PDF" onclick="compartilharPdfTermo(' + id + ', this)">📤</button>' : '') +
            '<a title="Enviar resumo por e-mail" href="' + esc(gerarLinkEmail(t)) + '">✉️</a>' +
            '<a title="Enviar resumo por WhatsApp" target="_blank" rel="noopener" href="' + esc(gerarLinkWhatsapp(t)) + '">💬</a>' +
            '<button title="Excluir" onclick="excluirTermoUI(' + id + ')">🗑️</button>';
        } else {
          acoes = '<button title="Excluir" onclick="excluirComparecimentoUI(' + jsArg(item.idOriginal) + ')">🗑️</button>';
        }
        return '<tr><td>' + caixa + '</td><td>' + esc(item.numero) + '</td><td>' + esc(item.empreendedor || '') + '</td><td>' +
          esc(item.tipo) + '</td><td>' + esc(item.data || '') + '</td><td>' + statusHtml + '</td><td><div class="hist-acoes-cel">' + acoes + '</div></td></tr>';
      }).join('');
    }
    renderizarPaginacaoHistorico(totalPaginas);
    atualizarSelecaoHistorico();
  } catch (erroRender) {
    document.getElementById('corpoTabelaHistorico').innerHTML =
      '<tr><td colspan="7" class="vazio" style="color:var(--vermelho-700);">Erro ao exibir a lista: ' + esc(erroRender.message) + '</td></tr>';
  }
}

// ── PDF: o servidor entrega o arquivo (privado) somente a quem está logado ──
function base64ParaBlob(b64, mime) {
  var bin = atob(b64), n = bin.length, bytes = new Uint8Array(n);
  for (var i = 0; i < n; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || 'application/pdf' });
}
function obterPdf(id) {
  return SemmarhApi.chamar('obterPdfTermo', id).then(function (r) { return { blob: base64ParaBlob(r.base64, r.mime), nome: r.nome }; });
}
function ocupado(botao, sim) {
  if (!botao) return;
  if (sim) { botao.dataset.txt = botao.textContent; botao.textContent = '⏳'; botao.disabled = true; }
  else { botao.textContent = botao.dataset.txt || botao.textContent; botao.disabled = false; }
}
function baixarArquivo(url, nome) {
  var a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
function abrirPdfTermo(id, botao) {
  var janela = window.open('', '_blank');   // abre já, para o navegador não bloquear o pop-up
  if (janela) { try { janela.document.write('<p style="font-family:sans-serif;padding:24px">Gerando o PDF...</p>'); } catch (e) { /* ignora */ } }
  ocupado(botao, true);
  obterPdf(id).then(function (p) {
    var url = URL.createObjectURL(p.blob);
    if (janela) janela.location.href = url; else baixarArquivo(url, p.nome);
    setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
  }).catch(function (err) {
    if (janela) janela.close();
    alert('Erro ao abrir o PDF: ' + err.message);
  }).then(function () { ocupado(botao, false); });
}
function baixarPdfTermo(id, botao) {
  ocupado(botao, true);
  obterPdf(id).then(function (p) {
    var url = URL.createObjectURL(p.blob);
    baixarArquivo(url, p.nome);
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }).catch(function (err) { alert('Erro ao baixar o PDF: ' + err.message); })
    .then(function () { ocupado(botao, false); });
}
function compartilharPdfTermo(id, botao) {
  ocupado(botao, true);
  obterPdf(id).then(function (p) {
    var arquivo = new File([p.blob], p.nome, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) return navigator.share({ files: [arquivo], title: p.nome });
    var url = URL.createObjectURL(p.blob);
    baixarArquivo(url, p.nome);
    alert('Este navegador não compartilha arquivos. O PDF foi baixado: anexe-o ao e-mail ou ao WhatsApp.');
  }).catch(function (err) { if (!err || err.name !== 'AbortError') alert('Erro ao compartilhar: ' + (err && err.message)); })
    .then(function () { ocupado(botao, false); });
}

// ═══ Início: últimas notificações e agenda ══════════════════════════════
function atualizarDashboard() {
  atualizarDataInicio();
  if (MODULO('ultimasNotificacoes')) {
    carregarTermos(function () {
      var ultimos = listaTermosCache.slice(-5).reverse();
      var container = document.getElementById('ultimasNotificacoes');
      if (!ultimos.length) { container.innerHTML = '<div class="vazio">Nenhuma notificação ainda</div>'; return; }
      container.innerHTML = ultimos.map(function (t) {
        return '<div class="item-lista"><div class="topo-item"><div>' +
          '<div class="numero">Nº ' + esc(t.numero) + '</div><div class="nome">' + esc(t.razaoSocial || '') + '</div></div>' +
          '<span class="badge ' + classeBadgeStatus(t.status) + '">' + esc(t.status) + '</span></div></div>';
      }).join('');
    });
  }
  if (MODULO('agenda')) carregarAgenda();
}

function carregarAgenda() {
  var container = document.getElementById('listaAgenda');
  if (container) container.innerHTML = '<div class="vazio">Carregando...</div>';
  google.script.run
    .withSuccessHandler(function (lista) { listaAgendaCache = lista || []; renderizarAgenda(); })
    .withFailureHandler(function (err) { if (container) container.innerHTML = '<div class="vazio">Erro: ' + esc(err.message) + '</div>'; })
    .listarAgenda();
}

function renderizarAgenda() {
  var container = document.getElementById('listaAgenda');
  if (!container) return;
  if (!listaAgendaCache.length) { container.innerHTML = '<div class="vazio">Nenhum compromisso cadastrado</div>'; return; }
  var hoje = hojeLocalISO();
  var ordenada = listaAgendaCache.slice().sort(function (a, b) { return ((a.data || '') + (a.horario || '')).localeCompare((b.data || '') + (b.horario || '')); });
  container.innerHTML = ordenada.map(function (c) {
    var extra = '';
    if (c.data === hoje) extra = 'agenda-hoje'; else if (c.data && c.data < hoje) extra = 'agenda-vencido';
    var dataFmt = c.data ? c.data.split('-').reverse().join('/') : '';
    return '<div class="agenda-item ' + extra + '"><div>' +
      '<div class="agenda-quando">' + esc(dataFmt) + (c.horario ? ' às ' + esc(c.horario) : '') + '</div>' +
      '<div class="agenda-desc">' + esc(c.descricao || '') + '</div></div>' +
      '<div class="agenda-acoes"><button onclick="editarCompromisso(' + jsArg(c.id) + ')">Editar</button>' +
      '<button onclick="excluirCompromissoUI(' + jsArg(c.id) + ')">Excluir</button></div></div>';
  }).join('');
}

// ═══ Comparecimento ═════════════════════════════════════════════════════
function carregarComparecimentos() {
  document.getElementById('listaComparecimentos').innerHTML = '<div class="vazio">Carregando...</div>';
  google.script.run
    .withSuccessHandler(function (lista) { listaComparecimentosCache = lista || []; renderizarListaComparecimentos(listaComparecimentosCache); })
    .withFailureHandler(function (err) { document.getElementById('listaComparecimentos').innerHTML = '<div class="vazio">Erro: ' + esc(err.message) + '</div>'; })
    .listarComparecimentos();
}

function renderizarListaComparecimentos(lista) {
  try {
    lista = lista || [];
    var container = document.getElementById('listaComparecimentos');
    if (!lista.length) { container.innerHTML = '<div class="vazio">Nenhum comparecimento registrado</div>'; return; }
    container.innerHTML = lista.slice().reverse().map(function (c) {
      return '<div class="item-lista"><div class="topo-item"><div>' +
        '<div class="numero">Termo Nº ' + esc(c.termoNotificacaoNumero || '—') + '</div>' +
        '<div class="nome">' + esc(c.nomeEmpresa || '') + '</div>' +
        '<div class="sub">Responsável: ' + esc(c.nomeResponsavel || '') + ' — ' + esc(c.dataComparecimento || '') + '</div></div></div>' +
        '<div class="botoes-form" style="margin-top:8px;"><button class="outline" style="color:var(--vermelho-700)" onclick="excluirComparecimentoUI(' + jsArg(c.id) + ')">Excluir</button></div></div>';
    }).join('');
  } catch (erroRender) {
    var c2 = document.getElementById('listaComparecimentos');
    if (c2) c2.innerHTML = '<div class="vazio" style="color:var(--vermelho-700);">Erro ao exibir a lista: ' + esc(erroRender.message) + '</div>';
  }
}

// ═══ Admin ══════════════════════════════════════════════════════════════
function gerarBarraHtml(rotulo, valor, maxValor, cor) {
  var pct = maxValor ? Math.round((valor / maxValor) * 100) : 0;
  return '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">' +
    '<span>' + esc(rotulo) + '</span><span>' + esc(valor) + '</span></div>' +
    '<div style="background:var(--cinza-100);border-radius:6px;height:10px;overflow:hidden;">' +
    '<div style="background:' + cor + ';height:100%;width:' + pct + '%;"></div></div></div>';
}

function itemTermoSimples(t) {
  return '<div class="item-lista"><div class="topo-item"><div>' +
    '<div class="numero">Nº ' + esc(t.numero) + '</div><div class="nome">' + esc(t.razaoSocial || '') + '</div>' +
    '<div class="sub">' + esc(t.bairro || '') + ' — ' + esc(t.data || '') + '</div></div>' +
    '<span class="badge ' + classeBadgeStatus(t.status) + '">' + esc(t.status) + '</span></div></div>';
}

function carregarAdminTermos() {
  carregarTermos(function () {
    var container = document.getElementById('listaAdminTermos');
    if (!listaTermosCache.length) { container.innerHTML = '<div class="vazio">Nenhum termo cadastrado</div>'; return; }
    container.innerHTML = listaTermosCache.slice().reverse().map(itemTermoSimples).join('');
  });
}

function gerarRelatorio() {
  try {
    var dInicio = parseDataISO(document.getElementById('relDataInicio').value);
    var dFim = parseDataISO(document.getElementById('relDataFim').value);
    if (dFim) dFim = new Date(dFim.getFullYear(), dFim.getMonth(), dFim.getDate(), 23, 59, 59);
    relatorioAtual = listaTermosCache.filter(function (t) {
      var d = parseDataBR(t.data);
      if (!d) return false;
      if (dInicio && d < dInicio) return false;
      if (dFim && d > dFim) return false;
      return true;
    });
    var cont = function (s) { return relatorioAtual.filter(function (t) { return t.status === s; }).length; };
    var el = document.getElementById('resultadoRelatorio');
    if (!relatorioAtual.length) { el.innerHTML = '<div class="vazio">Nenhum termo no período selecionado</div>'; return; }
    el.innerHTML = '<p style="font-size:12px;margin:0 0 10px;"><strong>' + relatorioAtual.length + '</strong> termos no período — ' +
      cont('Pendente') + ' pendentes, ' + cont('Compareceu') + ' compareceram, ' + cont('Resolvido') + ' resolvidos.</p>' +
      relatorioAtual.map(itemTermoSimples).join('');
  } catch (erroRender) {
    var e2 = document.getElementById('resultadoRelatorio');
    if (e2) e2.innerHTML = '<div class="vazio" style="color:var(--vermelho-700);">Erro: ' + esc(erroRender.message) + '</div>';
  }
}

function carregarUsuarios() {
  document.getElementById('listaUsuarios').innerHTML = '<div class="vazio">Carregando...</div>';
  google.script.run
    .withSuccessHandler(renderizarListaUsuarios)
    .withFailureHandler(function (err) { document.getElementById('listaUsuarios').innerHTML = '<div class="vazio">Erro: ' + esc(err.message) + '</div>'; })
    .listarUsuarios();
}

function renderizarListaUsuarios(lista) {
  lista = lista || [];
  var container = document.getElementById('listaUsuarios');
  if (!lista.length) { container.innerHTML = '<div class="vazio">Nenhum usuário cadastrado</div>'; return; }
  container.innerHTML = lista.map(function (u) {
    return '<div class="item-lista"><div class="topo-item"><div>' +
      '<div class="nome">' + esc(u.nome) + '</div>' +
      '<div class="sub">@' + esc(u.username) + ' — ' + (u.perfil === 'admin' ? 'Administrador' : 'Fiscal') + '</div></div></div>' +
      '<div class="botoes-form" style="margin-top:8px;">' +
      '<button class="outline" onclick="abrirModalSenha({id:' + jsArg(u.id) + ',username:' + jsArg(u.username) + '})">Redefinir senha</button>' +
      '<button class="outline" style="color:var(--vermelho-700)" onclick="excluirUsuarioUI(' + jsArg(u.id) + ')">Excluir</button></div></div>';
  }).join('');
}

// ═══ Funções reaproveitadas do sistema anterior ═══
function filtrarCadastros() {
      const termo = document.getElementById('buscaCadastro').value.toLowerCase();
      const filtrada = listaEmpreendedoresCache.filter(function(e) {
        return (e.cpfCnpj + ' ' + e.razaoSocial + ' ' + e.bairro).toLowerCase().indexOf(termo) !== -1;
      });
      renderizarListaCadastros(filtrada);
    }

function salvarCadastro() {
      const erro = document.getElementById('erroCadastro');
      erro.style.display = 'none';

      const cpfCnpj = document.getElementById('cadCpfCnpj').value.trim();
      if (!cpfCnpj) {
        erro.textContent = 'CPF/CNPJ é obrigatório.';
        erro.style.display = 'block';
        return;
      }

      const dados = {
        cpfCnpj: cpfCnpj,
        razaoSocial: document.getElementById('cadRazaoSocial').value.trim(),
        logradouro: document.getElementById('cadLogradouro').value.trim(),
        numero: document.getElementById('cadNumero').value.trim(),
        bairro: document.getElementById('cadBairro').value.trim(),
        cidade: document.getElementById('cadCidade').value.trim(),
        uf: document.getElementById('cadUf').value.trim(),
        atividade: document.getElementById('cadAtividade').value.trim()
      };

      google.script.run
        .withSuccessHandler(function(r) {
          if (r.sucesso) {
            limparFormCadastro();
            carregarEmpreendedores();
          } else {
            erro.textContent = r.mensagem;
            erro.style.display = 'block';
          }
        })
        .withFailureHandler(function(err) {
          erro.textContent = 'Erro: ' + err.message;
          erro.style.display = 'block';
        })
        .salvarEmpreendedor(dados);
    }

function editarCadastro(cpfCnpj) {
      const e = listaEmpreendedoresCache.find(function(x) { return String(x.cpfCnpj) === String(cpfCnpj); });
      if (!e) return;
      document.getElementById('tituloFormCadastro').textContent = 'Editar Empreendedor';
      document.getElementById('cadCpfCnpj').value = e.cpfCnpj;
      document.getElementById('cadRazaoSocial').value = e.razaoSocial || '';
      document.getElementById('cadLogradouro').value = e.logradouro || '';
      document.getElementById('cadNumero').value = e.numero || '';
      document.getElementById('cadBairro').value = e.bairro || '';
      document.getElementById('cadCidade').value = e.cidade || '';
      document.getElementById('cadUf').value = e.uf || '';
      document.getElementById('cadAtividade').value = e.atividade || '';
      window.scrollTo(0, 0);
    }

function excluirCadastro(cpfCnpj) {
      if (!confirm('Excluir este empreendedor?')) return;
      google.script.run
        .withSuccessHandler(function() { carregarEmpreendedores(); })
        .withFailureHandler(function(err) { alert('Erro: ' + err.message); })
        .excluirEmpreendedor(cpfCnpj);
    }

function limparFormCadastro() {
      document.getElementById('tituloFormCadastro').textContent = 'Novo Empreendedor';
      ['cadCpfCnpj','cadRazaoSocial','cadLogradouro','cadNumero','cadBairro','cadAtividade']
        .forEach(function(id) { document.getElementById(id).value = ''; });
      document.getElementById('cadCidade').value = 'Imperatriz';
      document.getElementById('cadUf').value = 'MA';
      document.getElementById('erroCadastro').style.display = 'none';
    }

function abrirNotificacao() {
      requestAnimationFrame(inicializarCanvasAssinatura);

      // Preenche campos "fixos" com o último valor usado (sem redigitação)
      const leisSalvas = localStorage.getItem('semmarh_leis_padrao');
      if (leisSalvas) document.getElementById('notifLeis').value = leisSalvas;
      const horarioSalvo = localStorage.getItem('semmarh_horario_padrao');
      if (horarioSalvo) document.getElementById('notifHorarioAtendimento').value = horarioSalvo;
      const fiscaisSalvos = localStorage.getItem('semmarh_fiscais_padrao');
      if (fiscaisSalvos) document.getElementById('notifFiscais').value = fiscaisSalvos;

      google.script.run
        .withSuccessHandler(function(numero) {
          document.getElementById('numeroPrevisto').textContent = numero;
        })
        .withFailureHandler(function() {
          document.getElementById('numeroPrevisto').textContent = '—';
        })
        .espiarProximoNumero();
    }

function coletarDadosNotif() {
      const caracteristicas = Array.prototype.slice
        .call(document.querySelectorAll('.notifCaract:checked'))
        .map(function(el) { return el.value; })
        .join(', ');

      return {
        cpfCnpj: document.getElementById('notifCpfCnpj').value.trim(),
        razaoSocial: document.getElementById('notifRazaoSocial').value.trim(),
        logradouro: document.getElementById('notifLogradouro').value.trim(),
        numeroEnd: document.getElementById('notifNumeroEnd').value.trim(),
        bairro: document.getElementById('notifBairro').value.trim(),
        cep: document.getElementById('notifCep').value.trim(),
        cidade: document.getElementById('notifCidade').value.trim(),
        uf: document.getElementById('notifUf').value.trim(),
        atividade: document.getElementById('notifAtividade').value.trim(),
        contatoRepresentante: document.getElementById('notifContatoRepresentante').value.trim(),
        caracteristicas: caracteristicas,
        caracteristicasOutros: document.getElementById('notifCaractOutros').value.trim(),
        constatacao: document.getElementById('notifConstatacao').value.trim(),
        leis: document.getElementById('notifLeis').value.trim(),
        leisOutros: document.getElementById('notifLeisOutros').value.trim(),
        horarioAtendimento: document.getElementById('notifHorarioAtendimento').value.trim(),
        prazoDate: document.getElementById('notifPrazoDate').value,
        descricao: document.getElementById('notifDescricao').value.trim(),
        fiscais: document.getElementById('notifFiscais').value.trim(),
        nomeEmpreendedor: document.getElementById('notifNomeEmpreendedor').value.trim(),
        cpfResponsavelRecebimento: document.getElementById('notifCpfResponsavel').value.trim(),
        dataHoraRecebimento: document.getElementById('notifDataHoraRecebimento').value,
        assinaturaEmpreendedor: exportarAssinatura('canvasAssinatura')
      };
    }

function finalizarNotificacao() {
      const dados = coletarDadosNotif();
      dados.criadoPor = usuarioLogado ? usuarioLogado.username : '';
      const btn = document.getElementById('btnFinalizarNotif');
      const erro = document.getElementById('erroNotif');
      erro.style.display = 'none';
      btn.disabled = true;
      btn.textContent = 'Salvando...';

      google.script.run
        .withSuccessHandler(function(r) {
          btn.disabled = false;
          btn.textContent = 'Salvar Notificação';
          if (r.sucesso) {
            // Lembra os campos recorrentes para a próxima notificação
            localStorage.setItem('semmarh_leis_padrao', dados.leis);
            localStorage.setItem('semmarh_horario_padrao', dados.horarioAtendimento);
            localStorage.setItem('semmarh_fiscais_padrao', dados.fiscais);

            alert('Notificação nº ' + r.numero + ' registrada com sucesso!' + (r.aviso ? '\n\nAtenção: ' + r.aviso : ''));
            limparFormNotif();
            mostrarPagina('inicio');
          } else {
            erro.textContent = r.mensagem;
            erro.style.display = 'block';
          }
        })
        .withFailureHandler(function(err) {
          btn.disabled = false;
          btn.textContent = 'Salvar Notificação';
          erro.textContent = 'Erro: ' + err.message;
          erro.style.display = 'block';
        })
        .salvarTermo(dados);
    }

function limparFormNotif() {
      ['notifCpfCnpj','notifRazaoSocial','notifLogradouro','notifNumeroEnd','notifBairro','notifCep',
       'notifAtividade','notifContatoRepresentante','notifCaractOutros','notifConstatacao',
       'notifLeisOutros','notifPrazoDate','notifDescricao','notifNomeEmpreendedor',
       'notifCpfResponsavel','notifDataHoraRecebimento']
        .forEach(function(id) { document.getElementById(id).value = ''; });
      document.getElementById('notifCidade').value = 'Imperatriz';
      document.getElementById('notifUf').value = 'MA';
      document.querySelectorAll('.notifCaract').forEach(function(el) { el.checked = false; });
      document.getElementById('erroNotif').style.display = 'none';
      limparAssinatura();
      abrirNotificacao();
    }

function inicializarCanvasAssinatura() {
      const canvas = document.getElementById('canvasAssinatura');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) return; // ainda não visível
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      assinaturaCtx = ctx;

      if (canvas.dataset.eventosLigados) return;
      canvas.dataset.eventosLigados = '1';

      function posicao(e) {
        const r = canvas.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - r.left, y: t.clientY - r.top };
      }
      function iniciarTraco(e) {
        e.preventDefault();
        assinaturaDesenhando = true;
        const p = posicao(e);
        assinaturaCtx.beginPath();
        assinaturaCtx.moveTo(p.x, p.y);
      }
      function desenharTraco(e) {
        if (!assinaturaDesenhando) return;
        e.preventDefault();
        const p = posicao(e);
        assinaturaCtx.lineTo(p.x, p.y);
        assinaturaCtx.stroke();
      }
      function pararTraco() { assinaturaDesenhando = false; }

      canvas.addEventListener('mousedown', iniciarTraco);
      canvas.addEventListener('mousemove', desenharTraco);
      window.addEventListener('mouseup', pararTraco);
      canvas.addEventListener('touchstart', iniciarTraco, { passive: false });
      canvas.addEventListener('touchmove', desenharTraco, { passive: false });
      canvas.addEventListener('touchend', pararTraco);
    }

function limparAssinatura() {
      const canvas = document.getElementById('canvasAssinatura');
      if (canvas && assinaturaCtx) assinaturaCtx.clearRect(0, 0, canvas.width, canvas.height);
    }

function canvasEstaVazio() {
      const canvas = document.getElementById('canvasAssinatura');
      if (!canvas || !canvas.width) return true;
      const ctx = canvas.getContext('2d');
      const dados = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < dados.length; i += 4) {
        if (dados[i] !== 0) return false;
      }
      return true;
    }

function classeBadgeStatus(status) {
      if (status === 'Compareceu') return 'compareceu';
      if (status === 'Resolvido') return 'resolvido';
      return 'pendente';
    }

function carregarComparecimentosParaHistorico(callback) {
      google.script.run
        .withSuccessHandler(function(lista) { listaComparecimentosCache = lista || []; if (callback) callback(); })
        .withFailureHandler(function() { listaComparecimentosCache = []; if (callback) callback(); })
        .listarComparecimentos();
    }

function renderizarPaginacaoHistorico(totalPaginas) {
      const container = document.getElementById('paginacaoHistorico');
      if (totalPaginas <= 1) { container.innerHTML = ''; return; }
      let html = '';
      for (let i = 1; i <= totalPaginas; i++) {
        html += '<button class="' + (i === paginaHistoricoAtual ? 'ativo' : '') + '" onclick="irParaPaginaHistorico(' + i + ')">' + i + '</button>';
      }
      container.innerHTML = html;
    }

function irParaPaginaHistorico(n) {
      paginaHistoricoAtual = n;
      renderizarHistorico();
    }

function mudarStatusTermo(id, novoStatus) {
      google.script.run
        .withSuccessHandler(function() { atualizarHistoricoCompleto(); atualizarDashboard(); })
        .withFailureHandler(function(err) { alert('Erro: ' + err.message); })
        .atualizarStatusTermo(id, novoStatus);
    }

function excluirTermoUI(id) {
      if (!confirm('Excluir este termo definitivamente?')) return;
      google.script.run
        .withSuccessHandler(function() { atualizarHistoricoCompleto(); atualizarDashboard(); })
        .withFailureHandler(function(err) { alert('Erro: ' + err.message); })
        .excluirTermo(id);
    }

function selecionarTodosHistorico(chkCabecalho) {
      document.querySelectorAll('.chk-termo').forEach(function(el) { el.checked = chkCabecalho.checked; });
      atualizarSelecaoHistorico();
    }

function atualizarSelecaoHistorico() {
      const marcados = document.querySelectorAll('.chk-termo:checked');
      const barra = document.getElementById('barraSelecaoHistorico');
      const qtd = document.getElementById('qtdSelecionadosHistorico');
      if (marcados.length > 0) {
        barra.style.display = 'flex';
        qtd.textContent = marcados.length + ' selecionado(s)';
      } else {
        barra.style.display = 'none';
      }
    }

function limparSelecaoHistorico() {
      document.querySelectorAll('.chk-termo:checked').forEach(function(el) { el.checked = false; });
      atualizarSelecaoHistorico();
    }

function excluirSelecionadosHistorico() {
      const ids = Array.prototype.slice.call(document.querySelectorAll('.chk-termo:checked'))
        .map(function(el) { return el.value; });
      if (!ids.length) return;
      if (!confirm('Excluir ' + ids.length + ' notificação(ões) selecionada(s)? Esta ação não pode ser desfeita.')) return;

      google.script.run
        .withSuccessHandler(function() {
          atualizarHistoricoCompleto();
          atualizarDashboard();
        })
        .withFailureHandler(function(err) { alert('Erro: ' + err.message); })
        .excluirTermosEmLote(ids);
    }

function atualizarDataInicio() {
      const el = document.getElementById('inicioData');
      if (!el) return;
      const agora = new Date();
      let texto = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      texto = texto.charAt(0).toUpperCase() + texto.slice(1);
      el.textContent = texto;
    }

function salvarCompromissoUI() {
      const descricao = document.getElementById('agendaDescricao').value.trim();
      if (!descricao) {
        alert('Digite uma descrição para o compromisso.');
        return;
      }

      const dados = {
        id: document.getElementById('agendaIdEditando').value || undefined,
        data: document.getElementById('agendaData').value,
        horario: document.getElementById('agendaHorario').value,
        descricao: descricao,
        criadoPor: usuarioLogado ? usuarioLogado.username : ''
      };

      const btn = document.getElementById('btnSalvarAgenda');
      btn.disabled = true;

      google.script.run
        .withSuccessHandler(function(r) {
          btn.disabled = false;
          if (r.sucesso) {
            limparFormAgenda();
            carregarAgenda();
          } else {
            alert(r.mensagem);
          }
        })
        .withFailureHandler(function(err) {
          btn.disabled = false;
          alert('Erro: ' + err.message);
        })
        .salvarCompromisso(dados);
    }

function editarCompromisso(id) {
      const c = listaAgendaCache.find(function(x) { return String(x.id) === String(id); });
      if (!c) return;
      document.getElementById('agendaIdEditando').value = c.id;
      document.getElementById('agendaData').value = c.data || '';
      document.getElementById('agendaHorario').value = c.horario || '';
      document.getElementById('agendaDescricao').value = c.descricao || '';
      document.getElementById('btnSalvarAgenda').textContent = 'Salvar Edição';
      document.getElementById('agendaDescricao').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

function excluirCompromissoUI(id) {
      if (!confirm('Excluir este compromisso?')) return;
      google.script.run
        .withSuccessHandler(function() { carregarAgenda(); })
        .withFailureHandler(function(err) { alert('Erro: ' + err.message); })
        .excluirCompromisso(id);
    }

function limparFormAgenda() {
      document.getElementById('agendaIdEditando').value = '';
      document.getElementById('agendaData').value = '';
      document.getElementById('agendaHorario').value = '';
      document.getElementById('agendaDescricao').value = '';
      document.getElementById('btnSalvarAgenda').textContent = 'Adicionar';
    }

function buscarCnpj(origem) {
      const campos = MAPA_BUSCA_CNPJ[origem];
      const cnpjDigitado = document.getElementById(campos.cpfCnpj).value.trim();
      const limpo = cnpjDigitado.replace(/\D/g, '');
      const statusEl = document.getElementById(campos.status);

      if (limpo.length !== 14) {
        statusEl.style.color = 'var(--vermelho-700)';
        statusEl.textContent = 'Digite um CNPJ válido (14 dígitos) antes de buscar.';
        return;
      }

      statusEl.style.color = 'var(--cinza-500)';
      statusEl.textContent = 'Consultando...';

      function preencherComEmpreendedorSalvo(dados) {
        document.getElementById(campos.razaoSocial).value = dados.razaoSocial || '';
        document.getElementById(campos.logradouro).value = dados.logradouro || '';
        document.getElementById(campos.numero).value = dados.numero || '';
        document.getElementById(campos.bairro).value = dados.bairro || '';
        document.getElementById(campos.cidade).value = dados.cidade || '';
        document.getElementById(campos.uf).value = dados.uf || '';
        document.getElementById(campos.atividade).value = dados.atividade || '';
        statusEl.style.color = 'var(--verde-700)';
        statusEl.textContent = 'Dados reaproveitados de um cadastro/notificação anterior.';
      }

      function preencherComApiExterna(dados) {
        const logradouroCompleto =
          ((dados.descricao_tipo_de_logradouro ? dados.descricao_tipo_de_logradouro + ' ' : '') +
           (dados.logradouro || '')).trim();

        document.getElementById(campos.razaoSocial).value = dados.razao_social || dados.nome_fantasia || '';
        document.getElementById(campos.logradouro).value = logradouroCompleto;
        document.getElementById(campos.numero).value = dados.numero || '';
        document.getElementById(campos.bairro).value = dados.bairro || '';
        document.getElementById(campos.cidade).value = dados.municipio || '';
        document.getElementById(campos.uf).value = dados.uf || '';
        document.getElementById(campos.atividade).value = dados.cnae_fiscal_descricao || '';
        if (campos.cep) document.getElementById(campos.cep).value = dados.cep || '';

        statusEl.style.color = 'var(--verde-700)';
        statusEl.textContent = 'Dados encontrados e preenchidos.';
      }

      function consultarApiExterna() {
        const urlApi = 'https://brasilapi.com.br/api/cnpj/v1/' + limpo;
        const urlViaProxy = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(urlApi);

        fetch(urlApi)
          .then(function(resp) {
            if (!resp.ok) throw new Error('CNPJ não encontrado.');
            return resp.json();
          })
          .then(preencherComApiExterna)
          .catch(function() {
            return fetch(urlViaProxy)
              .then(function(resp) {
                if (!resp.ok) throw new Error('CNPJ não encontrado.');
                return resp.json();
              })
              .then(preencherComApiExterna);
          })
          .catch(function() {
            statusEl.style.color = 'var(--vermelho-700)';
            statusEl.textContent = 'Não foi possível consultar automaticamente. Preencha os dados manualmente.';
          });
      }

      // Primeiro tenta reaproveitar um cadastro já existente (sem redigitação);
      // só consulta a API externa se não houver nada salvo ainda.
      google.script.run
        .withSuccessHandler(function(r) {
          if (r && r.sucesso) {
            preencherComEmpreendedorSalvo(r.empreendedor);
          } else {
            consultarApiExterna();
          }
        })
        .withFailureHandler(consultarApiExterna)
        .buscarEmpreendedorPorCpfCnpj(limpo);
    }

function inicializarCanvasAssinaturaComp() {
      const canvas = document.getElementById('canvasAssinaturaComp');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) return;
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      assinaturaCompCtx = ctx;

      if (canvas.dataset.eventosLigados) return;
      canvas.dataset.eventosLigados = '1';

      function posicao(e) {
        const r = canvas.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - r.left, y: t.clientY - r.top };
      }
      function iniciarTraco(e) {
        e.preventDefault();
        assinaturaCompDesenhando = true;
        const p = posicao(e);
        assinaturaCompCtx.beginPath();
        assinaturaCompCtx.moveTo(p.x, p.y);
      }
      function desenharTraco(e) {
        if (!assinaturaCompDesenhando) return;
        e.preventDefault();
        const p = posicao(e);
        assinaturaCompCtx.lineTo(p.x, p.y);
        assinaturaCompCtx.stroke();
      }
      function pararTraco() { assinaturaCompDesenhando = false; }

      canvas.addEventListener('mousedown', iniciarTraco);
      canvas.addEventListener('mousemove', desenharTraco);
      window.addEventListener('mouseup', pararTraco);
      canvas.addEventListener('touchstart', iniciarTraco, { passive: false });
      canvas.addEventListener('touchmove', desenharTraco, { passive: false });
      canvas.addEventListener('touchend', pararTraco);
    }

function limparAssinaturaComp() {
      const canvas = document.getElementById('canvasAssinaturaComp');
      if (canvas && assinaturaCompCtx) assinaturaCompCtx.clearRect(0, 0, canvas.width, canvas.height);
    }

function canvasCompEstaVazio() {
      const canvas = document.getElementById('canvasAssinaturaComp');
      if (!canvas || !canvas.width) return true;
      const ctx = canvas.getContext('2d');
      const dados = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < dados.length; i += 4) {
        if (dados[i] !== 0) return false;
      }
      return true;
    }

function alternarBlocoProcurador() {
      const tipo = document.getElementById('compTipoProcuracao').value;
      document.getElementById('blocoProcurador').style.display = (tipo === 'Procurador') ? 'block' : 'none';
    }

function coletarDadosComparecimento() {
      return {
        termoNotificacaoNumero: document.getElementById('compTermoNumero').value.trim(),
        processoNumero: document.getElementById('compProcessoNumero').value.trim(),
        dataComparecimento: document.getElementById('compDataComparecimento').value,
        nomeResponsavel: document.getElementById('compNomeResponsavel').value.trim(),
        cpfResponsavel: document.getElementById('compCpfResponsavel').value.trim(),
        tipoProcuracao: document.getElementById('compTipoProcuracao').value,
        nomeEmpresa: document.getElementById('compNomeEmpresa').value.trim(),
        cnpjEmpresa: document.getElementById('compCnpjEmpresa').value.trim(),
        constaNosAutos: document.getElementById('compConstaNosAutos').checked ? 'Sim' : 'Não',
        dataConstaNosAutos: document.getElementById('compDataConstaNosAutos').value,
        procuradorNome1: document.getElementById('compProcuradorNome1').value.trim(),
        procuradorNome2: document.getElementById('compProcuradorNome2').value.trim(),
        poderesProcuracao: document.getElementById('compPoderesProcuracao').value.trim(),
        qualificacaoProcuracao: document.getElementById('compQualificacaoProcuracao').value.trim(),
        nomeApresentante: document.getElementById('compNomeApresentante').value.trim(),
        observacaoProcuracao: document.getElementById('compObservacaoProcuracao').value.trim(),
        declaracao: document.getElementById('compDeclaracao').value.trim(),
        assinaturaComparecente: exportarAssinatura('canvasAssinaturaComp'),
        nomeAssinante: document.getElementById('compNomeAssinante').value.trim(),
        cpfAssinante: document.getElementById('compCpfAssinante').value.trim(),
        conclusaoTexto: document.getElementById('compConclusaoTexto').value.trim(),
        empresaConclusao: document.getElementById('compEmpresaConclusao').value.trim(),
        cnpjCpfConclusao: document.getElementById('compCnpjCpfConclusao').value.trim(),
        observacaoConclusao: document.getElementById('compObservacaoConclusao').value.trim(),
        prazoObrigacao: document.getElementById('compPrazoObrigacao').value.trim(),
        dataFinal: document.getElementById('compDataFinal').value,
        matriculaServidor: document.getElementById('compMatriculaServidor').value.trim(),
        nomeServidor: document.getElementById('compNomeServidor').value.trim(),
        funcaoServidor: document.getElementById('compFuncaoServidor').value.trim()
      };
    }

function salvarComparecimentoUI() {
      const erro = document.getElementById('erroComparecimento');
      erro.style.display = 'none';
      const dados = coletarDadosComparecimento();

      if (!dados.nomeResponsavel || !dados.nomeEmpresa) {
        erro.textContent = 'Preencha ao menos o nome do responsável e a empresa.';
        erro.style.display = 'block';
        return;
      }

      google.script.run
        .withSuccessHandler(function(r) {
          if (r.sucesso) {
            alert('Comparecimento registrado com sucesso.');
            limparFormComparecimento();
            carregarComparecimentos();
            atualizarDashboard();
            atualizarHistoricoCompleto();
          } else {
            erro.textContent = r.mensagem;
            erro.style.display = 'block';
          }
        })
        .withFailureHandler(function(err) {
          erro.textContent = 'Erro: ' + err.message;
          erro.style.display = 'block';
        })
        .salvarComparecimento(dados);
    }

function limparFormComparecimento() {
      ['compTermoNumero','compProcessoNumero','compDataComparecimento','compNomeResponsavel',
       'compCpfResponsavel','compNomeEmpresa','compCnpjEmpresa','compProcuradorNome1','compProcuradorNome2',
       'compPoderesProcuracao','compQualificacaoProcuracao','compNomeApresentante','compDataConstaNosAutos',
       'compObservacaoProcuracao','compDeclaracao','compNomeAssinante','compCpfAssinante','compConclusaoTexto',
       'compEmpresaConclusao','compCnpjCpfConclusao','compObservacaoConclusao','compPrazoObrigacao',
       'compDataFinal','compMatriculaServidor','compNomeServidor','compFuncaoServidor']
        .forEach(function(id) { document.getElementById(id).value = ''; });
      document.getElementById('compConstaNosAutos').checked = false;
      document.getElementById('compTipoProcuracao').value = 'Próprio';
      alternarBlocoProcurador();
      limparAssinaturaComp();
      document.getElementById('erroComparecimento').style.display = 'none';
    }

function filtrarComparecimentos() {
      const termo = document.getElementById('buscaComparecimento').value.toLowerCase();
      const filtrada = listaComparecimentosCache.filter(function(c) {
        return (c.termoNotificacaoNumero + ' ' + c.nomeEmpresa + ' ' + c.nomeResponsavel).toLowerCase().indexOf(termo) !== -1;
      });
      renderizarListaComparecimentos(filtrada);
    }

function excluirComparecimentoUI(id) {
      if (!confirm('Excluir este comparecimento?')) return;
      google.script.run
        .withSuccessHandler(function() { carregarComparecimentos(); atualizarDashboard(); atualizarHistoricoCompleto(); })
        .withFailureHandler(function(err) { alert('Erro: ' + err.message); })
        .excluirComparecimento(id);
    }

function mostrarAdminTab(nome, botao) {
      document.querySelectorAll('.admin-tab').forEach(function(el) { el.style.display = 'none'; });
      document.getElementById('adminTab-' + nome).style.display = 'block';
      document.querySelectorAll('#pagina-admin .filtros button').forEach(function(b) { b.classList.remove('ativo'); });
      botao.classList.add('ativo');
      if (nome === 'dashboard') atualizarAdminDashboard();
      if (nome === 'termos') carregarAdminTermos();
      if (nome === 'usuarios') carregarUsuarios();
    }

function atualizarAdminDashboard() {
      carregarTermos(function() {
       try {
        const total = listaTermosCache.length;
        const pendentes = listaTermosCache.filter(function(t) { return t.status === 'Pendente'; }).length;
        const compareceram = listaTermosCache.filter(function(t) { return t.status === 'Compareceu'; }).length;
        const resolvidos = listaTermosCache.filter(function(t) { return t.status === 'Resolvido'; }).length;
        const vencidos = listaTermosCache.filter(function(t) { return calcularAlertaPrazo(t) === 'vencido'; }).length;

        document.getElementById('adminKpiTotal').textContent = total;
        document.getElementById('adminKpiPendentes').textContent = pendentes;
        document.getElementById('adminKpiCompareceram').textContent = compareceram;
        document.getElementById('adminKpiVencidos').textContent = vencidos;

        const maxStatus = Math.max(pendentes, compareceram, resolvidos, 1);
        document.getElementById('graficoStatus').innerHTML =
          gerarBarraHtml('Pendente', pendentes, maxStatus, '#a16207') +
          gerarBarraHtml('Compareceu', compareceram, maxStatus, '#1d4ed8') +
          gerarBarraHtml('Resolvido', resolvidos, maxStatus, '#15803d');

        const contagemBairro = {};
        listaTermosCache.forEach(function(t) {
          const b = t.bairro || 'Não informado';
          contagemBairro[b] = (contagemBairro[b] || 0) + 1;
        });
        const bairros = Object.keys(contagemBairro)
          .map(function(b) { return { nome: b, valor: contagemBairro[b] }; })
          .sort(function(a, b) { return b.valor - a.valor; })
          .slice(0, 5);

        const maxBairro = bairros.length ? bairros[0].valor : 1;
        document.getElementById('graficoBairro').innerHTML = bairros.length
          ? bairros.map(function(b) { return gerarBarraHtml(b.nome, b.valor, maxBairro, '#15803d'); }).join('')
          : '<div class="vazio">Sem dados</div>';
       } catch (erroRender) {
        const el = document.getElementById('graficoStatus');
        if (el) el.innerHTML = '<div class="vazio" style="color:var(--vermelho-700);">Erro: ' + esc(erroRender.message) + '</div>';
       }
      });
    }

function exportarRelatorioTexto() {
      if (!relatorioAtual.length) { alert('Gere o relatório antes de exportar.'); return; }
      let texto = 'RELATÓRIO DE NOTIFICAÇÕES - SEMMARH\n';
      texto += 'Período: ' + (document.getElementById('relDataInicio').value || '—') +
        ' a ' + (document.getElementById('relDataFim').value || '—') + '\n\n';
      relatorioAtual.forEach(function(t) {
        texto += 'Nº ' + t.numero + ' | ' + (t.razaoSocial || '') + ' | ' + (t.bairro || '') +
          ' | Status: ' + t.status + ' | Data: ' + t.data + '\n';
      });

      const blob = new Blob([texto], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relatorio_semmarh.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

function criarUsuarioUI() {
      const erro = document.getElementById('erroUsuario');
      erro.style.display = 'none';

      const dados = {
        username: document.getElementById('userUsername').value.trim(),
        senha: document.getElementById('userSenha').value,
        nome: document.getElementById('userNome').value.trim(),
        matricula: document.getElementById('userMatricula').value.trim(),
        perfil: document.getElementById('userPerfil').value
      };

      if (!dados.username || !dados.senha || !dados.nome) {
        erro.textContent = 'Preencha usuário, senha e nome.';
        erro.style.display = 'block';
        return;
      }

      google.script.run
        .withSuccessHandler(function(r) {
          if (r.sucesso) {
            document.getElementById('userUsername').value = '';
            document.getElementById('userSenha').value = '';
            document.getElementById('userNome').value = '';
            document.getElementById('userMatricula').value = '';
            document.getElementById('userPerfil').value = 'fiscal';
            carregarUsuarios();
          } else {
            erro.textContent = r.mensagem;
            erro.style.display = 'block';
          }
        })
        .withFailureHandler(function(err) {
          erro.textContent = 'Erro: ' + err.message;
          erro.style.display = 'block';
        })
        .criarUsuario(dados);
    }

function excluirUsuarioUI(id) {
      if (!confirm('Excluir este usuário?')) return;
      google.script.run
        .withSuccessHandler(function(r) {
          if (r.sucesso) carregarUsuarios();
          else alert(r.mensagem);
        })
        .withFailureHandler(function(err) { alert('Erro: ' + err.message); })
        .excluirUsuario(id);
    }

function iniciarDitado(campoId, botao) {
      const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Reconhecimento) {
        alert('Entrada por voz não é suportada neste navegador. Use o Google Chrome.');
        return;
      }

      const campo = document.getElementById(campoId);
      const reconhecimento = new Reconhecimento();
      reconhecimento.lang = 'pt-BR';
      reconhecimento.interimResults = false;
      reconhecimento.maxAlternatives = 1;

      botao.textContent = '🔴 Ouvindo...';
      botao.classList.add('gravando');
      botao.disabled = true;

      reconhecimento.onresult = function(event) {
        const texto = event.results[0][0].transcript;
        campo.value = (campo.value ? campo.value.trim() + ' ' : '') + texto;
      };
      reconhecimento.onerror = function(event) {
        if (event.error !== 'aborted') {
          alert('Erro na entrada por voz: ' + event.error);
        }
      };
      reconhecimento.onend = function() {
        botao.textContent = '🎤 Ditar';
        botao.classList.remove('gravando');
        botao.disabled = false;
      };

      reconhecimento.start();
    }

function gerarLinkEmail(t) {
      const assunto = encodeURIComponent('Notificação Ambiental nº ' + t.numero);
      const corpo = encodeURIComponent(
        'Prezado(a) ' + (t.razaoSocial || '') + ',\n\n' +
        'Segue notificação ambiental nº ' + t.numero + ', referente à constatação: ' + (t.constatacao || '') + '.\n' +
        'Data para comparecimento: ' + (t.prazoDate || 'a definir') + '.\n\n' +
        'SEMMARH - Prefeitura Municipal de Imperatriz'
      );
      return 'mailto:?subject=' + assunto + '&body=' + corpo;
    }

function gerarLinkWhatsapp(t) {
      const texto = encodeURIComponent(
        'Notificação Ambiental nº ' + t.numero + ' - ' + (t.razaoSocial || '') + '\n' +
        'Constatação: ' + (t.constatacao || '') + '\n' +
        'Data para comparecimento: ' + (t.prazoDate || 'a definir') + '\n' +
        'SEMMARH - Prefeitura Municipal de Imperatriz'
      );
      return 'https://wa.me/?text=' + texto;
    }
