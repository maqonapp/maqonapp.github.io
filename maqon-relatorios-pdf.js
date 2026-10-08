/* MAQON V1.5.11 - Relatorios executivos premium PDF (sem dependencias externas).
   Preserva cadastros, CRM, comparativos, analises e biblioteca.
   Le os equipamentos ja salvos no navegador e gera PDFs A4 localmente. */
(function () {
  'use strict';

  const STORAGE = 'maqon_equipamentos_v1';
  const W = 595.28, H = 841.89, M = 37;
  const C = {
    black: [0.055, 0.078, 0.09], gold: [0.88, 0.64, 0.045],
    dark: [0.11, 0.16, 0.19], text: [0.14, 0.19, 0.22],
    muted: [0.39, 0.44, 0.47], light: [0.94, 0.95, 0.96],
    line: [0.83, 0.86, 0.87], white: [1, 1, 1],
    bar: [0.63, 0.67, 0.69]
  };

  function rows() {
    try { const data = JSON.parse(localStorage.getItem(STORAGE)); return Array.isArray(data) ? data : []; }
    catch (_) { return []; }
  }
  function num(v) { const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function money(v) { return num(v).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}); }
  function decimal(v, digits) { return num(v).toLocaleString('pt-BR', {minimumFractionDigits: digits || 0, maximumFractionDigits: digits == null ? 2 : digits}); }
  function safe(v) { return String(v == null ? 'Não informado' : v).replace(/[\u0000-\u001F]/g, ' ').trim() || 'Não informado'; }
  function name(x) { return safe(x[1]) + ' ' + safe(x[2]); }
  function category(x) { return safe(x[0]); }
  function score(x) {
    // Espelha a formula existente em app.js. Indicador heuristico, nao validado.
    const av = Math.max(0, Math.min(100, num(x[8])));
    const age = Math.max(0, new Date().getFullYear() - num(x[3]));
    return Math.round(av * .35 + Math.max(0, 100 - num(x[6]) * 2.2) * .20 +
      Math.max(0, 100 - num(x[7]) * 1.15) * .20 +
      Math.max(0, 100 - num(x[4]) / 60) * .10 +
      Math.max(0, 100 - age * 7) * .15);
  }
  const stamp = () => new Date().toLocaleDateString('pt-BR');
  const filenameDate = () => new Date().toISOString().slice(0, 10);

  // PDF 1.4 gerado diretamente no navegador: texto WinAnsi, vetores e logomarca JPEG.
  // Sem CDNs, bibliotecas externas, chamadas de rede de dados ou servidores.
  const EXTRA = { '€':128, '‚':130, 'ƒ':131, '„':132, '…':133, '†':134,
    '‡':135, 'ˆ':136, '‰':137, 'Š':138, '‹':139, 'Œ':140, 'Ž':142,
    '‘':145, '’':146, '“':147, '”':148, '•':149, '–':150, '—':151,
    '˜':152, '™':153, 'š':154, '›':155, 'œ':156, 'ž':158, 'Ÿ':159 };
  function ansi(s) {
    let out = '';
    for (const ch of String(s)) {
      const n = ch.charCodeAt(0);
      out += n <= 255 ? ch : String.fromCharCode(EXTRA[ch] || 63);
    }
    return out;
  }
  function pdfEscape(s) { return ansi(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
  function byteArray(s) {
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 255;
    return out;
  }
  function f(n) { return (Math.round(n * 100) / 100).toFixed(2); }
  function rgb(color) { return color.map(f).join(' '); }

  let measureCtx = null;
  function textWidth(s, size, bold) {
    if (!measureCtx && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas'); measureCtx = canvas.getContext('2d');
    }
    if (measureCtx) {
      measureCtx.font = (bold ? 'bold ' : '') + size + 'px Arial';
      return measureCtx.measureText(String(s)).width;
    }
    return String(s).length * size * (bold ? .55 : .5);
  }
  function fitted(s, width, size, bold) {
    let text = safe(s);
    if (textWidth(text, size, bold) <= width) return text;
    while (text.length > 1 && textWidth(text + '...', size, bold) > width) text = text.slice(0, -1);
    return text + '...';
  }
  function linesFor(s, width, size, bold) {
    const words = safe(s).split(/\s+/), lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (textWidth(test, size, bold) <= width) { current = test; continue; }
      if (current) lines.push(current);
      current = word;
      while (textWidth(current, size, bold) > width && current.length > 1) {
        let cut = current.length - 1;
        while (cut > 1 && textWidth(current.slice(0, cut) + '-', size, bold) > width) cut--;
        lines.push(current.slice(0, cut) + '-'); current = current.slice(cut);
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  class Page {
    constructor() { this.cmd = []; }
    rect(x, y, w, h, color) {
      this.cmd.push(rgb(color) + ' rg ' + f(x) + ' ' + f(H - y - h) + ' ' + f(w) + ' ' + f(h) + ' re f');
    }
    line(x1, y1, x2, y2, color, thick) {
      this.cmd.push(rgb(color) + ' RG ' + f(thick || .7) + ' w ' + f(x1) + ' ' + f(H - y1) + ' m ' + f(x2) + ' ' + f(H - y2) + ' l S');
    }
    text(s, x, y, size, bold, color, width) {
      const value = width ? fitted(s, width, size, bold) : safe(s);
      this.cmd.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + f(size) + ' Tf ' + rgb(color || C.text) +
        ' rg 1 0 0 1 ' + f(x) + ' ' + f(H - y - size) + ' Tm (' + pdfEscape(value) + ') Tj ET');
    }
    paragraph(s, x, y, width, size, color, leading, maxLines, bold) {
      const all = linesFor(s, width, size || 9, !!bold), n = Math.min(all.length, maxLines || 100);
      const lh = leading || (size || 9) * 1.35;
      for (let i = 0; i < n; i++) this.text(all[i], x, y + i * lh, size || 9, !!bold, color || C.text, width);
      return y + n * lh;
    }
    image(x, y, w, h) { this.cmd.push('q ' + f(w) + ' 0 0 ' + f(h) + ' ' + f(x) + ' ' + f(H - y - h) + ' cm /Im1 Do Q'); }
  }
  class PDF {
    constructor(logo) { this.pages = []; this.logo = logo || null; }
    page() { const p = new Page(); this.pages.push(p); return p; }
    build() {
      const objs = [null];
      const add = s => { objs.push(s); return objs.length - 1; };
      const root = add(''); const pagesId = add('');
      const font1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      const font2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      let imgId = 0;
      if (this.logo) {
        imgId = add('<< /Type /XObject /Subtype /Image /Width ' + this.logo.w + ' /Height ' + this.logo.h +
          ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + this.logo.data.length +
          ' >>\nstream\n' + this.logo.data + '\nendstream');
      }
      const pageIds = [];
      for (const p of this.pages) {
        const data = ansi(p.cmd.join('\n') + '\n');
        const streamId = add('<< /Length ' + data.length + ' >>\nstream\n' + data + 'endstream');
        const res = '<< /Font << /F1 ' + font1 + ' 0 R /F2 ' + font2 + ' 0 R >>' +
          (imgId ? ' /XObject << /Im1 ' + imgId + ' 0 R >>' : '') + ' >>';
        const pageId = add('<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' + f(W) + ' ' + f(H) +
          '] /Resources ' + res + ' /Contents ' + streamId + ' 0 R >>');
        pageIds.push(pageId);
      }
      objs[root] = '<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>';
      objs[pagesId] = '<< /Type /Pages /Kids [' + pageIds.map(id => id + ' 0 R').join(' ') + '] /Count ' + pageIds.length + ' >>';
      let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
      const offsets = [0];
      for (let i = 1; i < objs.length; i++) {
        offsets[i] = pdf.length;
        pdf += i + ' 0 obj\n' + objs[i] + '\nendobj\n';
      }
      const xrefAt = pdf.length;
      pdf += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
      for (let i = 1; i < objs.length; i++) pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
      pdf += 'trailer\n<< /Size ' + objs.length + ' /Root ' + root + ' 0 R >>\nstartxref\n' + xrefAt + '\n%%EOF';
      return byteArray(pdf);
    }
  }

  function valueCell(x, k) {
    switch (k) {
      case 0: return category(x);
      case 1: return safe(x[1]);
      case 2: return safe(x[2]);
      case 3: return safe(x[3]);
      case 4: return decimal(x[4], 0) + ' h';
      case 5: return money(x[5]);
      case 6: return decimal(x[6], 1) + ' L/h';
      case 7: return money(x[7]) + '/h';
      case 8: return decimal(x[8], 1) + '%';
      case 9: return safe(x[9]);
      case 10: return score(x) + '/100*';
      default: return '';
    }
  }
  function isMeasured(x, k) {
    const raw = String(x[k] == null ? '' : x[k]).trim();
    return raw !== '' && Number.isFinite(Number(raw.replace(',', '.')));
  }
  function best(data, k, low) {
    const available = data.filter(x => isMeasured(x, k));
    return available.length ? available.reduce((a, b) => (low ? num(a[k]) <= num(b[k]) : num(a[k]) >= num(b[k])) ? a : b) : null;
  }
  // MAQON V1.5.11 — layout executivo A4, gerado localmente.
  const P = {
    cream: [0.985, 0.981, 0.961], paleGold: [0.992, 0.955, 0.845],
    faint: [0.965, 0.970, 0.970], slate: [0.31, 0.38, 0.42],
    graphite: [0.085, 0.125, 0.15], green: [0.22, 0.45, 0.35]
  };
  function currentMeta(meta) {
    const m = meta || {}, date = m.date ? new Date(m.date) : new Date();
    return {client: String(m.client || '').trim(), responsible: String(m.responsible || '').trim(),
      demo: m.demo === true, date: Number.isFinite(date.getTime()) ? date : new Date()};
  }
  function dateLocal(d) { return d.toLocaleDateString('pt-BR'); }
  function dateFile(d) { return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); }
  function reportId(meta, suffix) {
    const d = meta.date;
    return 'MAQ-' + dateFile(d).replace(/-/g, '') + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '-' + suffix;
  }
  function header(p, doc, kind, subtitle, meta, pageNo, total, suffix) {
    p.rect(0, 0, W, 127, C.black);
    p.rect(0, 123, W, 4, C.gold);
    p.rect(W - 11, 0, 11, 123, C.gold);
    if (doc.logo) p.image(33, 22, 194, 79); // proporção original preservada (355:145)
    else { p.text('MAQON', 38, 31, 36, true, C.gold); p.text('CONSULTORIA EM EQUIPAMENTOS PESADOS', 40, 81, 8, true, C.white); }
    p.text('RELATÓRIO EXECUTIVO', 251, 20, 10, true, C.gold, 305);
    p.text(kind, 251, 39, 17.3, true, C.white, 310);
    p.text(subtitle, 252, 67, 8.4, false, C.white, 298);
    p.text('EMISSÃO ' + dateLocal(meta.date), 252, 90, 7.6, true, C.gold, 125);
    p.text(reportId(meta, suffix), 379, 90, 7.3, false, C.white, 174);
    if (meta.demo) {
      p.rect(252, 106, 205, 13, P.paleGold);
      p.text('DADOS FICTÍCIOS - DEMONSTRAÇÃO', 257, 107, 7.2, true, C.dark, 195);
    }
    p.line(M, 809, W - M, 809, C.line, .7);
    p.text('MAQON  |  Consultoria em Equipamentos Pesados  |  maqonapp@gmail.com', M, 815, 7.1, false, C.muted, 459);
    p.text(String(pageNo).padStart(2, '0') + ' / ' + String(total).padStart(2, '0'), W - 71, 815, 8.1, true, C.dark, 39);
  }
  function infoStrip(p, meta) {
    const y = 139, h = 42, total = W - 2 * M, third = total / 3;
    p.rect(M, y, total, h, C.light);
    p.rect(M, y, 4, h, C.gold);
    const entries = [
      ['CLIENTE / EMPRESA', meta.client || 'Não informado'],
      ['ELABORAÇÃO', meta.responsible || 'Equipe MAQON'],
      ['REFERÊNCIA', meta.demo ? 'Demonstração' : 'Dados cadastrados']
    ];
    entries.forEach(([label, value], i) => {
      const x = M + i * third + 12;
      p.text(label, x, y + 7, 7, true, C.muted, third - 17);
      p.text(value, x, y + 20, 9.1, true, C.dark, third - 19);
      if (i) p.line(M + i * third, y + 8, M + i * third, y + h - 8, C.line, .6);
    });
  }
  function section(p, title, y, kicker) {
    p.rect(M, y + 1, 4, 17, C.gold);
    p.text(title, M + 12, y, 11.2, true, C.dark, W - 2 * M - 15);
    if (kicker) p.text(kicker, W - M - 155, y + 3, 7.4, false, C.muted, 154);
    p.line(M, y + 24, W - M, y + 24, C.line, .65);
  }
  function metricCard(p, x, y, w, h, label, value, detail) {
    p.rect(x, y, w, h, C.light);
    p.rect(x, y, w, 4, C.gold);
    p.text(label, x + 9, y + 12, 7.2, true, C.muted, w - 18);
    p.text(value, x + 9, y + 29, 12.8, true, C.dark, w - 18);
    p.text(detail, x + 9, y + 55, 7.7, false, C.slate || P.slate, w - 18);
  }
  function dataPresent(x, idx) { return isMeasured(x, idx); }
  function fmtIf(x, idx, formatter) { return dataPresent(x, idx) ? formatter(x[idx]) : 'Não informado'; }
  function equipmentCard(p, x, y, w, h, item, i) {
    p.rect(x, y, w, h, C.light);
    p.rect(x, y, 4, h, C.gold);
    p.text('EQUIPAMENTO ' + String(i + 1).padStart(2, '0'), x + 11, y + 8, 7, true, C.muted, w - 18);
    p.text(name(item), x + 11, y + 21, 11.2, true, C.dark, w - 20);
    p.text(category(item), x + 11, y + 39, 7.8, false, C.muted, w - 20);
    p.text('ANO ' + safe(item[3]) + '   •   ' + fmtIf(item, 4, v => decimal(v, 0) + ' h'), x + 11, y + h - 15, 7.6, true, C.dark, w - 20);
  }
  function bestValues(data) {
    return {value: best(data, 5, true), consumption: best(data, 6, true), maintenance: best(data, 7, true), availability: best(data, 8, false)};
  }
  function reportComparison(data, logo, rawMeta) {
    const meta = currentMeta(rawMeta), doc = new PDF(logo), b = bestValues(data);
    const p = doc.page();
    header(p, doc, 'COMPARATIVO TÉCNICO', data.length + ' máquinas | análise comparativa de indicadores', meta, 1, 2, 'CMP');
    infoStrip(p, meta);
    section(p, 'SÍNTESE EXECUTIVA', 191);
    const mGap = 8, mW = (W - 2 * M - 3 * mGap) / 4;
    [
      ['MENOR INVESTIMENTO', b.value ? money(b.value[5]) : 'Sem dados', b.value ? name(b.value) : 'Sem referência'],
      ['MENOR CONSUMO', b.consumption ? decimal(b.consumption[6], 1) + ' L/h' : 'Sem dados', b.consumption ? name(b.consumption) : 'Sem referência'],
      ['MENOR MANUTENÇÃO', b.maintenance ? money(b.maintenance[7]) + '/h' : 'Sem dados', b.maintenance ? name(b.maintenance) : 'Sem referência'],
      ['MAIOR DISPONIBILIDADE', b.availability ? decimal(b.availability[8], 1) + '%' : 'Sem dados', b.availability ? name(b.availability) : 'Sem referência']
    ].forEach((m, i) => metricCard(p, M + i * (mW + mGap), 221, mW, 73, ...m));
    section(p, 'EQUIPAMENTOS AVALIADOS', 305);
    const eGap = 9, eW = (W - 2 * M - (data.length - 1) * eGap) / data.length;
    data.forEach((x, i) => equipmentCard(p, M + i * (eW + eGap), 335, eW, 72, x, i));
    section(p, 'QUADRO COMPARATIVO', 419, 'Dados do cadastro');
    const top = 450, headH = 27, widths = [130, ...data.map(() => (W - 2 * M - 130) / data.length)];
    p.rect(M, top, W - 2 * M, headH, C.dark);
    let px = M + 9;
    ['INDICADOR', ...data.map(x => name(x))].forEach((label, i) => {
      p.text(label, px, top + 8, 7.8, true, C.white, widths[i] - 15); px += widths[i];
    });
    const specs = [
      ['Fabricante', 1], ['Modelo', 2], ['Ano', 3], ['Horímetro', 4],
      ['Valor de compra', 5], ['Consumo', 6], ['Manutenção por hora', 7],
      ['Disponibilidade', 8], ['Situação', 9], ['Score MAQON*', 10]
    ];
    const rowH = 23.8;
    specs.forEach(([label, idx], i) => {
      const yy = top + headH + i * rowH;
      if (i % 2 === 0) p.rect(M, yy, W - 2 * M, rowH, C.light);
      p.text(label, M + 9, yy + 6.5, 8.1, true, C.dark, widths[0] - 17);
      let cx = M + widths[0];
      data.forEach(x => {
        const bw = widths[1];
        const winner = idx === 5 ? b.value === x : idx === 6 ? b.consumption === x : idx === 7 ? b.maintenance === x : idx === 8 ? b.availability === x : false;
        if (winner) p.rect(cx + 2, yy + 3, bw - 4, rowH - 6, P.paleGold);
        p.text(valueCell(x, idx), cx + 7, yy + 6.5, 7.8, !!winner, winner ? C.dark : C.text, bw - 13);
        cx += bw;
      });
      p.line(M, yy + rowH, W - M, yy + rowH, C.line, .28);
    });
    p.rect(M, 730, W - 2 * M, 68, P.cream);
    p.rect(M, 730, 4, 68, C.gold);
    p.text('LEITURA RESPONSÁVEL', M + 12, 739, 8.4, true, C.dark);
    p.paragraph('Destaques calculados exclusivamente a partir dos valores cadastrados. O menor preço ou consumo não determina, isoladamente, a melhor compra. Score MAQON indicativo, sem validação técnica conclusiva. Consulte os gráficos e premissas na página 2.', M + 12, 754, W - 2 * M - 24, 8.1, C.text, 11.3, 4);

    const p2 = doc.page();
    header(p2, doc, 'INDICADORES E PARECER', 'Visualização comparativa | leitura orientada à decisão', meta, 2, 2, 'CMP');
    infoStrip(p2, meta);
    section(p2, 'PAINEL GRÁFICO', 191, 'Destaque em dourado');
    chartPanel(p2, M, 223, 252, 181, 'VALOR DE COMPRA', 'Menor é melhor', data, 5, true, v => money(v));
    chartPanel(p2, M + 269, 223, 252, 181, 'CONSUMO INFORMADO', 'Menor é melhor', data, 6, true, v => decimal(v, 1) + ' L/h');
    chartPanel(p2, M, 417, 252, 181, 'MANUTENÇÃO POR HORA', 'Menor é melhor', data, 7, true, v => money(v) + '/h');
    chartPanel(p2, M + 269, 417, 252, 181, 'DISPONIBILIDADE', 'Maior é melhor', data, 8, false, v => decimal(v, 1) + '%');
    section(p2, 'CONCLUSÃO TÉCNICA PRELIMINAR', 614);
    p2.rect(M, 647, W - 2 * M, 79, C.light);
    p2.rect(M, 647, 4, 79, C.gold);
    const statements = [
      b.value ? name(b.value) + ' apresenta o menor investimento inicial' : null,
      b.consumption ? name(b.consumption) + ' apresenta o menor consumo informado' : null,
      b.maintenance ? name(b.maintenance) + ' apresenta a menor manutenção informada' : null,
      b.availability ? name(b.availability) + ' apresenta a maior disponibilidade' : null
    ].filter(Boolean);
    p2.paragraph((statements.length ? statements.join('; ') + '. ' : 'Dados insuficientes para identificar destaques. ') + 'A melhor alternativa depende da aplicação, da produtividade real e do custo total de propriedade.', M + 13, 659, W - 2 * M - 26, 9, C.dark, 12.6, 5);
    p2.rect(M, 738, W - 2 * M, 61, P.cream);
    p2.rect(M, 738, 4, 61, C.gold);
    p2.text('PREMISSAS E PRÓXIMAS VERIFICAÇÕES', M + 12, 745, 8.1, true, C.dark);
    p2.paragraph('Valores fornecidos pelo cadastro, sem auditoria ou ensaio de campo. Não foram monetizados combustível, depreciação, operador, pneus/rodante, seguros, tributos e logística. Antes de decidir, valide aplicação, produção por hora, horas anuais, preço do diesel e histórico de manutenção.', M + 12, 760, W - 2 * M - 24, 8.1, C.text, 10.5, 4);
    return doc.build();
  }
  function chartPanel(p, x, y, w, h, title, direction, data, idx, low, formatter) {
    p.rect(x, y, w, h, C.light);
    p.rect(x, y, w, 4, C.gold);
    p.text(title, x + 12, y + 12, 10, true, C.dark, w - 24);
    p.text(direction, x + 12, y + 30, 7.8, false, C.muted, w - 24);
    const nums = data.map(d => dataPresent(d, idx) ? num(d[idx]) : null);
    const available = nums.filter(v => v !== null), maximum = Math.max(1, ...available);
    const bestN = available.length ? (low ? Math.min(...available) : Math.max(...available)) : null;
    data.forEach((d, i) => {
      const yy = y + 55 + i * 38;
      const leader = nums[i] !== null && nums[i] === bestN;
      p.text(name(d), x + 12, yy, 8.3, leader, C.dark, 125);
      p.text(nums[i] === null ? 'Não informado' : formatter(d[idx]), x + 145, yy, 8.1, leader, C.dark, w - 155);
      p.rect(x + 12, yy + 18, w - 24, 8, C.line);
      if (nums[i] !== null) p.rect(x + 12, yy + 18, Math.max(3, (w - 24) * nums[i] / maximum), 8, leader ? C.gold : C.bar);
    });
  }
  function progressPanel(p, x, y, w, h, label, val, sublabel, validated, unit) {
    p.rect(x, y, w, h, C.light);
    p.rect(x, y, w, 4, C.gold);
    p.text(label, x + 13, y + 14, 8.8, true, C.dark, w - 25);
    p.text(val + (unit || '%'), x + 13, y + 33, 24, true, C.dark, w - 25);
    p.rect(x + 13, y + 70, w - 26, 9, C.line);
    p.rect(x + 13, y + 70, Math.max(2, (w - 26) * Math.max(0, Math.min(100, val)) / 100), 9, C.gold);
    p.text(sublabel, x + 13, y + 88, 7.6, false, validated ? C.muted : P.slate, w - 26);
  }
  function numericPanel(p, x, y, w, h, label, val, sublabel) {
    p.rect(x, y, w, h, P.cream);
    p.rect(x, y, 4, h, C.gold);
    p.text(label, x + 13, y + 13, 8.7, true, C.muted, w - 25);
    p.text(val, x + 13, y + 32, 20, true, C.dark, w - 25);
    p.text(sublabel, x + 13, y + 72, 7.8, false, C.muted, w - 25);
  }
  function reportIndividual(x, logo, rawMeta) {
    const meta = currentMeta(rawMeta), doc = new PDF(logo), p = doc.page();
    header(p, doc, 'ANÁLISE INDIVIDUAL', 'Indicadores cadastrados | parecer técnico preliminar', meta, 1, 2, 'IND');
    infoStrip(p, meta);
    p.text('EQUIPAMENTO AVALIADO', M, 195, 8.1, true, C.muted);
    p.text(name(x), M, 214, 22, true, C.dark, W - 2 * M);
    p.text(category(x), M, 247, 10.4, false, C.muted, W - 2 * M);
    section(p, 'INDICADORES PRINCIPAIS', 274);
    const mGap = 8, mW = (W - 2 * M - 3 * mGap) / 4;
    [
      ['INVESTIMENTO', fmtIf(x, 5, money), 'Valor cadastrado'],
      ['CONSUMO', fmtIf(x, 6, v => decimal(v, 1) + ' L/h'), 'Dado informado'],
      ['MANUTENÇÃO', fmtIf(x, 7, v => money(v) + '/h'), 'Custo parcial'],
      ['DISPONIBILIDADE', fmtIf(x, 8, v => decimal(v, 1) + '%'), 'Dado informado']
    ].forEach((m, i) => metricCard(p, M + i * (mW + mGap), 307, mW, 76, ...m));
    section(p, 'FICHA TÉCNICA DO CADASTRO', 401);
    const specs = [
      ['Categoria', category(x)], ['Fabricante', safe(x[1])], ['Modelo', safe(x[2])],
      ['Ano', safe(x[3])], ['Horímetro', fmtIf(x, 4, v => decimal(v, 0) + ' h')],
      ['Valor de compra', fmtIf(x, 5, money)], ['Consumo informado', fmtIf(x, 6, v => decimal(v, 1) + ' L/h')],
      ['Manutenção informada', fmtIf(x, 7, v => money(v) + '/h')],
      ['Disponibilidade', fmtIf(x, 8, v => decimal(v, 1) + '%')], ['Situação', safe(x[9])]
    ];
    p.rect(M, 433, W - 2 * M, 25, C.dark);
    p.text('CAMPO', M + 12, 441, 8, true, C.white);
    p.text('VALOR INFORMADO', M + 222, 441, 8, true, C.white);
    specs.forEach(([key, val], i) => {
      const yy = 458 + i * 24;
      if (i % 2 === 0) p.rect(M, yy, W - 2 * M, 24, C.light);
      p.text(key, M + 12, yy + 6.5, 8.4, true, C.dark, 190);
      p.text(val, M + 222, yy + 6.5, 8.5, false, C.text, W - 2 * M - 234);
      p.line(M, yy + 24, W - M, yy + 24, C.line, .3);
    });
    section(p, 'LEITURA EXECUTIVA', 713);
    p.paragraph('O cadastro apresenta disponibilidade de ' + fmtIf(x, 8, v => decimal(v, 1) + '%') + ', consumo de ' + fmtIf(x, 6, v => decimal(v, 1) + ' L/h') + ' e manutenção informada de ' + fmtIf(x, 7, v => money(v) + '/h') + '. Os indicadores são descritivos e dependem de validação operacional.', M + 2, 746, W - 2 * M - 4, 8.7, C.text, 12, 4);

    const p2 = doc.page();
    header(p2, doc, 'PARECER E METODOLOGIA', name(x) + ' | análise individual', meta, 2, 2, 'IND');
    infoStrip(p2, meta);
    section(p2, 'PAINEL DE INDICADORES', 191);
    const half = (W - 2 * M - 12) / 2;
    progressPanel(p2, M, 224, half, 111, 'DISPONIBILIDADE INFORMADA', num(x[8]), 'Percentual do cadastro', true);
    progressPanel(p2, M + half + 12, 224, half, 111, 'SCORE MAQON (INDICATIVO)', score(x), 'Heurística não validada', false, '/100');
    numericPanel(p2, M, 348, half, 105, 'CONSUMO INFORMADO', fmtIf(x, 6, v => decimal(v, 1) + ' L/h'), 'Sem referência de produção por hora');
    numericPanel(p2, M + half + 12, 348, half, 105, 'MANUTENÇÃO POR HORA', fmtIf(x, 7, v => money(v) + '/h'), 'Não representa custo operacional total');
    section(p2, 'PARECER TÉCNICO PRELIMINAR', 471);
    const sc = score(x), level = sc >= 85 ? 'elevada' : sc >= 70 ? 'consistente' : sc >= 55 ? 'intermediária' : 'que requer atenção';
    const text = name(x) + ' apresenta disponibilidade cadastrada de ' + fmtIf(x, 8, v => decimal(v, 1) + '%') + ', consumo de ' + fmtIf(x, 6, v => decimal(v, 1) + ' L/h') + ' e custo de manutenção informado de ' + fmtIf(x, 7, v => money(v) + '/h') + '. O Score MAQON é ' + sc + '/100, classificação heurística ' + level + '. Sem dados de produtividade e custo total não é possível recomendar a compra de forma conclusiva.';
    p2.paragraph(text, M + 2, 506, W - 2 * M - 4, 9.2, C.text, 13.2, 6);
    section(p2, 'VERIFICAÇÕES ANTES DA DECISÃO', 596);
    p2.rect(M, 627, half, 100, C.light);
    p2.rect(M, 627, 4, 100, C.gold);
    p2.text('OPERAÇÃO E DESEMPENHO', M + 12, 638, 8.6, true, C.dark, half - 24);
    p2.paragraph('Aplicação e material; produção por hora; ciclos; condições do terreno; histórico de falhas; disponibilidade real e manutenção preventiva.', M + 12, 658, half - 24, 8.4, C.text, 11.5, 5);
    p2.rect(M + half + 12, 627, half, 100, C.light);
    p2.rect(M + half + 12, 627, 4, 100, C.gold);
    p2.text('CUSTOS E VIABILIDADE', M + half + 24, 638, 8.6, true, C.dark, half - 24);
    p2.paragraph('Preço do combustível; horas anuais; operador; pneus/rodante; depreciação; seguro; transporte; tributos e valor residual.', M + half + 24, 658, half - 24, 8.4, C.text, 11.5, 5);
    p2.rect(M, 740, W - 2 * M, 59, P.cream);
    p2.rect(M, 740, 4, 59, C.gold);
    p2.text('LIMITAÇÕES E METODOLOGIA', M + 12, 747, 8.1, true, C.dark);
    p2.paragraph('Score heurístico: disponibilidade 35%, consumo 20%, manutenção 20%, horímetro 10% e idade 15%. Pesos e normalizações não validados. Valores do cadastro não auditados; este documento não é laudo pericial nem recomendação definitiva.', M + 12, 762, W - 2 * M - 24, 8, C.text, 10.6, 4);
    return doc.build();
  }
  async function loadLogo() {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#0e1417'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          const data = canvas.toDataURL('image/jpeg', .92).split(',')[1];
          resolve({w: canvas.width, h: canvas.height, data: atob(data)});
        } catch (_) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = 'maqon-logo-original-aprovada.png';
    });
  }
  const logoPromise = loadLogo();
  function status(button, message, isError) {
    const span = button.parentElement && button.parentElement.querySelector('.maqon-pdf-status');
    if (span) { span.textContent = message; span.style.color = isError ? '#ffb4a6' : '#b8dfc1'; }
  }
  function download(bytes, filename) {
    const blob = new Blob([bytes], {type: 'application/pdf'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function actionRow(buttonText, id) {
    const wrap = document.createElement('div');
    wrap.className = 'maqon-pdf-actions';
    wrap.style.cssText = 'display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:18px;';
    const button = document.createElement('button');
    button.id = id; button.type = 'button'; button.className = 'primary';
    button.textContent = '⬇ ' + buttonText;
    button.style.cssText = 'background:linear-gradient(#ffdb58,#dfaa06);color:#141414;font-weight:800;min-height:41px;padding:8px 16px;border:0;border-radius:6px;cursor:pointer;';
    const small = document.createElement('span');
    small.className = 'maqon-pdf-status';
    small.style.cssText = 'font-size:12px;color:#b8dfc1;';
    small.textContent = 'PDF Executivo A4 • 2 páginas • Dados de demonstração';
    wrap.append(button, small);
    const details = document.createElement('details');
    details.style.cssText = 'flex:1 1 100%;border:1px solid #384c52;border-radius:6px;padding:9px 12px;color:#e4e8e9;max-width:820px;';
    const summary = document.createElement('summary');
    summary.textContent = 'Personalizar relatório: cliente, elaboração e dados reais/demonstração';
    summary.style.cssText = 'cursor:pointer;font-size:12px;color:#f3c744;font-weight:700;';
    details.append(summary);
    const fields = document.createElement('div');
    fields.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;align-items:center;';
    const client = document.createElement('input');
    client.type = 'text'; client.placeholder = 'Cliente / empresa (opcional)'; client.maxLength = 90;
    client.style.cssText = 'flex:1 1 220px;padding:9px;border:1px solid #52656a;border-radius:4px;background:#071115;color:#fff;min-width:0;';
    const responsible = document.createElement('input');
    responsible.type = 'text'; responsible.placeholder = 'Elaboração (opcional)'; responsible.maxLength = 90;
    responsible.style.cssText = client.style.cssText;
    const demoLabel = document.createElement('label');
    demoLabel.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12px;flex:1 1 100%;';
    const demo = document.createElement('input'); demo.type = 'checkbox'; demo.checked = true;
    demoLabel.append(demo, document.createTextNode('Dados fictícios / demonstração (desmarque apenas para dados reais)'));
    fields.append(client, responsible, demoLabel);
    details.append(fields);
    wrap.append(details);
    demo.addEventListener('change', () => { small.textContent = demo.checked ? 'PDF Executivo A4 • 2 páginas • Dados de demonstração' : 'PDF Executivo A4 • 2 páginas • Dados cadastrados'; });
    return {wrap, button, readMeta: () => ({client: client.value, responsible: responsible.value, demo: demo.checked, date: new Date()})};
  }
  function init() {
    const compareSummary = document.getElementById('compareSummary');
    const analysisButton = document.getElementById('runAnalysis');
    if (compareSummary && !document.getElementById('maqonPdfComparativo')) {
      const {wrap, button, readMeta} = actionRow('Gerar Relatório Comparativo Premium em PDF', 'maqonPdfComparativo');
      compareSummary.insertAdjacentElement('afterend', wrap);
      button.addEventListener('click', async () => {
        try {
          const all = rows();
          const indices = [1,2,3].map(i => document.getElementById('compare' + i))
            .filter(Boolean).map(s => s.value).filter(v => v !== '');
          if (indices.length < 2) { status(button, 'Selecione ao menos 2 máquinas.', true); return; }
          if (new Set(indices).size !== indices.length) { status(button, 'Selecione máquinas diferentes.', true); return; }
          const selected = indices.map(i => all[Number(i)]).filter(Boolean);
          if (selected.length !== indices.length) { status(button, 'Recarregue a página e selecione as máquinas novamente.', true); return; }
          button.disabled = true; status(button, 'Preparando relatório premium...');
          const meta = readMeta();
          const bytes = reportComparison(selected, await logoPromise, meta);
          download(bytes, 'MAQON_Comparativo_Premium_' + dateFile(meta.date) + '.pdf');
          status(button, 'PDF premium gerado. Confira seus downloads.');
        } catch (e) { console.error('[MAQON PDF]', e); status(button, 'Erro ao gerar PDF. Verifique o console.', true); }
        finally { button.disabled = false; }
      });
    }
    if (analysisButton && !document.getElementById('maqonPdfIndividual')) {
      const {wrap, button, readMeta} = actionRow('Gerar Relatório Técnico Premium em PDF', 'maqonPdfIndividual');
      analysisButton.insertAdjacentElement('afterend', wrap);
      wrap.style.marginTop = '8px';
      button.addEventListener('click', async () => {
        try {
          const select = document.getElementById('analysisEquipment');
          const all = rows();
          if (!select || select.value === '' || !all[Number(select.value)]) {
            status(button, 'Selecione um equipamento cadastrado.', true); return;
          }
          button.disabled = true; status(button, 'Preparando relatório premium...');
          const meta = readMeta();
          const bytes = reportIndividual(all[Number(select.value)], await logoPromise, meta);
          download(bytes, 'MAQON_Analise_Premium_' + dateFile(meta.date) + '.pdf');
          status(button, 'PDF premium gerado. Confira seus downloads.');
        } catch (e) { console.error('[MAQON PDF]', e); status(button, 'Erro ao gerar PDF. Verifique o console.', true); }
        finally { button.disabled = false; }
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // Interface de teste; não interfere com o restante da plataforma.
  if (typeof window !== 'undefined') {
    window.MAQON_PDF_V1511 = {comparisonReport: reportComparison, individualReport: reportIndividual, score};
    window.MAQON_PDF_V1510 = window.MAQON_PDF_V1511;
  }
})();
