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

// Форма списка по умолчанию: командная панель списка + сам список
function defaultListElements(info) {
  return [
    { Тип: 'Кнопка', Действие: 'Создать', Заголовок: 'Создать' },
    { Тип: 'Кнопка', Действие: 'Изменить', Заголовок: 'Изменить' },
    { Тип: 'Кнопка', Действие: 'Удалить', Заголовок: 'Удалить' },
    { Тип: 'Кнопка', Действие: 'Обновить', Заголовок: 'Обновить' },
    { Тип: 'Список' }
  ];
}

function html(info, formName, elements, props) {
  const data = JSON.stringify({ info, formName, elements,
    props: props || { Заголовок: '', Ширина: 0, Высота: 0 } }).replace(/</g, '\\u003c');
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
  /* Макет как в редакторе форм 1С: сверху дерево элементов + реквизиты, снизу превью */
  .top { display: flex; height: 42%; min-height: 140px; flex: none; border-bottom: 2px solid var(--vscode-panel-border); }
  .col-list { flex: 1; min-width: 0; border-right: 1px solid var(--vscode-panel-border); overflow: auto; }
  .col-attrs { flex: 1; min-width: 0; overflow: auto; }
  .col-prev { flex: 1; overflow: auto; background: #d6d9dd; padding: 14px; }
  .bottomtabs { display: flex; gap: 2px; padding: 2px 8px 0; border-top: 1px solid var(--vscode-panel-border); flex: none; }
  .btab { padding: 3px 14px; cursor: pointer; border: 1px solid var(--vscode-panel-border); border-bottom: none;
          border-radius: 3px 3px 0 0; color: var(--vscode-descriptionForeground); }
  .btab.on { background: var(--vscode-editor-background); color: var(--vscode-foreground); font-weight: 600; }

  /* Панель реквизитов (как закладка «Реквизиты» в 1С) */
  .attr-head { display: flex; font-weight: 600; color: var(--vscode-descriptionForeground);
               border-bottom: 1px solid var(--vscode-panel-border); padding: 3px 8px; position: sticky; top: 26px;
               background: var(--vscode-editor-background); }
  .attr-row { display: flex; padding: 3px 8px; cursor: grab; border: 1px solid transparent; align-items: center; gap: 6px; }
  .attr-row:hover { background: var(--vscode-list-hoverBackground); }
  .attr-row.used { opacity: .45; }
  .attr-row .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .attr-row .tp { flex: 1; min-width: 0; color: var(--vscode-descriptionForeground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .attr-row .ico { width: 14px; flex: none; text-align: center; }
  .attr-row.child { padding-left: 34px; cursor: default; }
  .attr-row .tgl { width: 12px; flex: none; cursor: pointer; color: var(--vscode-descriptionForeground); }
  .atabs { display: flex; gap: 4px; align-items: center; }
  .atab { cursor: pointer; padding: 1px 10px; border: 1px solid var(--vscode-panel-border); border-radius: 3px;
          color: var(--vscode-descriptionForeground); font-weight: 400; }
  .atab.on { background: var(--vscode-editor-background); color: var(--vscode-foreground); font-weight: 600; }
  .drop-ok { outline: 2px dashed #ff8c00; outline-offset: -2px; }

  .hdr { padding: 5px 8px; font-weight: 600; background: var(--vscode-sideBarSectionHeader-background);
         border-bottom: 1px solid var(--vscode-panel-border); position: sticky; top: 0; }
  .el { padding: 4px 8px; cursor: pointer; display: flex; gap: 6px; align-items: center; border: 1px solid transparent; }
  .el:hover { background: var(--vscode-list-hoverBackground); }
  .el.sel { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
  .el .ico { width: 14px; text-align: center; flex: none; }
  .el.drag-over { border-top: 2px solid #ff8c00; }
  .el.dim { opacity: .5; }
  .ctx { position: fixed; z-index: 99; background: var(--vscode-menu-background, #fff);
         color: var(--vscode-menu-foreground, #222); border: 1px solid var(--vscode-panel-border);
         box-shadow: 0 4px 12px rgba(0,0,0,.3); min-width: 170px; }
  .ctx div { padding: 5px 14px; cursor: pointer; }
  .ctx div:hover { background: var(--vscode-list-hoverBackground, #eee); }
  .ctx hr { border: none; border-top: 1px solid var(--vscode-panel-border); margin: 3px 0; }
  .tbl1c th.sel-col { outline: 2px solid #ff8c00; outline-offset: -2px; }
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
  .fld input.num { text-align: right; }
  .fld input.date { flex: none; width: 110px; }
  .fld input.time { flex: none; width: 70px; margin-left: 4px; }
  .fld .pickbtn { flex: none; border: 1px solid #aab2ba; border-left: none; background: #eef0f2;
                  padding: 3px 7px; border-radius: 0 2px 2px 0; color: #555; pointer-events: none; }
  .fld input.withbtn { border-radius: 2px 0 0 2px; }
  .fld input[type=checkbox] { flex: none; width: 16px; height: 16px; pointer-events: none; }
  .fld.top-label { flex-direction: column; align-items: stretch; }
  .fld.top-label label { width: auto; margin-bottom: 2px; }
  .fld.invis, .tbl1c.invis, .grp1c.invis, .deco1c.invis, .btn1c.invis { opacity: .35; }
  .fld.dis input, .btn1c.dis { filter: grayscale(1); opacity: .7; }
  .tbl1c { margin: 8px 0; cursor: pointer; }
  .tbl1c .cap { font-weight: 600; color: #444; margin-bottom: 3px; }
  .tbl1c table { border-collapse: collapse; width: 100%; }
  .tbl1c th { background: #eef0f2; border: 1px solid #c5cad0; padding: 3px 6px; text-align: left; font-weight: 600; color: #444; }
  .tbl1c td { border: 1px solid #d8dce0; padding: 3px 6px; height: 14px; }
  .tbl1c th.icn, .tbl1c td.icn { width: 20px; min-width: 20px; padding: 1px 2px; text-align: center; }
  .tbl1c td.icn svg { vertical-align: middle; }

  /* Декорация */
  .deco1c { color: #666; margin: 6px 0 2px; cursor: pointer; }
  .deco1c.sel-el { outline: 2px solid #ff8c00; outline-offset: 1px; }

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
  .val.evt { display: flex; gap: 2px; }
  .val.evt input { flex: 1; min-width: 0; }
  .gobtn { background: var(--vscode-button-secondaryBackground, #ddd); color: var(--vscode-button-secondaryForeground, #222);
           border: 1px solid var(--vscode-panel-border); cursor: pointer; padding: 0 8px; flex: none; }
  .gobtn:hover { background: var(--vscode-button-secondaryHoverBackground, #ccc); }
  .sect { padding: 5px 8px; font-weight: 600; background: var(--vscode-sideBarSectionHeader-background);
          border-bottom: 1px solid var(--vscode-panel-border); margin-top: 8px; }
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
    <button id="btnAxaml" title="Создать произвольную AXAML-форму по этой разметке (src/BusinessLogic/Forms)">Экспорт в AXAML</button>
  </div>
  <div class="top">
    <div class="col-list"><div class="hdr">Элементы формы</div><div id="list"></div>
      <div class="hint">Перетащите элемент НА группу/страницу, чтобы вложить; МЕЖДУ — чтобы изменить порядок.</div></div>
    <div class="col-attrs"><div class="hdr atabs"><span class="atab on" id="atabAttrs">Реквизиты</span><span class="atab" id="atabCmds">Команды</span></div>
      <div class="attr-head"><span class="tgl"></span><span class="ico"></span><span class="nm" id="attrHeadNm">Реквизит</span><span class="tp" id="attrHeadTp">Тип</span></div>
      <div id="attrs"></div>
      <div class="hint" id="attrHint">Перетащите реквизит или табличную часть на форму либо в дерево элементов.</div></div>
  </div>
  <div class="col-prev"><div class="form1c" id="preview"></div></div>
  <div class="bottomtabs"><div class="btab on">Форма</div><div class="btab" id="tabModule" title="Открыть модуль объекта (C#)">Модуль</div></div>
<script>
  const vscode = acquireVsCodeApi();
  const data = ${data};
  const info = data.info;
  const props = data.props;         // свойства самой формы (Заголовок/Ширина/Высота)
  let els = data.elements;          // корневой массив (дерево: контейнеры имеют .Элементы)
  const FORM_NODE = { __форма: true };     // спец-узлы дерева (как в 1С)
  const CMDBAR_NODE = { __кп: true };
  let sel = els.length ? els[0] : null;  // выбранный ЭЛЕМЕНТ (ссылка/спец-узел/колонка)
  let dragged = null;
  let attrDrag = null;              // перетаскиваемый реквизит/ТЧ/команда из панели
  let attrTab = 'attrs';            // активная вкладка панели: 'attrs' | 'cmds'
  let treeRows = [];                // строки дерева для «мягкого» обновления подписей
  let saveTimer = null;
  const expandedT = new Set();      // раскрытые ТЧ в панели реквизитов
  const activePages = new Map();    // элемент «Страницы» -> активная вкладка (индекс)

  const ICONS = { 'Поле': '▭', 'Таблица': '▦', 'Кнопка': '🔘', 'Группа': '▣', 'Страницы': '🗂', 'Страница': '📄', 'Декорация': '𝐓', 'Список': '☰' };
  // Форма списка (как в 1С): вместо полей — колонки списка и команды списка
  const listMode = String(data.formName).includes('Списка');
  const STD_LIST_ACTIONS = ['Создать', 'Изменить', 'Удалить', 'Обновить'];
  const STD_ACTIONS = ['ЗаписатьИЗакрыть', 'Отмена'];
  const CMD_TITLES = { 'ЗаписатьИЗакрыть': 'Записать и закрыть', 'Отмена': 'Отмена',
                       'Создать': 'Создать', 'Изменить': 'Изменить', 'Удалить': 'Удалить', 'Обновить': 'Обновить' };
  const CONTAINERS = ['Группа', 'Страницы', 'Страница'];
  // события по типам элементов (обработчик — публичный метод модуля объекта на C#)
  const EVENTS = { 'Поле': ['ПриИзменении', 'ПриВходе', 'ПриВыходе'], 'Таблица': ['ПриИзменении'] };

  // Выделенный элемент показывается в палитре свойств (правая панель VS Code)
  function postSelection() {
    let клон = null;
    if (sel === FORM_NODE) {
      клон = { Тип: 'Форма', Заголовок: props.Заголовок || '', Ширина: props.Ширина || 0, Высота: props.Высота || 0 };
      vscode.postMessage({ type: 'elementSelected', element: клон });
      return;
    }
    if (sel === CMDBAR_NODE) {
      vscode.postMessage({ type: 'elementSelected', element: { Тип: 'КоманднаяПанель' } });
      return;
    }
    if (sel && sel.__кол) {
      const к = sel.колонка;
      клон = { Тип: 'Колонка', Имя: к.Реквизит, Реквизит: к.Реквизит, Заголовок: к.Заголовок || '',
               Видимость: к.Видимость !== false, ТолькоПросмотр: !!к.ТолькоПросмотр, Ширина: к.Ширина || 0,
               ПутьКДанным: sel.таблица.Тип === 'Список'
                 ? 'Список.' + к.Реквизит
                 : 'Объект.' + sel.таблица.ТабличнаяЧасть + '.' + к.Реквизит,
               ТипЗначения: colType(sel.таблица, к) };
      vscode.postMessage({ type: 'elementSelected', element: клон });
      return;
    }
    if (sel) {
      клон = JSON.parse(JSON.stringify(sel));
      // служебные поля для палитры свойств (как в 1С): ПутьКДанным, Вид, Тип значения
      if (sel.Тип === 'Поле') {
        клон.ПутьКДанным = 'Объект.' + (sel.Реквизит || '');
        const d = fieldDef(sel.Реквизит);
        const т = (d && d.тип) || 'Строка';
        клон.ТипЗначения = т;
        клон.Вид = т === 'Булево' ? 'Поле флажка' : т === 'Дата' ? 'Поле календаря'
                 : т.includes('Ссылка') ? 'Поле выбора' : 'Поле ввода';
      }
      if (sel.Тип === 'Таблица') клон.ПутьКДанным = 'Объект.' + (sel.ТабличнаяЧасть || '');
    }
    vscode.postMessage({ type: 'elementSelected', element: клон });
  }

  // Правки из палитры свойств
  window.addEventListener('message', ev => {
    const m = ev.data || {};
    if (m.type === 'requestSelection') { postSelection(); return; }
    if (m.type !== 'propEdit' || !sel) return;
    if (sel === FORM_NODE) {        // свойства самой формы
      if (['Заголовок', 'Ширина', 'Высота'].includes(m.field)) {
        props[m.field] = m.value;
        scheduleSave();
        if (m.field === 'Заголовок') renderSoft();
      }
      return;
    }
    if (sel.__кол) {                // свойства колонки таблицы
      if (['Заголовок', 'Видимость', 'ТолькоПросмотр', 'Ширина'].includes(m.field)) {
        sel.колонка[m.field] = m.value;
        scheduleSave(); render();
      }
      return;
    }
    if (m.field === 'Событие') {
      sel.События = sel.События || {};
      if (m.value) sel.События[m.event] = m.value; else delete sel.События[m.event];
      scheduleSave();
      return;
    }
    if (m.field === 'Заголовок') { sel.Заголовок = m.value; scheduleSave(); renderSoft(); return; }
    if (m.field === 'ТолькоПросмотр') { sel.ТолькоПросмотр = m.value; scheduleSave(); render(); return; }
    if (m.field === 'Группировка') { sel.Группировка = m.value; scheduleSave(); render(); return; }
    if (m.field === 'Действие') { sel.Действие = m.value; scheduleSave(); render(); return; }
    if (m.field === 'Имя') { sel.Имя = m.value; scheduleSave(); return; }
    if (['Видимость', 'Доступность', 'ПоложениеЗаголовка', 'МногострочныйРежим', 'РежимПароля', 'КнопкаПоУмолчанию'].includes(m.field)) {
      sel[m.field] = m.value; scheduleSave(); render(); return;
    }
  });
  const isCont = e => CONTAINERS.includes(e.Тип);
  const kids = e => (e.Элементы || (e.Элементы = []));

  function fieldDef(name) {
    return info.стандартные.find(f => f.имя === name) || info.реквизиты.find(f => f.имя === name);
  }
  function tabularDef(name) { return info.таблицы.find(t => t.имя === name); }
  // реквизиты, доступные колонкам СПИСКА (как схема списка в клиенте)
  function listAttrs() {
    return info.стандартные.concat(info.реквизиты);   // состояние (проведён/пометка) показывает пиктограмма, не колонка
  }
  // колонки таблицы/списка: настроенные (e.Колонки) или все по умолчанию
  function colAttrsOf(e) {
    if (e.Тип === 'Список') return listAttrs();
    const t = tabularDef(e.ТабличнаяЧасть);
    return t ? t.реквизиты : [];
  }
  function colsOf(e) {
    if (e.Колонки && e.Колонки.length) return e.Колонки;
    return colAttrsOf(e).map(р => ({ Реквизит: р.имя, Заголовок: '', Видимость: true, ТолькоПросмотр: false, Ширина: 0 }));
  }
  function ensureCols(e) { if (!e.Колонки || !e.Колонки.length) e.Колонки = colsOf(e); return e.Колонки; }
  function colType(e, к) {
    const р = colAttrsOf(e).find(x => x.имя === к.Реквизит);
    return (р && р.тип) || 'Строка';
  }
  function colTitle(e, к) {
    if (к.Заголовок) return к.Заголовок;
    const р = colAttrsOf(e).find(x => x.имя === к.Реквизит);
    return (р && р.синоним) || к.Реквизит;
  }
  // Образец данных в превью: сразу видно оформление таблиц; значения детерминированные
  const СЛОВА = ['Ромашка', 'Василёк', 'Восход', 'Алмаз', 'Мечта', 'Звезда'];
  const ЧИСЛА = ['12', '7', '125,40', '3', '48,90', '210,00'];
  const ДАТЫ = ['05.03.2026', '17.06.2026', '09.11.2026', '21.01.2026'];
  function образецТд(тип, имя, кол, строка) {
    const х = кол * 7 + строка * 3;
    if (имя === 'Номер' || имя === 'Код') return '<td>00000000' + (строка + 1) + '</td>';
    if (тип === 'Число') return '<td style="text-align:right">' + ЧИСЛА[х % ЧИСЛА.length] + '</td>';
    if (тип === 'Булево') return '<td style="text-align:center">' + (строка % 2 ? '' : '✓') + '</td>';
    if (тип === 'Дата') return '<td>' + ДАТЫ[х % ДАТЫ.length] + '</td>';
    return '<td>' + СЛОВА[х % СЛОВА.length] + '</td>';
  }

  function findList() { let f = null; walk(els, e => { if (e.Тип === 'Список') f = e; }); return f; }
  function elTitle(e) {
    if (e.Тип === 'Поле') return e.Заголовок || e.Реквизит;
    if (e.Тип === 'Таблица') return e.Заголовок || e.ТабличнаяЧасть;
    if (e.Тип === 'Кнопка') return e.Заголовок || e.Действие;
    if (e.Тип === 'Декорация') return e.Заголовок || 'Надпись';
    if (e.Тип === 'Список') return 'Список';
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

  // перемещение существующего элемента (из дерева или из превью);
  // e — целевой элемент, mode: 'before' (перед ним) | 'into' (внутрь контейнера)
  function moveElement(e, mode) {
    if (!dragged || dragged === e || isAncestor(dragged, e)) return;
    const from = findParent(dragged);
    if (!from) return;
    if (mode === 'into') {
      if (dragged.Тип === 'Страница' && e.Тип !== 'Страницы') return;
      if (e.Тип === 'Страницы' && dragged.Тип !== 'Страница') return;
      from.arr.splice(from.i, 1);
      kids(e).push(dragged);
    } else {
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
  }

  // есть ли уже элемент под этот реквизит/ТЧ (как в 1С — поле на форме одно)
  function existingFor(a) {
    let found = null;
    walk(els, e => {
      if (a.kind === 'field' && e.Тип === 'Поле' && e.Реквизит === a.name) found = e;
      if (a.kind === 'table' && e.Тип === 'Таблица' && e.ТабличнаяЧасть === a.name) found = e;
      if (a.kind === 'cmd' && e.Тип === 'Кнопка' && e.Действие === a.name) found = e;
    });
    return found;
  }

  function makeFromAttr(a) {
    if (a.kind === 'cmd')
      return { Тип: 'Кнопка', Действие: a.name, Заголовок: CMD_TITLES[a.name] || a.name };
    if (a.kind === 'table') {
      const t = tabularDef(a.name);
      return { Тип: 'Таблица', ТабличнаяЧасть: a.name, Заголовок: (t && t.синоним) || a.name };
    }
    const f = fieldDef(a.name);
    return { Тип: 'Поле', Реквизит: a.name, Заголовок: (f && f.синоним) || a.name, ТолькоПросмотр: false };
  }

  // Бросок реквизита: target = {arr, at} | {into: контейнер}
  function dropAttr(a, target) {
    if (listMode && a.kind === 'field') {        // форма списка: реквизит -> колонка списка
      const сп = findList();
      if (!сп) { attrDrag = null; return; }
      const кол = ensureCols(сп);
      let к = кол.find(x => x.Реквизит === a.name);
      if (!к) { к = { Реквизит: a.name, Заголовок: '', Видимость: true, ТолькоПросмотр: false, Ширина: 0 }; кол.push(к); scheduleSave(); }
      else if (к.Видимость === false) { к.Видимость = true; scheduleSave(); }
      sel = { __кол: true, таблица: сп, колонка: к };
      attrDrag = null; render(); return;
    }
    if (listMode && a.kind === 'table') { attrDrag = null; return; }   // ТЧ в списке не размещают
    const существующий = existingFor(a);
    if (существующий) { sel = существующий; attrDrag = null; render(); return; }  // дубль не создаём — выделяем
    const нов = makeFromAttr(a);
    if (target.into) kids(target.into).push(нов);
    else target.arr.splice(target.at !== undefined ? target.at : target.arr.length, 0, нов);
    sel = нов; attrDrag = null; scheduleSave(); render();
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => vscode.postMessage({ type: 'save', elements: els, props }), 250);
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

  // --- контекстное меню дерева элементов (как в 1С: Добавить/Удалить/Свойства) ---
  function ctxMenu(ev, пункты) {
    ev.preventDefault(); ev.stopPropagation();
    closeCtx();
    const m = document.createElement('div');
    m.className = 'ctx'; m.id = 'ctx';
    for (const п of пункты) {
      if (п === '-') { m.appendChild(document.createElement('hr')); continue; }
      const d = document.createElement('div');
      d.textContent = п[0];
      d.onclick = e2 => { e2.stopPropagation(); closeCtx(); п[1](); };
      m.appendChild(d);
    }
    m.style.left = ev.pageX + 'px'; m.style.top = ev.pageY + 'px';
    document.body.appendChild(m);
  }
  function closeCtx() { const m = document.getElementById('ctx'); if (m) m.remove(); }
  document.addEventListener('click', closeCtx);

  function ctxMenuElement(ev, e) {
    sel = e; render();
    ctxMenu(ev, [
      ['Добавить группу', () => addNew('g:Группа')],
      ['Добавить страницы', () => addNew('g:Страницы')],
      ['Добавить надпись', () => addNew('d:Надпись')],
      '-',
      ['Переместить вверх', () => moveSel(-1)],
      ['Переместить вниз', () => moveSel(1)],
      '-',
      ['Удалить', delSel],
      '-',
      ['Свойства', () => { postSelection(); vscode.postMessage({ type: 'focusProps' }); }]
    ]);
  }
  function ctxMenuColumn(ev, таблица, i) {
    const кол = ensureCols(таблица)[i];
    sel = { __кол: true, таблица, колонка: кол }; render();
    ctxMenu(ev, [
      ['Переместить вверх', () => moveSel(-1)],
      ['Переместить вниз', () => moveSel(1)],
      '-',
      [кол.Видимость === false ? 'Показать колонку' : 'Скрыть колонку',
        () => { кол.Видимость = кол.Видимость === false; scheduleSave(); render(); }],
      ['Удалить', delSel],
      '-',
      ['Свойства', () => { postSelection(); vscode.postMessage({ type: 'focusProps' }); }]
    ]);
  }

  // перемещение/удаление выбранного (элемент или колонка таблицы)
  function moveSel(dir) {
    if (!sel) return;
    if (sel.__кол) {
      const arr = ensureCols(sel.таблица);
      const i = arr.indexOf(sel.колонка), j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      scheduleSave(); render(); return;
    }
    const p = findParent(sel);
    if (!p) return;
    const j = p.i + dir;
    if (j < 0 || j >= p.arr.length) return;
    [p.arr[p.i], p.arr[j]] = [p.arr[j], p.arr[p.i]];
    scheduleSave(); render();
  }
  function delSel() {
    if (!sel) return;
    if (sel.__кол) {
      const arr = ensureCols(sel.таблица);
      const i = arr.indexOf(sel.колонка);
      if (i >= 0) arr.splice(i, 1);
      sel = sel.таблица;
      scheduleSave(); render(); return;
    }
    const p = findParent(sel);
    if (!p) return;
    p.arr.splice(p.i, 1);
    sel = p.arr[Math.min(p.i, p.arr.length - 1)] || ownerOf(p.arr) || els[0] || null;
    scheduleSave(); render();
  }

  function render() {
    // --- дерево элементов (как в 1С: Форма -> Командная панель -> элементы) ---
    const list = document.getElementById('list');
    list.innerHTML = '';
    const rowByEl = new Map();
    treeRows = [];
    const mkRow = (depth, ico, label, выбран) => {
      const div = document.createElement('div');
      div.className = 'el' + (выбран ? ' sel' : '');
      div.style.paddingLeft = (8 + depth * 16) + 'px';
      div.innerHTML = '<span class="ico">' + ico + '</span><span>' + label + '</span>';
      list.appendChild(div);
      return div;
    };

    // корень «Форма»
    const formDiv = mkRow(0, '📃', 'Форма', sel === FORM_NODE);
    formDiv.onclick = () => { sel = FORM_NODE; render(); };
    formDiv.oncontextmenu = ev => ctxMenu(ev, [['Свойства', () => { sel = FORM_NODE; render(); vscode.postMessage({ type: 'focusProps' }); }]]);
    treeRows.push({ div: formDiv, label: () => 'Форма' });

    // «Командная панель»: все кнопки формы (как в 1С)
    const кнопкиДерева = [];
    walk(els, e => { if (e.Тип === 'Кнопка') кнопкиДерева.push(e); });
    const кпDiv = mkRow(1, '🔔', 'Командная панель', sel === CMDBAR_NODE);
    кпDiv.onclick = () => { sel = CMDBAR_NODE; render(); };
    treeRows.push({ div: кпDiv, label: () => 'Командная панель' });
    for (const e of кнопкиДерева) {
      const div = mkRow(2, ICONS['Кнопка'], elTitle(e), e === sel);
      div.draggable = true;
      div.onclick = () => { sel = e; render(); };
      div.ondragstart = ev => { dragged = e; attrDrag = null; ev.dataTransfer.setData('text/plain', 'x'); };
      div.ondragover = ev => { if (dragged && dragged.Тип === 'Кнопка' && dragged !== e || attrDrag && attrDrag.kind === 'cmd') { ev.preventDefault(); div.classList.add('drag-over'); } };
      div.ondragleave = () => div.classList.remove('drag-over');
      div.ondrop = ev => {
        ev.preventDefault(); ev.stopPropagation();
        div.classList.remove('drag-over');
        if (attrDrag) { const p = findParent(e); if (p) dropAttr(attrDrag, { arr: p.arr, at: p.i }); return; }
        moveElement(e, 'before');
      };
      div.oncontextmenu = ev => ctxMenuElement(ev, e);
      treeRows.push({ div, label: () => elTitle(e) });
      rowByEl.set(e, div);
    }

    // элементы формы (кнопки показаны выше, в командной панели)
    walk(els, (e, depth) => {
      if (e.Тип === 'Кнопка') return;
      const div = mkRow(depth + 1, ICONS[e.Тип] || '•', elTitle(e), e === sel);
      div.draggable = true;
      div.onclick = () => { sel = e; render(); };
      div.ondragstart = ev => { dragged = e; attrDrag = null; ev.dataTransfer.setData('text/plain', 'x'); };
      div.ondragover = ev => {
        ev.preventDefault();
        div.classList.add(isCont(e) && dragged !== e ? 'drag-into' : 'drag-over');
      };
      div.ondragleave = () => div.classList.remove('drag-over', 'drag-into');
      div.ondrop = ev => {
        ev.preventDefault();
        div.classList.remove('drag-over', 'drag-into');
        if (attrDrag) {   // реквизит из панели: на контейнер — внутрь, иначе перед элементом
          if (isCont(e)) dropAttr(attrDrag, { into: e });
          else { const p = findParent(e); if (p) dropAttr(attrDrag, { arr: p.arr, at: p.i }); }
          return;
        }
        moveElement(e, isCont(e) ? 'into' : 'before');
      };
      div.oncontextmenu = ev => ctxMenuElement(ev, e);
      treeRows.push({ div, label: () => elTitle(e) });
      rowByEl.set(e, div);

      // колонки таблицы/списка — дочерние узлы (как ПолеКолонки в 1С)
      if (e.Тип === 'Таблица' || e.Тип === 'Список') {
        colsOf(e).forEach((к, i) => {
          const кDiv = mkRow(depth + 2, '▥', colTitle(e, к), !!(sel && sel.__кол && sel.колонка === к));
          if (к.Видимость === false) кDiv.classList.add('dim');
          кDiv.onclick = ev => { ev.stopPropagation(); const кол = ensureCols(e)[i]; sel = { __кол: true, таблица: e, колонка: кол }; render(); };
          кDiv.oncontextmenu = ev => ctxMenuColumn(ev, e, i);
          treeRows.push({ div: кDiv, label: () => colTitle(e, к) });
        });
      }
    });
    list.ondragover = ev => { if (attrDrag) { ev.preventDefault(); list.classList.add('drop-ok'); } };
    list.ondragleave = () => list.classList.remove('drop-ok');
    list.ondrop = ev => {
      list.classList.remove('drop-ok');
      if (!attrDrag || ev.defaultPrevented) return;
      ev.preventDefault();
      dropAttr(attrDrag, { arr: els });
    };

    // --- превью ---
    const pv = document.getElementById('preview');
    pv.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = (props.Заголовок || info.синоним) + ' (' + data.formName + ')';
    pv.appendChild(title);

    // кнопки (с любого уровня) — в командную панель
    const buttons = [];
    walk(els, e => { if (e.Тип === 'Кнопка') buttons.push(e); });
    if (buttons.length) {
      const bar = document.createElement('div');
      bar.className = 'cmdbar';
      for (const e of buttons) {
        const b = document.createElement('button');
        b.className = 'btn1c' + ((e.Действие === 'ЗаписатьИЗакрыть' || e.КнопкаПоУмолчанию) ? ' primary' : '') + (e === sel ? ' sel-el' : '')
          + (e.Видимость === false ? ' invis' : '') + (e.Доступность === false ? ' dis' : '');
        b.textContent = elTitle(e);
        b.onclick = () => { sel = e; render(); };
        dragSource(b, e);
        acceptAttrBefore(b, e);
        bar.appendChild(b);
      }
      pv.appendChild(bar);
    }

    const body = document.createElement('div');
    body.className = 'body';
    renderInto(els, body);
    pv.appendChild(body);
    pv.ondragover = ev => { if (attrDrag || dragged) { ev.preventDefault(); pv.classList.add('drop-ok'); } };
    pv.ondragleave = () => pv.classList.remove('drop-ok');
    pv.ondrop = ev => {
      pv.classList.remove('drop-ok');
      if (ev.defaultPrevented) return;
      if (attrDrag) { ev.preventDefault(); dropAttr(attrDrag, { arr: els }); return; }
      if (dragged && dragged.Тип !== 'Страница') {   // элемент — в конец формы
        ev.preventDefault();
        const from = findParent(dragged);
        if (!from) return;
        from.arr.splice(from.i, 1);
        els.push(dragged);
        sel = dragged; dragged = null; scheduleSave(); render();
      }
    };

    // приём на элемент превью: реквизит/команду — вставить перед ним,
    // перетаскиваемый элемент формы — переставить перед ним
    function acceptAttrBefore(dom, e) {
      const можно = () => attrDrag || (dragged && dragged !== e && !isAncestor(dragged, e));
      dom.addEventListener('dragover', ev => {
        if (!можно()) return;
        ev.preventDefault(); ev.stopPropagation();
        dom.classList.add('drag-over');
      });
      dom.addEventListener('dragleave', () => dom.classList.remove('drag-over'));
      dom.addEventListener('drop', ev => {
        dom.classList.remove('drag-over');
        if (!можно()) return;
        ev.preventDefault(); ev.stopPropagation();
        if (attrDrag) {
          const p = findParent(e);
          if (p) dropAttr(attrDrag, { arr: p.arr, at: p.i });
        } else moveElement(e, 'before');
      });
    }
    // приём контейнером превью (группа/страница): внутрь
    function acceptAttrInto(dom, e) {
      const можно = () => attrDrag || (dragged && dragged !== e && !isAncestor(dragged, e));
      dom.addEventListener('dragover', ev => {
        if (!можно()) return;
        ev.preventDefault(); ev.stopPropagation();
        dom.classList.add('drop-ok');
      });
      dom.addEventListener('dragleave', () => dom.classList.remove('drop-ok'));
      dom.addEventListener('drop', ev => {
        dom.classList.remove('drop-ok');
        if (!можно()) return;
        ev.preventDefault(); ev.stopPropagation();
        if (attrDrag) dropAttr(attrDrag, { into: e });
        else moveElement(e, 'into');
      });
    }
    // перетаскивание самого элемента из превью (перестановка, как в 1С)
    function dragSource(dom, e) {
      dom.draggable = true;
      dom.addEventListener('dragstart', ev => {
        ev.stopPropagation();
        dragged = e; attrDrag = null;
        ev.dataTransfer.setData('text/plain', 'x');
      });
      dom.addEventListener('dragend', () => { dragged = null; });
    }

    function renderInto(arr, dom) {
      for (const e of arr || []) {
        if (e.Тип === 'Кнопка') continue;
        if (e.Тип === 'Поле') {
          const row = document.createElement('div');
          row.className = 'fld' + (e === sel ? ' sel-el' : '')
            + (e.Видимость === false ? ' invis' : '') + (e.Доступность === false ? ' dis' : '')
            + (e.ПоложениеЗаголовка === 'Верх' ? ' top-label' : '');
          if (e.ПоложениеЗаголовка !== 'Нет') {
            const lab = document.createElement('label');
            lab.textContent = elTitle(e) + ':';
            row.appendChild(lab);
          }
          // как в 1С: вид поля определяется типом данных реквизита
          const def = fieldDef(e.Реквизит);
          const тип = (def && def.тип) || 'Строка';
          const ro = e.ТолькоПросмотр ? ' ro' : '';
          if (тип === 'Булево') {
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            row.appendChild(cb);
          } else if (тип === 'Дата') {
            const d = document.createElement('input');
            d.className = 'date withbtn' + ro;
            const b = document.createElement('span'); b.className = 'pickbtn'; b.textContent = '📅';
            const t = document.createElement('input');
            t.className = 'time' + ro; t.placeholder = '00:00:00';
            row.appendChild(d); row.appendChild(b); row.appendChild(t);
          } else if (тип === 'Число') {
            const n = document.createElement('input');
            n.className = 'num' + ro; n.value = '0';
            row.appendChild(n);
          } else if (тип.includes('Ссылка')) {
            const inp = document.createElement('input');
            inp.className = 'withbtn' + ro; inp.value = '<выбор из списка>';
            const b = document.createElement('span'); b.className = 'pickbtn'; b.textContent = '▾';
            row.appendChild(inp); row.appendChild(b);
          } else {
            const inp = document.createElement('input');
            if (ro) inp.className = 'ro';
            if (e.РежимПароля) inp.value = '●●●●●';
            if (e.МногострочныйРежим) inp.style.height = '48px';
            row.appendChild(inp);
          }
          row.onclick = ev => { ev.stopPropagation(); sel = e; render(); };
          dragSource(row, e);
          acceptAttrBefore(row, e);
          dom.appendChild(row);
        } else if (e.Тип === 'Таблица') {
          const wrap = document.createElement('div');
          wrap.className = 'tbl1c' + (e === sel ? ' sel-el' : '')
            + (e.Видимость === false ? ' invis' : '');
          const колонки = colsOf(e);
          const видимыеКол = [];
          колонки.forEach((к, i) => { if (к.Видимость !== false) видимыеКол.push(i); });
          let ths = '<th>N</th>';
          for (const i of видимыеКол) {
            const к = колонки[i];
            const selCol = sel && sel.__кол && sel.колонка === к;
            ths += '<th data-col="' + i + '"' + (selCol ? ' class="sel-col"' : '')
                + (к.Ширина > 0 ? ' style="width:' + к.Ширина + 'px"' : '') + '>'
                + colTitle(e, к) + '</th>';
          }
          let rows = '';
          for (let r = 0; r < 2; r++) {
            rows += '<tr><td style="text-align:right;color:#888">' + (r + 1) + '</td>';
            видимыеКол.forEach((i, n) => { rows += образецТд(colType(e, колонки[i]), колонки[i].Реквизит, n, r); });
            rows += '</tr>';
          }
          wrap.innerHTML = '<div class="cap">' + elTitle(e) + '</div><table><tr>' + ths + '</tr>' + rows + '</table>';
          wrap.onclick = ev => { ev.stopPropagation(); sel = e; render(); };
          for (const th of wrap.querySelectorAll('th[data-col]'))
            th.onclick = ev => {       // клик по заголовку — выделить колонку (как в 1С)
              ev.stopPropagation();
              const кол = ensureCols(e)[+th.dataset.col];
              sel = { __кол: true, таблица: e, колонка: кол };
              render();
            };
          dragSource(wrap, e);
          acceptAttrBefore(wrap, e);
          dom.appendChild(wrap);
        } else if (e.Тип === 'Декорация') {
          const d = document.createElement('div');
          d.className = 'deco1c' + (e === sel ? ' sel-el' : '')
            + (e.Видимость === false ? ' invis' : '');
          d.textContent = e.Заголовок || 'Надпись';
          d.onclick = ev => { ev.stopPropagation(); sel = e; render(); };
          dragSource(d, e);
          acceptAttrBefore(d, e);
          dom.appendChild(d);
        } else if (e.Тип === 'Список') {
          const wrap = document.createElement('div');
          wrap.className = 'tbl1c' + (e === sel ? ' sel-el' : '');
          const колонки = colsOf(e);
          const видимыеКол = [];
          колонки.forEach((к, i) => { if (к.Видимость !== false) видимыеКол.push(i); });
          let ths = '';
          for (const i of видимыеКол) {
            const к = колонки[i];
            const selCol = sel && sel.__кол && sel.колонка === к;
            ths += '<th data-col="' + i + '"' + (selCol ? ' class="sel-col"' : '')
                + (к.Ширина > 0 ? ' style="width:' + к.Ширина + 'px"' : '') + '>'
                + colTitle(e, к) + '</th>';
          }
          // пиктограмма состояния (как в 1С): иконка объекта из дерева + галочка (проведён) / крестик (пометка удаления)
          const док = info.вид === 'Документ';
          const иконка = s => '<svg width="14" height="14" viewBox="0 0 16 16">' + (док
            ? "<path d='M3.5 1.5 L10.5 1.5 L13 4 L13 14.5 L3.5 14.5 Z' fill='#fff' stroke='#2e6da4' stroke-width='0.9'/><path d='M10.5 1.5 L10.5 4 L13 4 Z' fill='#dceefb' stroke='#2e6da4' stroke-width='0.9'/><rect x='5' y='6' width='6' height='1.1' fill='#5b9bd5'/><rect x='5' y='8.4' width='6' height='1.1' fill='#5b9bd5'/><rect x='5' y='10.8' width='4' height='1.1' fill='#5b9bd5'/>"
            : "<rect x='2.5' y='2' width='11' height='12' rx='1' fill='#fff' stroke='#b8860b' stroke-width='0.9'/><rect x='2.5' y='2' width='11' height='3' fill='#f6c445' stroke='#b8860b' stroke-width='0.9'/><rect x='4.5' y='6.6' width='7' height='1.1' fill='#5b9bd5'/><rect x='4.5' y='9' width='7' height='1.1' fill='#5b9bd5'/>")
            + (s === 'п' ? "<path d='M6 10 L9 13 L14 7' fill='none' stroke='#1e9e3e' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/>" : '')
            + (s === 'у' ? "<path d='M3 3 L13 13 M13 3 L3 13' fill='none' stroke='#d64540' stroke-width='1.8' stroke-linecap='round'/>" : '')
            + '</svg>';
          const статусы = док ? ['п', '', 'у', 'п'] : ['', '', 'у', ''];
          let rows = '';
          for (let r = 0; r < 4; r++) {
            rows += '<tr><td class="icn">' + иконка(статусы[r]) + '</td>';
            видимыеКол.forEach((i, n) => { rows += образецТд(colType(e, колонки[i]), колонки[i].Реквизит, n, r); });
            rows += '</tr>';
          }
          wrap.innerHTML = '<div class="cap">🔍 <input placeholder="Поиск (Ctrl+F)" style="border:1px solid #aab2ba;padding:2px 6px;pointer-events:none"></div>'
            + '<table><tr><th class="icn" title="Состояние: зелёная галочка — проведён, красный крестик — помечен на удаление"></th>' + ths + '</tr>' + rows + '</table>';
          wrap.onclick = ev => { ev.stopPropagation(); sel = e; render(); };
          for (const th of wrap.querySelectorAll('th[data-col]'))
            th.onclick = ev => {
              ev.stopPropagation();
              const кол = ensureCols(e)[+th.dataset.col];
              sel = { __кол: true, таблица: e, колонка: кол };
              render();
            };
          dom.appendChild(wrap);
        } else if (e.Тип === 'Группа') {
          const g = document.createElement('div');
          g.className = 'grp1c' + (e === sel ? ' sel-el' : '')
            + (e.Видимость === false ? ' invis' : '');
          g.onclick = ev => { ev.stopPropagation(); sel = e; render(); };
          dragSource(g, e);
          if (e.Заголовок) {
            const cap = document.createElement('div');
            cap.className = 'gcap'; cap.textContent = e.Заголовок;
            g.appendChild(cap);
          }
          const gb = document.createElement('div');
          gb.className = 'gbody' + (e.Группировка === 'Горизонтальная' ? ' h' : '');
          renderInto(e.Элементы, gb);
          g.appendChild(gb);
          acceptAttrInto(g, e);
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
          if (pages[act]) { renderInto(pages[act].Элементы, page); acceptAttrInto(page, pages[act]); }
          p.appendChild(page);
          p.onclick = ev => { ev.stopPropagation(); sel = e; render(); };
          dragSource(p, e);
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

    // --- свойства: показываются в палитре (правая панель VS Code) ---
    postSelection();

    // --- выпадающий список добавления ---
    const used = new Set(), usedT = new Set(), usedC = new Set();
    walk(els, e => {
      if (e.Тип === 'Поле') used.add(e.Реквизит);
      if (e.Тип === 'Таблица') usedT.add(e.ТабличнаяЧасть);
      if (e.Тип === 'Кнопка') usedC.add(e.Действие);
    });
    if (listMode) {
      const сп = findList();
      if (сп) for (const к of colsOf(сп)) if (к.Видимость !== false) used.add(к.Реквизит);
    }
    const addSel = document.getElementById('addSelect');
    const prev = addSel.value;
    addSel.innerHTML = '';
    if (listMode) {
      const ogК = document.createElement('optgroup'); ogК.label = 'Колонки';
      for (const f of listAttrs())
        if (!used.has(f.имя)) ogК.appendChild(new Option(f.синоним || f.имя, 'f:' + f.имя));
      const ogБ = document.createElement('optgroup'); ogБ.label = 'Кнопки';
      for (const д of STD_LIST_ACTIONS)
        if (!usedC.has(д)) ogБ.appendChild(new Option(CMD_TITLES[д] || д, 'b:' + д));
      if (ogК.children.length) addSel.appendChild(ogК);
      if (ogБ.children.length) addSel.appendChild(ogБ);
      if ([...addSel.options].some(o => o.value === prev)) addSel.value = prev;
    } else {
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
    og3.appendChild(new Option('Команда модуля (C#)', 'b:КомандаМодуля'));
    const og4 = document.createElement('optgroup'); og4.label = 'Декорации';
    og4.appendChild(new Option('Надпись', 'd:Надпись'));
    if (og1.children.length) addSel.appendChild(og1);
    if (og2.children.length) addSel.appendChild(og2);
    addSel.appendChild(og3);
    addSel.appendChild(og4);
    if ([...addSel.options].some(o => o.value === prev)) addSel.value = prev;
    }

    // --- панель «Реквизиты» (как закладка Реквизиты в 1С) ---
    const attrs = document.getElementById('attrs');
    attrs.innerHTML = '';
    const addAttrRow = (a, тип, kind, child, icon) => {
      const row = document.createElement('div');
      const isUsed = kind === 'field' ? used.has(a.имя) : kind === 'table' ? usedT.has(a.имя)
                   : kind === 'cmd' ? usedC.has(a.имя) : false;
      row.className = 'attr-row' + (isUsed ? ' used' : '') + (child ? ' child' : '');
      let tgl = '<span class="tgl"></span>';
      if (kind === 'table')
        tgl = '<span class="tgl">' + (expandedT.has(a.имя) ? '▾' : '▸') + '</span>';
      row.innerHTML = (child ? '' : tgl) +
        '<span class="ico">' + icon + '</span>' +
        '<span class="nm" title="' + a.имя + '">' + a.имя + '</span>' +
        '<span class="tp">' + (тип || '') + '</span>';
      if (kind) {
        row.draggable = true;
        row.ondragstart = ev => {
          attrDrag = { kind, name: a.имя };
          dragged = null;
          ev.dataTransfer.setData('text/plain', a.имя);
          ev.dataTransfer.effectAllowed = 'copy';
        };
        row.ondragend = () => { attrDrag = null; };
        row.ondblclick = () => dropAttr({ kind, name: a.имя }, { arr: els });  // двойной клик = добавить в конец
      }
      if (kind === 'table') {
        const t = row.querySelector('.tgl');
        t.onclick = ev => {
          ev.stopPropagation();
          if (expandedT.has(a.имя)) expandedT.delete(a.имя); else expandedT.add(a.имя);
          render();
        };
      }
      attrs.appendChild(row);
    };
    // --- вкладки панели: Реквизиты | Команды (как в 1С) ---
    document.getElementById('atabAttrs').className = 'atab' + (attrTab === 'attrs' ? ' on' : '');
    document.getElementById('atabCmds').className = 'atab' + (attrTab === 'cmds' ? ' on' : '');
    document.getElementById('attrHeadNm').textContent = attrTab === 'attrs' ? 'Реквизит' : 'Команда';
    document.getElementById('attrHeadTp').textContent = attrTab === 'attrs' ? 'Тип' : 'Представление';
    document.getElementById('attrHint').textContent = attrTab === 'attrs'
      ? (listMode ? 'Перетащите реквизит на форму — появится колонка списка.'
                  : 'Перетащите реквизит или табличную часть на форму либо в дерево элементов.')
      : (listMode ? 'Перетащите команду на форму — появится кнопка командной панели списка.'
                  : 'Перетащите команду на форму — появится кнопка. Команды — публичные методы модуля объекта (C#); вкладка «Модуль» внизу открывает его.');
    if (attrTab === 'attrs') {
      if (listMode) {
        for (const f of listAttrs()) addAttrRow(f, f.тип || 'Строка', 'field', false, '▭');
      } else {
        for (const f of info.стандартные) addAttrRow(f, f.тип || 'Строка', 'field', false, '•');
        for (const f of info.реквизиты) addAttrRow(f, f.тип || 'Строка', 'field', false, '▭');
        for (const t of info.таблицы) {
          addAttrRow({ имя: t.имя }, '(Табличная часть)', 'table', false, '▦');
          if (expandedT.has(t.имя))
            for (const a of t.реквизиты) addAttrRow(a, a.тип || 'Строка', null, true, '▫');
        }
      }
    } else {
      for (const и of (listMode ? STD_LIST_ACTIONS : STD_ACTIONS))
        addAttrRow({ имя: и }, CMD_TITLES[и] + ' (стандартная)', 'cmd', false, '🔘');
      if (!listMode)
        for (const к of (info.команды || [])) addAttrRow({ имя: к.имя }, '(метод модуля C#)', 'cmd', false, '⚙');
    }
  }

  // лёгкая перерисовка (не трогая фокус в свойствах) — обновить подписи
  function renderSoft() {
    for (const r of treeRows) r.div.children[1].textContent = r.label();
    renderPreviewOnly();
  }
  // обновить только тексты в превью (без перерисовки — не трогает фокус в панели свойств)
  function renderPreviewOnly() {
    const pv = document.getElementById('preview');
    const t0 = pv.querySelector('.title');
    if (t0) t0.textContent = (props.Заголовок || info.синоним) + ' (' + data.formName + ')';
    // поля на неактивных вкладках не отрисованы — обновляем по совпадению количества;
    // подпись ищем внутри строки поля (при ПоложениеЗаголовка=Нет её нет)
    const visible = [];
    collectVisible(els, visible);
    const vf = visible.filter(e => e.Тип === 'Поле');
    pv.querySelectorAll('.fld').forEach((row, i) => {
      const lab = row.querySelector('label');
      if (lab && vf[i]) lab.textContent = elTitle(vf[i]) + ':';
    });
    const btns = [];
    walk(els, e => { if (e.Тип === 'Кнопка') btns.push(e); });
    pv.querySelectorAll('.cmdbar .btn1c').forEach((b, i) => { if (btns[i]) b.textContent = elTitle(btns[i]); });
    const caps = pv.querySelectorAll('.tbl1c .cap');
    const vt = visible.filter(e => e.Тип === 'Таблица');
    caps.forEach((c, i) => { if (vt[i]) c.textContent = elTitle(vt[i]); });
    const decos = pv.querySelectorAll('.deco1c');
    const vd = visible.filter(e => e.Тип === 'Декорация');
    decos.forEach((d, i) => { if (vd[i]) d.textContent = vd[i].Заголовок || 'Надпись'; });
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

  document.getElementById('btnAdd').onclick = () =>
    addNew(document.getElementById('addSelect').value);
  function addNew(v) {
    if (!v) return;
    const [k, name] = [v.slice(0, 1), v.slice(2)];
    if (listMode && k === 'f') { dropAttr({ kind: 'field', name }, {}); return; }
    let нов;
    if (k === 'f') {
      const d = fieldDef(name);
      нов = { Тип: 'Поле', Реквизит: name, Заголовок: d ? d.синоним : name, ТолькоПросмотр: false };
    } else if (k === 't') {
      const d = tabularDef(name);
      нов = { Тип: 'Таблица', ТабличнаяЧасть: name, Заголовок: d ? d.синоним : name };
    } else if (k === 'b') {
      if (name === 'КомандаМодуля')
        нов = { Тип: 'Кнопка', Действие: 'МояКоманда', Заголовок: 'Моя команда' };
      else
        нов = { Тип: 'Кнопка', Действие: name, Заголовок: CMD_TITLES[name] || name };
    } else if (k === 'd') {
      нов = { Тип: 'Декорация', Заголовок: 'Надпись' };
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
  }
  document.getElementById('btnAxaml').onclick = () => {
    vscode.postMessage({ type: 'exportAxaml', elements: els });
  };
  if (listMode) document.getElementById('btnAxaml').style.display = 'none';
  document.getElementById('tabModule').onclick = () => {
    vscode.postMessage({ type: 'openModule' });
  };
  document.getElementById('atabAttrs').onclick = () => { attrTab = 'attrs'; render(); };
  document.getElementById('atabCmds').onclick = () => { attrTab = 'cmds'; render(); };
  document.getElementById('btnDel').onclick = delSel;
  document.getElementById('btnUp').onclick = () => moveSel(-1);
  document.getElementById('btnDown').onclick = () => moveSel(1);

  render();
</script>
</body></html>`;
}

module.exports = { html, defaultElements, defaultListElements, standardFields };
