// Визуальный редактор форм в стиле Конфигуратора 1С:
// слева — элементы формы, в центре — превью, справа — свойства элемента.
// Форма хранится в метаданных: Формы: [{ Имя, Элементы: [...] }]

// Стандартные реквизиты по виду объекта
function standardFields(kind1c) {
  if (kind1c === 'Справочник') return [
    { имя: 'Код', синоним: 'Код', тип: 'Строка' },
    { имя: 'Наименование', синоним: 'Наименование', тип: 'Строка' }
  ];
  if (kind1c === 'Документ') return [
    { имя: 'Номер', синоним: 'Номер', тип: 'Строка' },
    { имя: 'Дата', синоним: 'Дата', тип: 'Дата' }
  ];
  return [];
}

// Форма по умолчанию (как «создать форму» в 1С)
function defaultElements(info) {
  const els = [];
  for (const f of standardFields(info.вид).concat(info.реквизиты))
    els.push({ Тип: 'Поле', Реквизит: f.имя, Заголовок: f.синоним, ТолькоПросмотр: false });
  for (const t of info.таблицы)
    els.push({ Тип: 'Таблица', ТабличнаяЧасть: t.имя, Заголовок: t.синоним });
  els.push({ Тип: 'Кнопка', Действие: 'ЗаписатьИЗакрыть', Заголовок: 'Записать и закрыть' });
  els.push({ Тип: 'Кнопка', Действие: 'Отмена', Заголовок: 'Отмена' });
  return els;
}

function html(info, formName, elements) {
  const data = JSON.stringify({ info, formName, elements }).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: var(--vscode-font-family); font-size: 13px; color: var(--vscode-foreground);
         margin: 0; display: flex; flex-direction: column; height: 100vh; }
  .toolbar { display: flex; gap: 6px; align-items: center; padding: 6px 8px;
             border-bottom: 1px solid var(--vscode-panel-border); flex: none; }
  .toolbar select, .toolbar button {
    background: var(--vscode-button-secondaryBackground, #ddd); color: var(--vscode-button-secondaryForeground, #222);
    border: 1px solid var(--vscode-panel-border); padding: 3px 10px; cursor: pointer; }
  .toolbar button:hover { background: var(--vscode-button-secondaryHoverBackground, #ccc); }
  .cols { display: flex; flex: 1; min-height: 0; }
  .col-list { width: 230px; flex: none; border-right: 1px solid var(--vscode-panel-border); overflow: auto; }
  .col-prev { flex: 1; overflow: auto; background: #d6d9dd; padding: 14px; }
  .col-prop { width: 250px; flex: none; border-left: 1px solid var(--vscode-panel-border); overflow: auto; }
  .hdr { padding: 5px 8px; font-weight: 600; background: var(--vscode-sideBarSectionHeader-background);
         border-bottom: 1px solid var(--vscode-panel-border); position: sticky; top: 0; }
  .el { padding: 4px 8px; cursor: pointer; display: flex; gap: 6px; align-items: center; border: 1px solid transparent; }
  .el:hover { background: var(--vscode-list-hoverBackground); }
  .el.sel { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
  .el .ico { width: 14px; text-align: center; flex: none; }
  .el.drag-over { border-top: 2px solid #ff8c00; }

  /* Превью: управляемая форма 1С */
  .form1c { background: #fff; border: 1px solid #9ba2aa; box-shadow: 0 2px 8px rgba(0,0,0,.25);
            max-width: 640px; margin: 0 auto; color: #333; }
  .form1c .title { background: linear-gradient(#fcfcfc, #e8eaec); color: #333; padding: 6px 10px;
                   font-weight: 600; border-bottom: 1px solid #c5cad0; }
  .form1c .cmdbar { padding: 6px 10px; background: #f6f7f8; border-bottom: 1px solid #e0e3e6;
                    display: flex; gap: 6px; flex-wrap: wrap; }
  .btn1c { background: linear-gradient(#fff, #e9ebee); border: 1px solid #aab2ba; color: #333;
           padding: 4px 14px; border-radius: 2px; cursor: pointer; }
  .btn1c.primary { background: linear-gradient(#ffe27a, #ffce55); border-color: #d9a52f; font-weight: 600; }
  .btn1c.sel-el, .fld.sel-el, .tbl1c.sel-el { outline: 2px solid #ff8c00; outline-offset: 1px; }
  .form1c .body { padding: 10px 12px 14px; }
  .fld { display: flex; align-items: center; margin: 5px 0; cursor: pointer; }
  .fld label { width: 170px; flex: none; color: #444; }
  .fld input { flex: 1; border: 1px solid #aab2ba; padding: 3px 6px; background: #fff; color: #333;
               border-radius: 2px; pointer-events: none; }
  .fld input.ro { background: #f0f1f3; }
  .tbl1c { margin: 8px 0; cursor: pointer; }
  .tbl1c .cap { font-weight: 600; color: #444; margin-bottom: 3px; }
  .tbl1c table { border-collapse: collapse; width: 100%; }
  .tbl1c th { background: #eef0f2; border: 1px solid #c5cad0; padding: 3px 6px; text-align: left; font-weight: 600; color: #444; }
  .tbl1c td { border: 1px solid #d8dce0; padding: 3px 6px; height: 14px; }

  /* Свойства */
  .prop { display: flex; border-bottom: 1px solid var(--vscode-panel-border); }
  .prop .lbl { width: 45%; padding: 4px 8px; border-right: 1px solid var(--vscode-panel-border); }
  .prop .val { flex: 1; padding: 2px; }
  .prop input[type=text] { width: 100%; background: var(--vscode-input-background); color: var(--vscode-input-foreground);
                            border: 1px solid transparent; padding: 3px 5px; }
  .prop input[type=text]:focus { outline: none; border-color: var(--vscode-focusBorder); }
  .prop .ro { padding: 4px 6px; color: var(--vscode-descriptionForeground); }
  .empty { padding: 12px; color: var(--vscode-descriptionForeground); }
</style></head>
<body>
  <div class="toolbar">
    <select id="addSelect"></select>
    <button id="btnAdd">Добавить</button>
    <span style="flex:1"></span>
    <button id="btnUp" title="Переместить вверх">▲</button>
    <button id="btnDown" title="Переместить вниз">▼</button>
    <button id="btnDel" title="Удалить элемент">✕ Удалить</button>
  </div>
  <div class="cols">
    <div class="col-list"><div class="hdr">Элементы формы</div><div id="list"></div></div>
    <div class="col-prev"><div class="form1c" id="preview"></div></div>
    <div class="col-prop"><div class="hdr">Свойства</div><div id="props"></div></div>
  </div>
<script>
  const vscode = acquireVsCodeApi();
  const data = ${data};
  const info = data.info;
  let els = data.elements;
  let sel = els.length ? 0 : -1;
  let saveTimer = null;

  const ICONS = { 'Поле': '▭', 'Таблица': '▦', 'Кнопка': '🔘' };

  function fieldDef(name) {
    return info.стандартные.find(f => f.имя === name) || info.реквизиты.find(f => f.имя === name);
  }
  function tabularDef(name) { return info.таблицы.find(t => t.имя === name); }
  function elTitle(e) {
    if (e.Тип === 'Поле') return e.Заголовок || e.Реквизит;
    if (e.Тип === 'Таблица') return e.Заголовок || e.ТабличнаяЧасть;
    return e.Заголовок || e.Действие;
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => vscode.postMessage({ type: 'save', elements: els }), 250);
  }

  function render() {
    // --- список элементов ---
    const list = document.getElementById('list');
    list.innerHTML = '';
    els.forEach((e, i) => {
      const div = document.createElement('div');
      div.className = 'el' + (i === sel ? ' sel' : '');
      div.draggable = true;
      div.innerHTML = '<span class="ico">' + (ICONS[e.Тип] || '•') + '</span><span>' + elTitle(e) + '</span>';
      div.onclick = () => { sel = i; render(); };
      div.ondragstart = ev => ev.dataTransfer.setData('text/plain', String(i));
      div.ondragover = ev => { ev.preventDefault(); div.classList.add('drag-over'); };
      div.ondragleave = () => div.classList.remove('drag-over');
      div.ondrop = ev => {
        ev.preventDefault();
        const from = parseInt(ev.dataTransfer.getData('text/plain'), 10);
        if (isNaN(from) || from === i) return;
        const [moved] = els.splice(from, 1);
        els.splice(i, 0, moved);
        sel = i; scheduleSave(); render();
      };
      list.appendChild(div);
    });

    // --- превью ---
    const pv = document.getElementById('preview');
    pv.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = info.синоним + ' (' + data.formName + ')';
    pv.appendChild(title);

    const buttons = els.map((e, i) => ({ e, i })).filter(x => x.e.Тип === 'Кнопка');
    if (buttons.length) {
      const bar = document.createElement('div');
      bar.className = 'cmdbar';
      for (const { e, i } of buttons) {
        const b = document.createElement('button');
        b.className = 'btn1c' + (e.Действие === 'ЗаписатьИЗакрыть' ? ' primary' : '') + (i === sel ? ' sel-el' : '');
        b.textContent = elTitle(e);
        b.onclick = () => { sel = i; render(); };
        bar.appendChild(b);
      }
      pv.appendChild(bar);
    }

    const body = document.createElement('div');
    body.className = 'body';
    els.forEach((e, i) => {
      if (e.Тип === 'Поле') {
        const row = document.createElement('div');
        row.className = 'fld' + (i === sel ? ' sel-el' : '');
        const lab = document.createElement('label');
        lab.textContent = elTitle(e) + ':';
        const inp = document.createElement('input');
        if (e.ТолькоПросмотр) inp.className = 'ro';
        const def = fieldDef(e.Реквизит);
        inp.value = def && def.тип && def.тип.includes('Ссылка') ? '<выбор из списка>' : '';
        row.appendChild(lab); row.appendChild(inp);
        row.onclick = () => { sel = i; render(); };
        body.appendChild(row);
      } else if (e.Тип === 'Таблица') {
        const t = tabularDef(e.ТабличнаяЧасть);
        const wrap = document.createElement('div');
        wrap.className = 'tbl1c' + (i === sel ? ' sel-el' : '');
        let ths = '<th>N</th>';
        for (const a of (t ? t.реквизиты : [])) ths += '<th>' + (a.синоним || a.имя) + '</th>';
        const cols = (t ? t.реквизиты.length : 0) + 1;
        let rows = '';
        for (let r = 1; r <= 2; r++) {
          rows += '<tr>' + '<td></td>'.repeat(cols) + '</tr>';
        }
        wrap.innerHTML = '<div class="cap">' + elTitle(e) + '</div><table><tr>' + ths + '</tr>' + rows + '</table>';
        wrap.onclick = () => { sel = i; render(); };
        body.appendChild(wrap);
      }
    });
    pv.appendChild(body);

    // --- свойства ---
    const props = document.getElementById('props');
    props.innerHTML = '';
    if (sel < 0 || !els[sel]) {
      props.innerHTML = '<div class="empty">Выберите элемент формы</div>';
    } else {
      const e = els[sel];
      const addProp = (label, valueHtml) => {
        const p = document.createElement('div');
        p.className = 'prop';
        p.innerHTML = '<div class="lbl">' + label + '</div><div class="val">' + valueHtml + '</div>';
        props.appendChild(p);
      };
      addProp('Тип', '<div class="ro">' + e.Тип + '</div>');
      if (e.Тип === 'Поле') addProp('Реквизит', '<div class="ro">' + e.Реквизит + '</div>');
      if (e.Тип === 'Таблица') addProp('Табличная часть', '<div class="ro">' + e.ТабличнаяЧасть + '</div>');
      if (e.Тип === 'Кнопка') addProp('Действие', '<div class="ro">' + e.Действие + '</div>');
      addProp('Заголовок', '<input type="text" id="pTitle" value="' + (e.Заголовок || '').replace(/"/g, '&quot;') + '">');
      if (e.Тип === 'Поле')
        addProp('Только просмотр', '<input type="checkbox" id="pRO"' + (e.ТолькоПросмотр ? ' checked' : '') + '>');

      const pTitle = document.getElementById('pTitle');
      pTitle.addEventListener('input', () => { e.Заголовок = pTitle.value; scheduleSave(); renderSoft(); });
      const pRO = document.getElementById('pRO');
      if (pRO) pRO.addEventListener('change', () => { e.ТолькоПросмотр = pRO.checked; scheduleSave(); render(); });
    }

    // --- выпадающий список добавления ---
    const used = new Set(els.filter(e => e.Тип === 'Поле').map(e => e.Реквизит));
    const usedT = new Set(els.filter(e => e.Тип === 'Таблица').map(e => e.ТабличнаяЧасть));
    const addSel = document.getElementById('addSelect');
    addSel.innerHTML = '';
    const og1 = document.createElement('optgroup'); og1.label = 'Поля';
    for (const f of info.стандартные.concat(info.реквизиты))
      if (!used.has(f.имя)) og1.appendChild(new Option(f.синоним || f.имя, 'f:' + f.имя));
    const og2 = document.createElement('optgroup'); og2.label = 'Таблицы';
    for (const t of info.таблицы)
      if (!usedT.has(t.имя)) og2.appendChild(new Option(t.синоним || t.имя, 't:' + t.имя));
    const og3 = document.createElement('optgroup'); og3.label = 'Кнопки';
    og3.appendChild(new Option('Записать и закрыть', 'b:ЗаписатьИЗакрыть'));
    og3.appendChild(new Option('Отмена', 'b:Отмена'));
    if (og1.children.length) addSel.appendChild(og1);
    if (og2.children.length) addSel.appendChild(og2);
    addSel.appendChild(og3);
  }

  // лёгкая перерисовка (не трогая фокус в свойствах) — обновить подписи в списке и превью
  function renderSoft() {
    const list = document.getElementById('list');
    [...list.children].forEach((div, i) => { div.children[1].textContent = elTitle(els[i]); });
    const pv = document.getElementById('preview');
    const e = els[sel];
    pv.querySelectorAll('.fld label').forEach((lab, idx) => {
      const fields = els.filter(x => x.Тип === 'Поле');
      if (fields[idx]) lab.textContent = elTitle(fields[idx]) + ':';
    });
    pv.querySelectorAll('.btn1c').forEach((b, idx) => {
      const btns = els.filter(x => x.Тип === 'Кнопка');
      if (btns[idx]) b.textContent = elTitle(btns[idx]);
    });
    pv.querySelectorAll('.tbl1c .cap').forEach((c, idx) => {
      const tbls = els.filter(x => x.Тип === 'Таблица');
      if (tbls[idx]) c.textContent = elTitle(tbls[idx]);
    });
  }

  document.getElementById('btnAdd').onclick = () => {
    const v = document.getElementById('addSelect').value;
    if (!v) return;
    const [k, name] = [v.slice(0, 1), v.slice(2)];
    if (k === 'f') {
      const d = fieldDef(name);
      els.push({ Тип: 'Поле', Реквизит: name, Заголовок: d ? d.синоним : name, ТолькоПросмотр: false });
    } else if (k === 't') {
      const d = tabularDef(name);
      els.push({ Тип: 'Таблица', ТабличнаяЧасть: name, Заголовок: d ? d.синоним : name });
    } else {
      els.push({ Тип: 'Кнопка', Действие: name, Заголовок: name === 'ЗаписатьИЗакрыть' ? 'Записать и закрыть' : 'Отмена' });
    }
    sel = els.length - 1; scheduleSave(); render();
  };
  document.getElementById('btnDel').onclick = () => {
    if (sel < 0) return;
    els.splice(sel, 1);
    sel = Math.min(sel, els.length - 1);
    scheduleSave(); render();
  };
  document.getElementById('btnUp').onclick = () => {
    if (sel <= 0) return;
    [els[sel - 1], els[sel]] = [els[sel], els[sel - 1]];
    sel--; scheduleSave(); render();
  };
  document.getElementById('btnDown').onclick = () => {
    if (sel < 0 || sel >= els.length - 1) return;
    [els[sel + 1], els[sel]] = [els[sel], els[sel + 1]];
    sel++; scheduleSave(); render();
  };

  render();
</script>
</body></html>`;
}

module.exports = { html, defaultElements, standardFields };
