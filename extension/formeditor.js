// Визуальный редактор форм в стиле Конфигуратора 1С:
// слева — ДЕРЕВО элементов формы (иерархия, как в 1С), в центре — превью, справа — свойства.
// Форма хранится в метаданных: Формы: [{ Имя, Элементы: [...] }]
// Элемент: { Тип: Поле|Таблица|Кнопка|Группа|Страницы|Страница, ..., Элементы: [...] }

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
  .col-list { width: 250px; flex: none; border-right: 1px solid var(--vscode-panel-border); overflow: auto; }
  .col-prev { flex: 1; overflow: auto; background: #d6d9dd; padding: 14px; }
  .col-prop { width: 250px; flex: none; border-left: 1px solid var(--vscode-panel-border); overflow: auto; }
  .hdr { padding: 5px 8px; font-weight: 600; background: var(--vscode-sideBarSectionHeader-background);
         border-bottom: 1px solid var(--vscode-panel-border); position: sticky; top: 0; }
  .el { padding: 4px 8px; cursor: pointer; display: flex; gap: 6px; align-items: center; border: 1px solid transparent; }
  .el:hover { background: var(--vscode-list-hoverBackground); }
  .el.sel { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
  .el .ico { width: 14px; text-align: center; flex: none; }
  .el.drag-over { border-top: 2px solid #ff8c00; }
  .el.drag-into { border: 1px dashed #ff8c00; }

  /* Превью: управляемая форма 1С */
  .form1c { background: #fff; border: 1px solid #9ba2aa; box-shadow: 0 2px 8px rgba(0,0,0,.25);
            max-width: 680px; margin: 0 auto; color: #333; }
  .form1c .title { background: linear-gradient(#fcfcfc, #e8eaec); color: #333; padding: 6px 10px;
                   font-weight: 600; border-bottom: 1px solid #c5cad0; }
  .form1c .cmdbar { padding: 6px 10px; background: #f6f7f8; border-bottom: 1px solid #e0e3e6;
                    display: flex; gap: 6px; flex-wrap: wrap; }
  .btn1c { background: linear-gradient(#fff, #e9ebee); border: 1px solid #aab2ba; color: #333;
           padding: 4px 14px; border-radius: 2px; cursor: pointer; }
  .btn1c.primary { background: linear-gradient(#ffe27a, #ffce55); border-color: #d9a52f; font-weight: 600; }
  .btn1c.sel-el, .fld.sel-el, .tbl1c.sel-el, .grp1c.sel-el, .pages1c.sel-el { outline: 2px solid #ff8c00; outline-offset: 1px; }
  .form1c .body { padding: 10px 12px 14px; }
  .fld { display: flex; align-items: center; margin: 5px 0; cursor: pointer; }
  .fld label { width: 170px; flex: none; color: #444; }
  .fld input { flex: 1; border: 1px solid #aab2ba; padding: 3px 6px; background: #fff; color: #333;
               border-radius: 2px; pointer-events: none; min-width: 40px; }
  .fld input.ro { background: #f0f1f3; }
  .tbl1c { margin: 8px 0; cursor: pointer; }
  .tbl1c .cap { font-weight: 600; color: #444; margin-bottom: 3px; }
  .tbl1c table { border-collapse: collapse; width: 100%; }
  .tbl1c th { background: #eef0f2; border: 1px solid #c5cad0; padding: 3px 6px; text-align: left; font-weight: 600; color: #444; }
  .tbl1c td { border: 1px solid #d8dce0; padding: 3px 6px; height: 14px; }

  /* Группы */
  .grp1c { margin: 4px 0; padding: 2px; border: 1px dashed transparent; cursor: pointer; }
  .grp1c:hover { border-color: #c5cad0; }
  .grp1c > .gcap { font-weight: 600; color: #444; margin: 4px 0 2px; }
  .grp1c > .gbody.h { display: flex; gap: 14px; }
  .grp1c > .gbody.h > * { flex: 1; min-width: 0; }
  .grp1c > .gbody.h .fld label { width: auto; margin-right: 6px; }

  /* Страницы (вкладки) */
  .pages1c { margin: 8px 0 4px; cursor: pointer; }
  .pages1c .tabs { display: flex; gap: 2px; border-bottom: 1px solid #c5cad0; }
  .pages1c .tab { padding: 4px 14px; border: 1px solid #c5cad0; border-bottom: none;
                  border-radius: 3px 3px 0 0; background: #eef0f2; color: #555; cursor: pointer; }
  .pages1c .tab.on { background: #fff; font-weight: 600; color: #222; position: relative; top: 1px; }
  .pages1c .page { border: 1px solid #c5cad0; border-top: none; padding: 8px 10px; background: #fff; }

  /* Свойства */
  .prop { display: flex; border-bottom: 1px solid var(--vscode-panel-border); }
  .prop .lbl { width: 45%; padding: 4px 8px; border-right: 1px solid var(--vscode-panel-border); }
  .prop .val { flex: 1; padding: 2px; }
  .prop input[type=text], .prop select { width: 100%; background: var(--vscode-input-background); color: var(--vscode-input-foreground);
                            border: 1px solid transparent; padding: 3px 5px; }
  .prop input[type=text]:focus, .prop select:focus { outline: none; border-color: var(--vscode-focusBorder); }
  .prop .ro { padding: 4px 6px; color: var(--vscode-descriptionForeground); }
  .empty { padding: 12px; color: var(--vscode-descriptionForeground); }
  .hint { padding: 6px 8px; color: var(--vscode-descriptionForeground); font-size: 11px; }
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
    <div class="col-list"><div class="hdr">Элементы формы</div><div id="list"></div>
      <div class="hint">Перетащите элемент НА группу/страницу, чтобы вложить; МЕЖДУ — чтобы изменить порядок.</div></div>
    <div class="col-prev"><div class="form1c" id="preview"></div></div>
    <div class="col-prop"><div class="hdr">Свойства</div><div id="props"></div></div>
  </div>
<script>
  const vscode = acquireVsCodeApi();
  const data = ${data};
  const info = data.info;
  let els = data.elements;          // корневой массив (дерево: контейнеры имеют .Элементы)
  let sel = els.length ? els[0] : null;  // выбранный ЭЛЕМЕНТ (ссылка на объект)
  let dragged = null;
  let saveTimer = null;
  const activePages = new Map();    // элемент «Страницы» -> активная вкладка (индекс)

  const ICONS = { 'Поле': '▭', 'Таблица': '▦', 'Кнопка': '🔘', 'Группа': '▣', 'Страницы': '🗂', 'Страница': '📄' };
  const CONTAINERS = ['Группа', 'Страницы', 'Страница'];
  const isCont = e => CONTAINERS.includes(e.Тип);
  const kids = e => (e.Элементы || (e.Элементы = []));

  function fieldDef(name) {
    return info.стандартные.find(f => f.имя === name) || info.реквизиты.find(f => f.имя === name);
  }
  function tabularDef(name) { return info.таблицы.find(t => t.имя === name); }
  function elTitle(e) {
    if (e.Тип === 'Поле') return e.Заголовок || e.Реквизит;
    if (e.Тип === 'Таблица') return e.Заголовок || e.ТабличнаяЧасть;
    if (e.Тип === 'Кнопка') return e.Заголовок || e.Действие;
    return e.Заголовок || e.Тип;
  }

  // --- обход дерева ---
  function walk(arr, fn, depth = 0, parentArr = null) {
    arr = arr || [];
    for (let i = 0; i < arr.length; i++) {
      fn(arr[i], depth, arr, i);
      if (arr[i].Элементы) walk(arr[i].Элементы, fn, depth + 1, arr[i].Элементы);
    }
  }
  function findParent(el, arr = els) {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === el) return { arr, i };
      if (arr[i].Элементы) {
        const r = findParent(el, arr[i].Элементы);
        if (r) return r;
      }
    }
    return null;
  }
  function isAncestor(a, b) { // a — предок b?
    if (!a.Элементы) return false;
    for (const c of a.Элементы) {
      if (c === b || isAncestor(c, b)) return true;
    }
    return false;
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => vscode.postMessage({ type: 'save', elements: els }), 250);
  }

  // контейнер, в который добавлять новый элемент данного типа (правила как в 1С:
  // Страница — только внутрь Страниц; внутрь Страниц — только Страницы)
  function insertTarget(тип) {
    if (тип === 'Страница') {
      if (sel && sel.Тип === 'Страницы') return { arr: kids(sel) };
      if (sel && sel.Тип === 'Страница') { // после текущей страницы
        const p = findParent(sel);
        return { arr: p.arr, at: p.i + 1 };
      }
      return null; // некуда
    }
    if (sel && (sel.Тип === 'Группа' || sel.Тип === 'Страница')) return { arr: kids(sel) };
    if (sel) {
      const p = findParent(sel);
      if (p) {
        // нельзя класть не-Страницу внутрь Страниц
        const owner = ownerOf(p.arr);
        if (owner && owner.Тип === 'Страницы') return { arr: els };
        return { arr: p.arr, at: p.i + 1 };
      }
    }
    return { arr: els };
  }
  function ownerOf(arr) { // элемент-владелец массива (null = корень)
    let found = null;
    walk(els, e => { if (e.Элементы === arr) found = e; });
    return found;
  }

  function render() {
    // --- дерево элементов ---
    const list = document.getElementById('list');
    list.innerHTML = '';
    const rowByEl = new Map();
    walk(els, (e, depth) => {
      const div = document.createElement('div');
      div.className = 'el' + (e === sel ? ' sel' : '');
      div.style.paddingLeft = (8 + depth * 16) + 'px';
      div.draggable = true;
      div.innerHTML = '<span class="ico">' + (ICONS[e.Тип] || '•') + '</span><span>' + elTitle(e) + '</span>';
      div.onclick = () => { sel = e; render(); };
      div.ondragstart = ev => { dragged = e; ev.dataTransfer.setData('text/plain', 'x'); };
      div.ondragover = ev => {
        ev.preventDefault();
        div.classList.add(isCont(e) && dragged !== e ? 'drag-into' : 'drag-over');
      };
      div.ondragleave = () => div.classList.remove('drag-over', 'drag-into');
      div.ondrop = ev => {
        ev.preventDefault();
        div.classList.remove('drag-over', 'drag-into');
        if (!dragged || dragged === e || isAncestor(dragged, e)) return;
        const from = findParent(dragged);
        if (!from) return;
        if (isCont(e)) {
          // вложить: Страница — только в Страницы; в Страницы — только Страница
          if (dragged.Тип === 'Страница' && e.Тип !== 'Страницы') return;
          if (e.Тип === 'Страницы' && dragged.Тип !== 'Страница') return;
          from.arr.splice(from.i, 1);
          kids(e).push(dragged);
        } else {
          // перед целевым элементом (в его родителе)
          const to = findParent(e);
          if (!to) return;
          const owner = ownerOf(to.arr);
          if (dragged.Тип === 'Страница' && (!owner || owner.Тип !== 'Страницы')) return;
          if (owner && owner.Тип === 'Страницы' && dragged.Тип !== 'Страница') return;
          from.arr.splice(from.i, 1);
          const to2 = findParent(e); // индексы могли сдвинуться
          to2.arr.splice(to2.i, 0, dragged);
        }
        sel = dragged; dragged = null; scheduleSave(); render();
      };
      list.appendChild(div);
      rowByEl.set(e, div);
    });

    // --- превью ---
    const pv = document.getElementById('preview');
    pv.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = info.синоним + ' (' + data.formName + ')';
    pv.appendChild(title);

    // кнопки (с любого уровня) — в командную панель
    const buttons = [];
    walk(els, e => { if (e.Тип === 'Кнопка') buttons.push(e); });
    if (buttons.length) {
      const bar = document.createElement('div');
      bar.className = 'cmdbar';
      for (const e of buttons) {
        const b = document.createElement('button');
        b.className = 'btn1c' + (e.Действие === 'ЗаписатьИЗакрыть' ? ' primary' : '') + (e === sel ? ' sel-el' : '');
        b.textContent = elTitle(e);
        b.onclick = () => { sel = e; render(); };
        bar.appendChild(b);
      }
      pv.appendChild(bar);
    }

    const body = document.createElement('div');
    body.className = 'body';
    renderInto(els, body);
    pv.appendChild(body);

    function renderInto(arr, dom) {
      for (const e of arr || []) {
        if (e.Тип === 'Кнопка') continue;
        if (e.Тип === 'Поле') {
          const row = document.createElement('div');
          row.className = 'fld' + (e === sel ? ' sel-el' : '');
          const lab = document.createElement('label');
          lab.textContent = elTitle(e) + ':';
          const inp = document.createElement('input');
          if (e.ТолькоПросмотр) inp.className = 'ro';
          const def = fieldDef(e.Реквизит);
          inp.value = def && def.тип && def.тип.includes('Ссылка') ? '<выбор из списка>' : '';
          row.appendChild(lab); row.appendChild(inp);
          row.onclick = ev => { ev.stopPropagation(); sel = e; render(); };
          dom.appendChild(row);
        } else if (e.Тип === 'Таблица') {
          const t = tabularDef(e.ТабличнаяЧасть);
          const wrap = document.createElement('div');
          wrap.className = 'tbl1c' + (e === sel ? ' sel-el' : '');
          let ths = '<th>N</th>';
          for (const a of (t ? t.реквизиты : [])) ths += '<th>' + (a.синоним || a.имя) + '</th>';
          const cols = (t ? t.реквизиты.length : 0) + 1;
          let rows = '';
          for (let r = 1; r <= 2; r++) rows += '<tr>' + '<td></td>'.repeat(cols) + '</tr>';
          wrap.innerHTML = '<div class="cap">' + elTitle(e) + '</div><table><tr>' + ths + '</tr>' + rows + '</table>';
          wrap.onclick = ev => { ev.stopPropagation(); sel = e; render(); };
          dom.appendChild(wrap);
        } else if (e.Тип === 'Группа') {
          const g = document.createElement('div');
          g.className = 'grp1c' + (e === sel ? ' sel-el' : '');
          g.onclick = ev => { ev.stopPropagation(); sel = e; render(); };
          if (e.Заголовок) {
            const cap = document.createElement('div');
            cap.className = 'gcap'; cap.textContent = e.Заголовок;
            g.appendChild(cap);
          }
          const gb = document.createElement('div');
          gb.className = 'gbody' + (e.Группировка === 'Горизонтальная' ? ' h' : '');
          renderInto(e.Элементы, gb);
          g.appendChild(gb);
          dom.appendChild(g);
        } else if (e.Тип === 'Страницы') {
          const p = document.createElement('div');
          p.className = 'pages1c' + (e === sel ? ' sel-el' : '');
          const pages = (e.Элементы || []).filter(x => x.Тип === 'Страница');
          let act = activePages.get(e) || 0;
          if (act >= pages.length) act = 0;
          const tabs = document.createElement('div');
          tabs.className = 'tabs';
          pages.forEach((pg, i) => {
            const tb = document.createElement('div');
            tb.className = 'tab' + (i === act ? ' on' : '');
            tb.textContent = pg.Заголовок || 'Страница';
            tb.onclick = ev => { ev.stopPropagation(); activePages.set(e, i); sel = pg; render(); };
            tabs.appendChild(tb);
          });
          p.appendChild(tabs);
          const page = document.createElement('div');
          page.className = 'page';
          if (pages[act]) renderInto(pages[act].Элементы, page);
          p.appendChild(page);
          p.onclick = ev => { ev.stopPropagation(); sel = e; render(); };
          dom.appendChild(p);
        } else if (e.Тип === 'Страница') {
          // страница вне «Страниц» — просто контейнер
          const g = document.createElement('div');
          g.className = 'grp1c' + (e === sel ? ' sel-el' : '');
          g.onclick = ev => { ev.stopPropagation(); sel = e; render(); };
          renderInto(e.Элементы, g);
          dom.appendChild(g);
        }
      }
    }

    // --- свойства ---
    const props = document.getElementById('props');
    props.innerHTML = '';
    if (!sel) {
      props.innerHTML = '<div class="empty">Выберите элемент формы</div>';
    } else {
      const e = sel;
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
      if (e.Тип === 'Группа')
        addProp('Группировка', '<select id="pGrp">' +
          ['Вертикальная', 'Горизонтальная'].map(v =>
            '<option' + ((e.Группировка || 'Вертикальная') === v ? ' selected' : '') + '>' + v + '</option>').join('') +
          '</select>');

      const pTitle = document.getElementById('pTitle');
      pTitle.addEventListener('input', () => { e.Заголовок = pTitle.value; scheduleSave(); renderSoft(); });
      const pRO = document.getElementById('pRO');
      if (pRO) pRO.addEventListener('change', () => { e.ТолькоПросмотр = pRO.checked; scheduleSave(); render(); });
      const pGrp = document.getElementById('pGrp');
      if (pGrp) pGrp.addEventListener('change', () => { e.Группировка = pGrp.value; scheduleSave(); render(); });
    }

    // --- выпадающий список добавления ---
    const used = new Set(), usedT = new Set();
    walk(els, e => {
      if (e.Тип === 'Поле') used.add(e.Реквизит);
      if (e.Тип === 'Таблица') usedT.add(e.ТабличнаяЧасть);
    });
    const addSel = document.getElementById('addSelect');
    const prev = addSel.value;
    addSel.innerHTML = '';
    const og0 = document.createElement('optgroup'); og0.label = 'Группировка';
    og0.appendChild(new Option('Группа', 'g:Группа'));
    og0.appendChild(new Option('Страницы (вкладки)', 'g:Страницы'));
    og0.appendChild(new Option('Страница', 'g:Страница'));
    addSel.appendChild(og0);
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
    if ([...addSel.options].some(o => o.value === prev)) addSel.value = prev;
  }

  // лёгкая перерисовка (не трогая фокус в свойствах) — обновить подписи
  function renderSoft() {
    const list = document.getElementById('list');
    const flat = [];
    walk(els, e => flat.push(e));
    [...list.children].forEach((div, i) => { if (flat[i]) div.children[1].textContent = elTitle(flat[i]); });
    renderPreviewOnly();
  }
  // обновить только тексты в превью (без перерисовки — не трогает фокус в панели свойств)
  function renderPreviewOnly() {
    const pv = document.getElementById('preview');
    const labels = pv.querySelectorAll('.fld label');
    const fields = [];
    walk(els, e => { if (e.Тип === 'Поле') fields.push(e); });
    // поля на неактивных вкладках не отрисованы — обновляем по совпадению количества
    const visible = [];
    collectVisible(els, visible);
    const vf = visible.filter(e => e.Тип === 'Поле');
    labels.forEach((lab, i) => { if (vf[i]) lab.textContent = elTitle(vf[i]) + ':'; });
    const btns = [];
    walk(els, e => { if (e.Тип === 'Кнопка') btns.push(e); });
    pv.querySelectorAll('.cmdbar .btn1c').forEach((b, i) => { if (btns[i]) b.textContent = elTitle(btns[i]); });
    const caps = pv.querySelectorAll('.tbl1c .cap');
    const vt = visible.filter(e => e.Тип === 'Таблица');
    caps.forEach((c, i) => { if (vt[i]) c.textContent = elTitle(vt[i]); });
    const gcaps = pv.querySelectorAll('.grp1c > .gcap');
    const vg = visible.filter(e => e.Тип === 'Группа' && e.Заголовок);
    gcaps.forEach((c, i) => { if (vg[i]) c.textContent = vg[i].Заголовок; });
    const tabs = pv.querySelectorAll('.pages1c .tab');
    const vp = [];
    walk(els, e => { if (e.Тип === 'Страницы') (e.Элементы || []).forEach(p => { if (p.Тип === 'Страница') vp.push(p); }); });
    tabs.forEach((t, i) => { if (vp[i]) t.textContent = vp[i].Заголовок || 'Страница'; });
  }
  function collectVisible(arr, out) {
    for (const e of arr || []) {
      if (e.Тип === 'Кнопка') continue;
      out.push(e);
      if (e.Тип === 'Страницы') {
        const pages = (e.Элементы || []).filter(x => x.Тип === 'Страница');
        let act = activePages.get(e) || 0;
        if (act >= pages.length) act = 0;
        if (pages[act]) collectVisible(pages[act].Элементы, out);
      } else if (e.Элементы) {
        collectVisible(e.Элементы, out);
      }
    }
  }

  document.getElementById('btnAdd').onclick = () => {
    const v = document.getElementById('addSelect').value;
    if (!v) return;
    const [k, name] = [v.slice(0, 1), v.slice(2)];
    let нов;
    if (k === 'f') {
      const d = fieldDef(name);
      нов = { Тип: 'Поле', Реквизит: name, Заголовок: d ? d.синоним : name, ТолькоПросмотр: false };
    } else if (k === 't') {
      const d = tabularDef(name);
      нов = { Тип: 'Таблица', ТабличнаяЧасть: name, Заголовок: d ? d.синоним : name };
    } else if (k === 'b') {
      нов = { Тип: 'Кнопка', Действие: name, Заголовок: name === 'ЗаписатьИЗакрыть' ? 'Записать и закрыть' : 'Отмена' };
    } else { // g: контейнеры
      if (name === 'Группа') нов = { Тип: 'Группа', Заголовок: '', Группировка: 'Вертикальная', Элементы: [] };
      else if (name === 'Страницы') нов = { Тип: 'Страницы', Элементы: [
        { Тип: 'Страница', Заголовок: 'Страница1', Элементы: [] } ] };
      else нов = { Тип: 'Страница', Заголовок: 'Страница', Элементы: [] };
    }
    const target = insertTarget(нов.Тип);
    if (!target) return; // например, Страница без выбранных Страниц
    if (target.at !== undefined) target.arr.splice(target.at, 0, нов);
    else target.arr.push(нов);
    sel = нов; scheduleSave(); render();
  };
  document.getElementById('btnDel').onclick = () => {
    if (!sel) return;
    const p = findParent(sel);
    if (!p) return;
    p.arr.splice(p.i, 1);
    sel = p.arr[Math.min(p.i, p.arr.length - 1)] || ownerOf(p.arr) || els[0] || null;
    scheduleSave(); render();
  };
  document.getElementById('btnUp').onclick = () => {
    if (!sel) return;
    const p = findParent(sel);
    if (!p || p.i === 0) return;
    [p.arr[p.i - 1], p.arr[p.i]] = [p.arr[p.i], p.arr[p.i - 1]];
    scheduleSave(); render();
  };
  document.getElementById('btnDown').onclick = () => {
    if (!sel) return;
    const p = findParent(sel);
    if (!p || p.i >= p.arr.length - 1) return;
    [p.arr[p.i + 1], p.arr[p.i]] = [p.arr[p.i], p.arr[p.i + 1]];
    scheduleSave(); render();
  };

  render();
</script>
</body></html>`;
}

module.exports = { html, defaultElements, standardFields };
