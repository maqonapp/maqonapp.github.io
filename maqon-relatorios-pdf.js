/* MAQON V1.5.10 - Relatorios tecnicos PDF (sem dependencias externas).
   Nao altera cadastros, CRM, comparativos, analises ou biblioteca.
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

  function header(p, doc, title, subtitle, pageNo, total) {
    p.rect(0, 0, W, 113, C.black);
    p.rect(0, 110, W, 4, C.gold);
    if (doc.logo) p.image(36, 20, 213, 87);
    else { p.text('MAQON', 38, 28, 34, true, C.gold); p.text('CONSULTORIA EM EQUIPAMENTOS PESADOS', 40, 72, 9, true, C.white); }
    p.text('RELATÓRIO TÉCNICO', 282, 32, 15, true, C.gold, 272);
    p.paragraph(title + '  |  ' + subtitle, 282, 57, 265, 9, C.white, 12, 3);
    p.text('Emitido em ' + stamp(), 282, 93, 8, false, C.white);
    p.line(M, 811, W - M, 811, C.line);
    p.text('MAQON  |  Consultoria em Equipamentos Pesados  |  maqonapp@gmail.com', M, 817, 7.2, false, C.muted, 475);
    p.text(pageNo + ' / ' + total, W - 62, 817, 7.5, true, C.muted);
  }
  function section(p, label, y) {
    p.rect(M, y + 2, 4, 16, C.gold);
    p.text(label, M + 13, y, 12, true, C.dark, W - 2 * M - 14);
    p.line(M, y + 24, W - M, y + 24, C.line);
  }
  function rowTable(p, cells, y, widths, h, index) {
    if (index % 2 === 0) p.rect(M, y, W - 2 * M, h, C.light);
    let x = M + 8;
    cells.forEach((cell, j) => {
      const w = widths[j];
      const size = j === 0 ? 8.1 : 7.7;
      const lines = linesFor(cell, w - 14, size, j === 0);
      const top = y + (lines.length > 1 ? 4 : (h - size) / 2 - 1);
      lines.slice(0, 2).forEach((line, i) => p.text(line, x, top + i * 9, size, j === 0, j === 0 ? C.dark : C.text, w - 14));
      x += w;
    });
    p.line(M, y + h, W - M, y + h, C.line, .35);
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
  function note(p, text, y, h) {
    p.rect(M, y, W - 2 * M, h, C.light);
    p.rect(M, y, 3, h, C.gold);
    p.paragraph(text, M + 12, y + 9, W - 2 * M - 24, 8.2, C.text, 11.6, Math.floor((h - 13) / 11.6));
  }
  function chart(p, title, data, idx, low, y, format) {
    p.text(title, M, y, 10.5, true, C.dark);
    p.text(low ? 'Menor é melhor' : 'Maior é melhor', W - M - 108, y + 1, 7.5, false, C.muted);
    const vals = data.map(x => isMeasured(x, idx) ? num(x[idx]) : null);
    const available = vals.filter(v => v !== null);
    const high = Math.max(...available, 1), lowVal = available.length ? Math.min(...available) : 0;
    data.forEach((x, i) => {
      const yy = y + 22 + i * 26;
      const measured = vals[i] !== null;
      const leader = measured && (low ? vals[i] === lowVal : vals[i] === high);
      p.text(name(x), M + 2, yy, 8.5, leader, C.text, 157);
      p.rect(M + 170, yy + 3, 211, 9, C.light);
      if (measured) p.rect(M + 170, yy + 3, Math.max(3, 211 * (vals[i] / high)), 9, leader ? C.gold : C.bar);
      p.text(measured ? format(x[idx]) : 'Sem dados', M + 392, yy, 8.5, leader, C.text, 125);
    });
  }
  function comparisonReport(data, logo) {
    const doc = new PDF(logo), p = doc.page();
    header(p, doc, 'COMPARATIVO', data.length + ' equipamentos selecionados', 1, 2);
    section(p, 'EQUIPAMENTOS ANALISADOS', 134);
    const gap = 9, boxW = (W - 2 * M - (data.length - 1) * gap) / data.length;
    data.forEach((x, i) => {
      const bx = M + i * (boxW + gap);
      p.rect(bx, 169, boxW, 77, C.light);
      p.rect(bx, 169, boxW, 3, C.gold);
      p.text(name(x), bx + 8, 180, 10.5, true, C.dark, boxW - 16);
      p.paragraph(category(x), bx + 8, 197, boxW - 16, 8.1, C.muted, 11, 2);
      p.text('Ano: ' + safe(x[3]) + '  |  ' + decimal(x[4], 0) + ' h', bx + 8, 228, 8, false, C.text, boxW - 16);
    });
    section(p, 'QUADRO COMPARATIVO', 263);
    const widths = [130, ...data.map(() => (W - 2 * M - 130) / data.length)];
    const headings = ['Indicador', ...data.map(x => name(x))];
    const headY = 296;
    p.rect(M, headY, W - 2 * M, 29, C.dark);
    let xx = M + 8;
    headings.forEach((h, i) => { p.paragraph(h, xx, headY + 6, widths[i] - 13, 7.8, C.white, 10, 2, true); xx += widths[i]; });
    const specs = [['Categoria',0],['Fabricante',1],['Modelo',2],['Ano',3],['Horímetro',4],['Valor de compra',5],['Consumo',6],['Manutenção por hora',7],['Disponibilidade',8],['Situação',9],['Score MAQON (indicativo)',10]];
    specs.forEach(([label, idx], i) => rowTable(p, [label, ...data.map(x => valueCell(x, idx))], headY + 29 + i * 25, widths, 25, i));
    section(p, 'DESTAQUES DO COMPARATIVO', 614);
    const conclusions = [
      ['Menor investimento inicial', best(data, 5, true), x => money(x[5])],
      ['Menor consumo informado', best(data, 6, true), x => decimal(x[6], 1) + ' L/h'],
      ['Menor manutenção informada', best(data, 7, true), x => money(x[7]) + '/h'],
      ['Maior disponibilidade', best(data, 8, false), x => decimal(x[8], 1) + '%']
    ];
    conclusions.forEach(([label, x, format], i) => {
      const yy = 648 + i * 31;
      p.rect(M, yy + 1, 5, 17, C.gold);
      p.text(label + ':', M + 12, yy, 9, true, C.dark, 183);
      p.text(x ? name(x) + ' (' + format(x) + ')' : 'Dados não informados', M + 190, yy, 9, false, C.text, W - 2 * M - 198);
    });
    p.text('* Score indicativo: metodologia ainda não validada para decisão de compra.', M, 786, 7.4, false, C.muted, 518);

    const p2 = doc.page();
    header(p2, doc, 'INDICADORES E CONCLUSÕES', 'Comparativo gráfico e parecer preliminar', 2, 2);
    section(p2, 'GRÁFICOS DOS INDICADORES', 133);
    chart(p2, 'Valor de compra (R$)', data, 5, true, 168, money);
    chart(p2, 'Consumo informado (L/h)', data, 6, true, 283, v => decimal(v, 1) + ' L/h');
    chart(p2, 'Manutenção informada (R$/h)', data, 7, true, 398, v => money(v) + '/h');
    chart(p2, 'Disponibilidade (%)', data, 8, false, 513, v => decimal(v, 1) + '%');
    section(p2, 'CONCLUSÃO TÉCNICA PRELIMINAR', 630);
    const c1 = best(data, 5, true), c2 = best(data, 6, true), c3 = best(data, 7, true), c4 = best(data, 8, false);
    const observations = [
      c1 ? name(c1) + ' tem o menor investimento inicial' : null,
      c3 ? name(c3) + ' tem a menor manutenção informada' : null,
      c2 ? name(c2) + ' tem o menor consumo informado' : null,
      c4 ? name(c4) + ' tem a maior disponibilidade informada' : null
    ].filter(Boolean);
    const conclusion = (observations.length ? observations.join('; ') + '. ' : 'Indicadores numéricos não informados. ') +
      'Não é possível definir a melhor compra sem produtividade, aplicação, combustível monetizado e custo total de propriedade.';
    p2.paragraph(conclusion, M + 2, 662, W - 2 * M - 4, 9.1, C.text, 13, 5);
    note(p2, 'PREMISSAS: valores informados no cadastro, não auditados. Comparação descritiva, não equivale a ensaio de campo. O custo total não inclui combustível em R$, operador, depreciação, pneus/rodante, seguros, transporte e tributos. Score MAQON: indicador heurístico em revisão.', 735, 67);
    return doc.build();
  }
  function individualReport(x, logo) {
    const doc = new PDF(logo), p = doc.page();
    header(p, doc, 'ANÁLISE INDIVIDUAL', name(x) + ' - ' + category(x), 1, 1);
    section(p, 'IDENTIFICAÇÃO DO EQUIPAMENTO', 134);
    p.text(name(x), M + 2, 170, 18, true, C.dark, W - 2 * M - 4);
    p.paragraph(category(x), M + 2, 195, W - 2 * M - 4, 10, C.muted, 13, 2);
    const metrics = [
      ['MANUTENÇÃO INFORMADA', money(x[7]) + '/h'],
      ['DISPONIBILIDADE', decimal(x[8], 1) + '%'],
      ['SCORE MAQON*', score(x) + '/100']
    ];
    const gap = 9, bw = (W - 2 * M - 2 * gap) / 3;
    metrics.forEach(([label, value], i) => {
      const bx = M + i * (bw + gap);
      p.rect(bx, 239, bw, 77, C.dark);
      p.rect(bx, 239, bw, 4, C.gold);
      p.text(label, bx + 10, 252, 8, true, C.white, bw - 20);
      p.text(value, bx + 10, 273, 17, true, C.gold, bw - 20);
    });
    section(p, 'DADOS TÉCNICOS CADASTRADOS', 336);
    const specs = [['Categoria', category(x)],['Fabricante',safe(x[1])],['Modelo',safe(x[2])],['Ano',safe(x[3])],['Horímetro',decimal(x[4],0) + ' h'],['Valor de compra',money(x[5])],['Consumo informado',decimal(x[6],1) + ' L/h'],['Manutenção informada',money(x[7]) + '/h'],['Disponibilidade',decimal(x[8],1) + '%'],['Situação',safe(x[9])]];
    specs.forEach(([label, value], i) => rowTable(p, [label, value], 369 + i * 23, [200, W - 2 * M - 200], 23, i));
    section(p, 'PARECER TÉCNICO PRELIMINAR', 613);
    const sc = score(x), level = sc >= 85 ? 'elevado' : sc >= 70 ? 'consistente' : sc >= 55 ? 'intermediário' : 'que exige atenção';
    const summary = name(x) + ' possui disponibilidade informada de ' + decimal(x[8],1) +
      '%, consumo de ' + decimal(x[6],1) + ' L/h e manutenção de ' + money(x[7]) +
      '/h. O Score MAQON indicativo é ' + sc + '/100 (desempenho ' + level +
      '). O custo operacional total não pode ser calculado com os dados disponíveis.';
    p.paragraph(summary, M + 2, 646, W - 2 * M - 4, 9.1, C.text, 13, 5);
    note(p, 'METODOLOGIA E LIMITAÇÕES: score heurístico calculado a partir de disponibilidade (35%), consumo (20%), manutenção (20%), horímetro (10%) e idade (15%). Pesos e normalizações não foram validados tecnicamente. Não inclui combustível em R$, depreciação, operador, pneus/rodante, seguros ou produtividade. Não constitui laudo pericial ou recomendação definitiva.', 724, 77);
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
          const data = canvas.toDataURL('image/jpeg', .89).split(',')[1];
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
    if (span) { span.textContent = message; span.style.color = isError ? '#ffb4a6' : '#a9d9ae'; }
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
    button.style.cssText = 'background:linear-gradient(#ffdb58,#dfaa06);color:#141414;font-weight:800;min-height:39px;padding:8px 16px;border:0;border-radius:6px;cursor:pointer;';
    const small = document.createElement('span');
    small.className = 'maqon-pdf-status';
    small.style.cssText = 'font-size:12px;color:#aab7bd;';
    small.textContent = 'PDF A4 • Download direto • Sem envio de dados';
    wrap.append(button, small);
    return {wrap, button};
  }
  function init() {
    const compareSummary = document.getElementById('compareSummary');
    const analysisButton = document.getElementById('runAnalysis');
    if (compareSummary && !document.getElementById('maqonPdfComparativo')) {
      const {wrap, button} = actionRow('Gerar Relatório Comparativo em PDF', 'maqonPdfComparativo');
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
          button.disabled = true; status(button, 'Preparando relatório...');
          const bytes = comparisonReport(selected, await logoPromise);
          download(bytes, 'MAQON_Relatorio_Comparativo_' + filenameDate() + '.pdf');
          status(button, 'Relatório PDF gerado. Confira seus downloads.');
        } catch (e) { console.error('[MAQON PDF]', e); status(button, 'Erro ao gerar PDF. Verifique o console.', true); }
        finally { button.disabled = false; }
      });
    }
    if (analysisButton && !document.getElementById('maqonPdfIndividual')) {
      const {wrap, button} = actionRow('Gerar Relatório Técnico em PDF', 'maqonPdfIndividual');
      // Mantém o botão original de Gerar Análise intacto.
      analysisButton.insertAdjacentElement('afterend', wrap);
      wrap.style.marginTop = '0';
      button.addEventListener('click', async () => {
        try {
          const select = document.getElementById('analysisEquipment');
          const all = rows();
          if (!select || select.value === '' || !all[Number(select.value)]) {
            status(button, 'Selecione um equipamento cadastrado.', true); return;
          }
          button.disabled = true; status(button, 'Preparando relatório...');
          const bytes = individualReport(all[Number(select.value)], await logoPromise);
          download(bytes, 'MAQON_Relatorio_Tecnico_' + filenameDate() + '.pdf');
          status(button, 'Relatório PDF gerado. Confira seus downloads.');
        } catch (e) { console.error('[MAQON PDF]', e); status(button, 'Erro ao gerar PDF. Verifique o console.', true); }
        finally { button.disabled = false; }
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // API apenas para testes automatizados; não altera o funcionamento da plataforma.
  if (typeof window !== 'undefined') window.MAQON_PDF_V1510 = {comparisonReport, individualReport, score};
})();
