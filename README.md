# SEMMARH — Fiscalização Ambiental (interface web)

Interface estática (HTML/CSS/JS) hospedada no GitHub Pages. Os dados ficam em uma planilha Google Sheets,
acessada por uma API em Google Apps Script. **Este repositório não contém senhas, chaves nem tokens.**

- `index.html`, `css/`, `js/`, `assets/` — o sistema.
- `js/config.js` — único arquivo a editar: cole a URL da API (termina em `/exec`).

Ao alterar CSS/JS, aumente o número depois de `?v=` no `index.html` (ex.: `?v=2`) para o navegador baixar a versão nova.
