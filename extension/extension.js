// Дерево конфигурации в стиле Конфигуратора 1С:Предприятие
// v0.2: хранение метаданных в JSON-файлах проекта (metadata/**.json),
//       модули бизнес-логики на C#, публикация в SQLite.
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Описание классов метаданных
// ---------------------------------------------------------------------------

const OBJ_FOLDERS = ['Реквизиты', 'Табличные части', 'Формы', 'Команды', 'Макеты'];
const REG_FOLDERS = ['Измерения', 'Ресурсы', 'Реквизиты', 'Формы', 'Макеты'];

const FOLDER_DEFS = {
  'Реквизиты':        { prefix: 'Реквизит',       icon: 'attribute', json: 'Реквизиты' },
  'Табличные части':  { prefix: 'ТабличнаяЧасть', icon: 'tabular',   json: 'ТабличныеЧасти' },
  'Формы':            { prefix: 'Форма',          icon: 'form',      json: 'Формы' },
  'Команды':          { prefix: 'Команда',        icon: 'command',   json: 'Команды' },
  'Макеты':           { prefix: 'Макет',          icon: 'template',  json: 'Макеты' },
  'Измерения':        { prefix: 'Измерение',      icon: 'dimension', json: 'Измерения' },
  'Ресурсы':          { prefix: 'Ресурс',         icon: 'resource',  json: 'Ресурсы' },
  'Значения':         { prefix: 'ЗначениеПеречисления', icon: 'enumvalue', json: 'Значения' },
  'Графы':            { prefix: 'Графа',          icon: 'column',    json: 'Графы' }
};

const TYPED_FOLDERS = ['Реквизиты', 'Измерения', 'Ресурсы', 'Графы'];

const CLASS_DEFS = [
  { id: 'constants',  label: 'Константы',                 dir: 'Константы',               kind1c: 'Константа',              icon: 'constant',  prefix: 'Константа',              folders: [] },
  { id: 'catalogs',   label: 'Справочники',               dir: 'Справочники',             kind1c: 'Справочник',             icon: 'catalog',   prefix: 'Справочник',             folders: OBJ_FOLDERS },
  { id: 'documents',  label: 'Документы',                 dir: 'Документы',               kind1c: 'Документ',               icon: 'document',  prefix: 'Документ',               folders: OBJ_FOLDERS },
  { id: 'journals',   label: 'Журналы документов',        dir: 'ЖурналыДокументов',       kind1c: 'ЖурналДокументов',       icon: 'journal',   prefix: 'ЖурналДокументов',       folders: ['Графы', 'Формы', 'Макеты'] },
  { id: 'enums',      label: 'Перечисления',              dir: 'Перечисления',            kind1c: 'Перечисление',           icon: 'enum',      prefix: 'Перечисление',           folders: ['Значения', 'Формы', 'Команды', 'Макеты'] },
  { id: 'reports',    label: 'Отчеты',                    dir: 'Отчеты',                  kind1c: 'Отчет',                  icon: 'report',    prefix: 'Отчет',                  folders: OBJ_FOLDERS },
  { id: 'processors', label: 'Обработки',                 dir: 'Обработки',               kind1c: 'Обработка',              icon: 'processor', prefix: 'Обработка',              folders: OBJ_FOLDERS },
  { id: 'chartsChar', label: 'Планы видов характеристик', dir: 'ПланыВидовХарактеристик', kind1c: 'ПланВидовХарактеристик', icon: 'chartchar', prefix: 'ПланВидовХарактеристик', folders: OBJ_FOLDERS },
  { id: 'chartsAcc',  label: 'Планы счетов',              dir: 'ПланыСчетов',             kind1c: 'ПланСчетов',             icon: 'chartacc',  prefix: 'ПланСчетов',             folders: OBJ_FOLDERS },
  { id: 'chartsCalc', label: 'Планы видов расчета',       dir: 'ПланыВидовРасчета',       kind1c: 'ПланВидовРасчета',       icon: 'chartcalc', prefix: 'ПланВидовРасчета',       folders: OBJ_FOLDERS },
  { id: 'infoRegs',   label: 'Регистры сведений',         dir: 'РегистрыСведений',        kind1c: 'РегистрСведений',        icon: 'inforeg',   prefix: 'РегистрСведений',        folders: REG_FOLDERS },
  { id: 'accumRegs',  label: 'Регистры накопления',       dir: 'РегистрыНакопления',      kind1c: 'РегистрНакопления',      icon: 'accumreg',  prefix: 'РегистрНакопления',      folders: REG_FOLDERS },
  { id: 'accntRegs',  label: 'Регистры бухгалтерии',      dir: 'РегистрыБухгалтерии',     kind1c: 'РегистрБухгалтерии',     icon: 'accntreg',  prefix: 'РегистрБухгалтерии',     folders: REG_FOLDERS },
  { id: 'calcRegs',   label: 'Регистры расчета',          dir: 'РегистрыРасчета',         kind1c: 'РегистрРасчета',         icon: 'calcreg',   prefix: 'РегистрРасчета',         folders: REG_FOLDERS },
  { id: 'bps',        label: 'Бизнес-процессы',           dir: 'БизнесПроцессы',          kind1c: 'БизнесПроцесс',          icon: 'bp',        prefix: 'БизнесПроцесс',          folders: OBJ_FOLDERS },
  { id: 'tasks',      label: 'Задачи',                    dir: 'Задачи',                  kind1c: 'Задача',                 icon: 'task',      prefix: 'Задача',                 folders: OBJ_FOLDERS },
  { id: 'extSources', label: 'Внешние источники данных',  dir: 'ВнешниеИсточникиДанных',  kind1c: 'ВнешнийИсточникДанных',  icon: 'extsource', prefix: 'ВнешнийИсточникДанных',  folders: [] }
];

const COMMON_DEFS = [
  { id: 'subsystems',    label: 'Подсистемы',           dir: 'Подсистемы',          kind1c: 'Подсистема',           icon: 'subsystem',  prefix: 'Подсистема' },
  { id: 'commonMods',    label: 'Общие модули',         dir: 'ОбщиеМодули',         kind1c: 'ОбщийМодуль',          icon: 'module',     prefix: 'ОбщийМодуль' },
  { id: 'sessionParams', label: 'Параметры сеанса',     dir: 'ПараметрыСеанса',     kind1c: 'ПараметрСеанса',       icon: 'sessionprm', prefix: 'ПараметрСеанса' },
  { id: 'roles',         label: 'Роли',                 dir: 'Роли',                kind1c: 'Роль',                 icon: 'role',       prefix: 'Роль' },
  { id: 'commonAttrs',   label: 'Общие реквизиты',      dir: 'ОбщиеРеквизиты',      kind1c: 'ОбщийРеквизит',        icon: 'attribute',  prefix: 'ОбщийРеквизит' },
  { id: 'exchPlans',     label: 'Планы обмена',         dir: 'ПланыОбмена',         kind1c: 'ПланОбмена',           icon: 'exchange',   prefix: 'ПланОбмена' },
  { id: 'eventSubs',     label: 'Подписки на события',  dir: 'ПодпискиНаСобытия',   kind1c: 'ПодпискаНаСобытие',    icon: 'eventsub',   prefix: 'ПодпискаНаСобытие' },
  { id: 'schedJobs',     label: 'Регламентные задания', dir: 'РегламентныеЗадания', kind1c: 'РегламентноеЗадание',  icon: 'schedjob',   prefix: 'РегламентноеЗадание' },
  { id: 'funcOptions',   label: 'Функциональные опции', dir: 'ФункциональныеОпции', kind1c: 'ФункциональнаяОпция',  icon: 'funcopt',    prefix: 'ФункциональнаяОпция' },
  { id: 'commonForms',   label: 'Общие формы',          dir: 'ОбщиеФормы',          kind1c: 'ОбщаяФорма',           icon: 'form',       prefix: 'ОбщаяФорма' },
  { id: 'commonPics',    label: 'Общие картинки',       dir: 'ОбщиеКартинки',       kind1c: 'ОбщаяКартинка',        icon: 'picture',    prefix: 'ОбщаяКартинка' }
];

// Виды объектов, у которых есть модуль бизнес-логики на C#
const MODULE_KINDS = new Set(['Справочник', 'Документ', 'Отчет', 'Обработка', 'БизнесПроцесс', 'Задача', 'ОбщийМодуль', 'РегистрСведений', 'РегистрНакопления']);

// ---------------------------------------------------------------------------
// Модель
// ---------------------------------------------------------------------------

let seq = 0;
function uid() { return 'n' + Date.now().toString(36) + (seq++).toString(36); }

function mkNode(kind, name, icon, extra) {
  return Object.assign({
    id: uid(), kind, name, icon,
    synonym: splitWords(name), comment: '', children: []
  }, extra || {});
}

function splitWords(name) {
  const s = String(name || '').replace(/([a-zа-яё0-9])([A-ZА-ЯЁ])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function mkObject(classDef, name) {
  const obj = mkNode('object', name, classDef.icon, { classId: classDef.id, typeLabel: classDef.prefix });
  if (classDef.id === 'constants') obj.type = 'Строка';
  for (const f of classDef.folders || []) {
    obj.children.push(mkNode('folder', f, 'folder_' + FOLDER_DEFS[f].icon, { folderType: f }));
  }
  return obj;
}

function mkLeaf(folderType, name) {
  const def = FOLDER_DEFS[folderType];
  const leaf = mkNode('leaf', name, def.icon, { folderType, typeLabel: def.prefix });
  if (TYPED_FOLDERS.includes(folderType)) leaf.type = 'Строка';
  return leaf;
}

function classDefById(id) {
  return CLASS_DEFS.find(c => c.id === id) || COMMON_DEFS.find(c => c.id === id);
}

// ---------------------------------------------------------------------------
// Стабильные имена таблиц БД (не зависят от имени объекта, как в 1С)
// ---------------------------------------------------------------------------

const TABLE_PREFIX = { catalogs: 'cat', documents: 'doc', enums: 'enm', infoRegs: 'inf', accumRegs: 'acc' };
const VT_PREFIX = 'vt';
const COL_PREFIX = 'fld';
// Папки, чьи элементы хранятся в колонках таблиц — им присваиваются стабильные имена колонок
const COLUMN_FOLDERS = new Set(['Реквизиты', 'Измерения', 'Ресурсы']);

function nextTableName(model, prefix) {
  let max = 0;
  const re = new RegExp('^' + prefix + '_(\\d+)$');
  const walk = n => {
    if (n.table) {
      const m = re.exec(n.table);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    (n.children || []).forEach(walk);
  };
  walk(model);
  return prefix + '_' + String(max + 1).padStart(7, '0');
}

function nextColumnName(model) {
  let max = 0;
  const re = new RegExp('^' + COL_PREFIX + '_(\\d+)$');
  const walk = n => {
    if (n.column) {
      const m = re.exec(n.column);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    (n.children || []).forEach(walk);
  };
  walk(model);
  return COL_PREFIX + '_' + String(max + 1).padStart(7, '0');
}

// Выдать стабильные имена колонок реквизитам/измерениям/ресурсам (включая реквизиты ТЧ)
function assignColumns(model) {
  let changed = false;
  const walkLeaf = leaf => {
    if (!leaf.column) { leaf.column = nextColumnName(model); changed = true; }
  };
  for (const classNode of model.children) {
    if (!TABLE_PREFIX[classNode.classId] || classNode.classId === 'enums') continue;
    for (const obj of classNode.children) {
      for (const folder of (obj.children || []).filter(c => c.kind === 'folder')) {
        if (COLUMN_FOLDERS.has(folder.folderType))
          (folder.children || []).forEach(walkLeaf);
        if (folder.folderType === 'Табличные части')
          for (const vt of folder.children || [])
            (vt.children || []).forEach(walkLeaf);
      }
    }
  }
  return changed;
}

// Выдать стабильные имена таблиц всем, у кого их ещё нет (миграция старых метаданных)
function assignTables(model) {
  let changed = false;
  for (const classNode of model.children) {
    const prefix = TABLE_PREFIX[classNode.classId];
    if (!prefix) continue;
    for (const obj of classNode.children) {
      if (!obj.table) { obj.table = nextTableName(model, prefix); changed = true; }
      for (const folder of (obj.children || []).filter(c => c.kind === 'folder' && c.folderType === 'Табличные части')) {
        for (const vt of folder.children || []) {
          if (!vt.table) { vt.table = nextTableName(model, VT_PREFIX); changed = true; }
        }
      }
    }
  }
  return changed;
}

// ---------------------------------------------------------------------------
// JSON-сериализация (формат файлов metadata/)
// ---------------------------------------------------------------------------

function leafToJson(leaf) {
  const j = { Имя: leaf.name, Синоним: leaf.synonym || '' };
  if (leaf.type) j.Тип = leaf.type;
  if (leaf.comment) j.Комментарий = leaf.comment;
  if (leaf.folderType === 'Табличные части') {
    if (leaf.table) j.Таблица = leaf.table;
    j.Реквизиты = (leaf.children || []).map(leafToJson);
  }
  if (leaf.folderType === 'Формы' && leaf.form) j.Элементы = leaf.form;
  if (leaf.folderType === 'Формы' && leaf.props) {
    if (leaf.props.Заголовок) j.Заголовок = leaf.props.Заголовок;
    if (leaf.props.Ширина > 0) j.Ширина = leaf.props.Ширина;
    if (leaf.props.Высота > 0) j.Высота = leaf.props.Высота;
  }
  if (leaf.column) j.Колонка = leaf.column;
  if (leaf.prevNames && leaf.prevNames.length) j.ПрежниеИмена = leaf.prevNames;
  return j;
}

function objectToJson(node, def) {
  const j = { Вид: def.kind1c, Имя: node.name, Синоним: node.synonym || '', Комментарий: node.comment || '' };
  if (node.type) j.Тип = node.type;
  if (node.table) j.Таблица = node.table;
  if (node.module) j.Модуль = node.module;
  if (node.prevNames && node.prevNames.length) j.ПрежниеИмена = node.prevNames;
  for (const folder of (node.children || []).filter(c => c.kind === 'folder')) {
    const key = FOLDER_DEFS[folder.folderType].json;
    j[key] = (folder.children || []).map(leafToJson);
  }
  return j;
}

function jsonToLeaf(j, folderType) {
  const leaf = mkLeaf(folderType, j.Имя || 'БезИмени');
  leaf.synonym = j.Синоним || splitWords(leaf.name);
  leaf.comment = j.Комментарий || '';
  if (j.Тип) leaf.type = j.Тип;
  if (folderType === 'Табличные части') {
    if (j.Таблица) leaf.table = j.Таблица;
    leaf.children = (j.Реквизиты || []).map(r => jsonToLeaf(r, 'Реквизиты'));
  }
  if (folderType === 'Формы' && j.Элементы) leaf.form = j.Элементы;
  if (folderType === 'Формы' && (j.Заголовок || j.Ширина || j.Высота))
    leaf.props = { Заголовок: j.Заголовок || '', Ширина: j.Ширина || 0, Высота: j.Высота || 0 };
  if (j.Колонка) leaf.column = j.Колонка;
  if (j.ПрежниеИмена) leaf.prevNames = j.ПрежниеИмена;
  return leaf;
}

function jsonToObject(j, def) {
  const obj = mkObject(def, j.Имя || 'БезИмени');
  obj.synonym = j.Синоним || splitWords(obj.name);
  obj.comment = j.Комментарий || '';
  if (j.Тип) obj.type = j.Тип;
  if (j.Таблица) obj.table = j.Таблица;
  if (j.Модуль) obj.module = j.Модуль;
  if (j.ПрежниеИмена) obj.prevNames = j.ПрежниеИмена;
  for (const folder of obj.children.filter(c => c.kind === 'folder')) {
    const key = FOLDER_DEFS[folder.folderType].json;
    folder.children = (j[key] || []).map(item => jsonToLeaf(item, folder.folderType));
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Демо-конфигурация (для режима без папки проекта и для инициализации)
// ---------------------------------------------------------------------------

function buildEmptyModel() {
  const root = mkNode('root', 'Конфигурация', 'config');
  const common = mkNode('class', 'Общие', 'common', { classId: 'common' });
  for (const def of COMMON_DEFS)
    common.children.push(mkNode('class', def.label, def.icon, { classId: def.id }));
  root.children.push(common);
  for (const def of CLASS_DEFS)
    root.children.push(mkNode('class', def.label, 'cls_' + def.icon, { classId: def.id }));
  return root;
}

function buildDefaultModel() {
  const root = buildEmptyModel();
  root.name = 'ДемоКонфигурация';
  root.synonym = 'Управление торговлей (демо)';
  const cls = id => root.children.find(c => c.classId === id);
  const commonCls = id => root.children[0].children.find(c => c.classId === id);
  const byLabel = (parent, label) => parent.children.find(c => c.name === label);

  for (const s of ['Продажи', 'Закупки'])
    commonCls('subsystems').children.push(mkNode('object', s, 'subsystem', { classId: 'subsystems', typeLabel: 'Подсистема' }));
  commonCls('commonMods').children.push(mkNode('object', 'ОбщегоНазначения', 'module', { classId: 'commonMods', typeLabel: 'ОбщийМодуль' }));
  commonCls('roles').children.push(mkNode('object', 'ПолныеПрава', 'role', { classId: 'roles', typeLabel: 'Роль' }));

  const constDef = classDefById('constants');
  for (const c of ['ВалютаУчета', 'НаименованиеОрганизации'])
    cls('constants').children.push(mkObject(constDef, c));

  const catDef = classDefById('catalogs');
  const nomen = mkObject(catDef, 'Номенклатура');
  byLabel(nomen, 'Реквизиты').children.push(mkLeaf('Реквизиты', 'Артикул'), mkLeaf('Реквизиты', 'ЕдиницаИзмерения'), mkLeaf('Реквизиты', 'Цена'));
  byLabel(nomen, 'Формы').children.push(mkLeaf('Формы', 'ФормаЭлемента'), mkLeaf('Формы', 'ФормаСписка'));
  cls('catalogs').children.push(nomen, mkObject(catDef, 'Контрагенты'), mkObject(catDef, 'Склады'));

  const docDef = classDefById('documents');
  const post = mkObject(docDef, 'ПоступлениеТоваров');
  byLabel(post, 'Реквизиты').children.push(mkLeaf('Реквизиты', 'Контрагент'), mkLeaf('Реквизиты', 'СуммаДокумента'));
  const tovary = mkLeaf('Табличные части', 'Товары');
  tovary.children.push(mkLeaf('Реквизиты', 'Номенклатура'), mkLeaf('Реквизиты', 'Количество'), mkLeaf('Реквизиты', 'Цена'));
  byLabel(post, 'Табличные части').children.push(tovary);
  cls('documents').children.push(post);

  const enumDef = classDefById('enums');
  const nds = mkObject(enumDef, 'СтавкиНДС');
  byLabel(nds, 'Значения').children.push(mkLeaf('Значения', 'НДС20'), mkLeaf('Значения', 'НДС10'), mkLeaf('Значения', 'БезНДС'));
  cls('enums').children.push(nds);
  return root;
}

// ---------------------------------------------------------------------------
// Хранилище: JSON-файлы в <workspace>/metadata
// ---------------------------------------------------------------------------

class Storage {
  constructor() {
    const ws = vscode.workspace.workspaceFolders;
    this.root = ws && ws.length ? ws[0].uri.fsPath : null;
    this.lastWrite = 0;
  }

  get metadataDir() { return this.root ? path.join(this.root, 'metadata') : null; }
  get configFile() { return this.metadataDir ? path.join(this.metadataDir, 'Конфигурация.json') : null; }
  get isProject() { return !!(this.configFile && fs.existsSync(this.configFile)); }

  readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
  }

  load() {
    const root = buildEmptyModel();
    const cfg = this.readJson(this.configFile) || {};
    root.name = cfg.Имя || 'Конфигурация';
    root.synonym = cfg.Синоним || '';
    root.comment = cfg.Комментарий || '';
    root.version = cfg.Версия || '1.0.0';

    const loadDir = (dir, def, target) => {
      if (!fs.existsSync(dir)) return;
      for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
        const j = this.readJson(path.join(dir, f));
        if (!j || !j.Имя) continue;
        if (CLASS_DEFS.includes(def)) {
          target.children.push(jsonToObject(j, def));
        } else {
          const o = mkNode('object', j.Имя, def.icon, { classId: def.id, typeLabel: def.prefix });
          o.synonym = j.Синоним || splitWords(j.Имя);
          o.comment = j.Комментарий || '';
          if (j.Тип) o.type = j.Тип;
          if (j.Модуль) o.module = j.Модуль;
          target.children.push(o);
        }
      }
    };

    for (const def of CLASS_DEFS) {
      const target = root.children.find(c => c.classId === def.id);
      loadDir(path.join(this.metadataDir, def.dir), def, target);
    }
    for (const def of COMMON_DEFS) {
      const target = root.children[0].children.find(c => c.classId === def.id);
      loadDir(path.join(this.metadataDir, 'Общие', def.dir), def, target);
    }
    this.migrated = assignTables(root) | assignColumns(root);
    return root;
  }

  save(model) {
    if (!this.metadataDir) return;
    this.lastWrite = Date.now();
    fs.mkdirSync(this.metadataDir, { recursive: true });

    const cfg = {
      Имя: model.name, Синоним: model.synonym || '',
      Версия: model.version || '1.0.0', Комментарий: model.comment || ''
    };
    fs.writeFileSync(this.configFile, JSON.stringify(cfg, null, 2) + '\n', 'utf8');

    const writeClass = (dir, def, classNode) => {
      const expected = new Set();
      if (classNode.children.length) fs.mkdirSync(dir, { recursive: true });
      for (const obj of classNode.children) {
        const json = CLASS_DEFS.includes(def)
          ? objectToJson(obj, def)
          : (() => {
              const j = { Вид: def.kind1c, Имя: obj.name, Синоним: obj.synonym || '', Комментарий: obj.comment || '' };
              if (obj.type) j.Тип = obj.type;
              if (obj.module) j.Модуль = obj.module;
              return j;
            })();
        const file = path.join(dir, obj.name + '.json');
        expected.add(obj.name + '.json');
        fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
      }
      // удаляем файлы удалённых/переименованных объектов
      if (fs.existsSync(dir)) {
        for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
          if (!expected.has(f)) fs.unlinkSync(path.join(dir, f));
        }
      }
    };

    for (const def of CLASS_DEFS) {
      const classNode = model.children.find(c => c.classId === def.id);
      writeClass(path.join(this.metadataDir, def.dir), def, classNode);
    }
    for (const def of COMMON_DEFS) {
      const classNode = model.children[0].children.find(c => c.classId === def.id);
      writeClass(path.join(this.metadataDir, 'Общие', def.dir), def, classNode);
    }
  }
}

// ---------------------------------------------------------------------------
// TreeDataProvider
// ---------------------------------------------------------------------------

class OnecTreeProvider {
  constructor(context, storage) {
    this.context = context;
    this.storage = storage;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.model = storage.isProject ? storage.load() : buildDefaultModel();
    this.fileMode = storage.isProject;
    if (this.fileMode && storage.migrated) storage.save(this.model);
    if (!this.fileMode) { assignTables(this.model); assignColumns(this.model); }
    this.index = new Map();
    this.parents = new Map();
    this.reindex();
  }

  reindex() {
    this.index.clear();
    this.parents.clear();
    const walk = (node, parent) => {
      this.index.set(node.id, node);
      this.parents.set(node.id, parent);
      for (const ch of node.children || []) walk(ch, node);
    };
    walk(this.model, null);
  }

  reloadFromDisk() {
    if (!this.storage.isProject) return;
    this.model = this.storage.load();
    this.fileMode = true;
    this.reindex();
    this._onDidChangeTreeData.fire(undefined);
  }

  refresh() {
    this.reindex();
    if (this.fileMode) this.storage.save(this.model);
    this._onDidChangeTreeData.fire(undefined);
  }

  getParent(node) { return this.parents.get(node.id) || undefined; }
  getChildren(node) { return node ? (node.children || []) : [this.model]; }

  getTreeItem(node) {
    const hasChildren = (node.children && node.children.length > 0) || ['root', 'class', 'folder'].includes(node.kind);
    const state = node.kind === 'root'
      ? vscode.TreeItemCollapsibleState.Expanded
      : hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;

    const item = new vscode.TreeItem(node.name, state);
    item.id = node.id;
    item.contextValue = node.kind === 'leaf' && node.folderType === 'Табличные части' ? 'tabular'
      : node.kind === 'leaf' && node.folderType === 'Формы' ? 'form'
      : node.kind === 'object' && this.hasModule(node) ? 'objectM'
      : node.kind;
    if (item.contextValue === 'form') {
      item.command = { command: 'onecTree.openForm', title: 'Открыть форму', arguments: [node] };
    }
    if (node.kind === 'root') {
      item.description = this.fileMode ? '' : '(демо, без папки проекта)';
      item.tooltip = this.fileMode ? 'Хранится в ' + this.storage.metadataDir : 'Откройте папку проекта, чтобы хранить конфигурацию в JSON-файлах';
    } else {
      let tip = node.name;
      if (node.synonym) tip += '\nСиноним: ' + node.synonym;
      if (node.type) tip += '\nТип: ' + node.type;
      item.tooltip = tip;
      if (node.kind === 'leaf' && node.type && node.type !== 'Строка') item.description = node.type;
    }
    const iconFile = path.join(this.context.extensionPath, 'media', 'icons', node.icon + '.svg');
    item.iconPath = { light: vscode.Uri.file(iconFile), dark: vscode.Uri.file(iconFile) };
    return item;
  }

  hasModule(node) {
    const def = classDefById(node.classId);
    return !!(def && MODULE_KINDS.has(def.kind1c));
  }
}

// ---------------------------------------------------------------------------
// Команды
// ---------------------------------------------------------------------------

const NAME_RE = /^[A-Za-zА-ЯЁа-яё_][A-Za-zА-ЯЁа-яё_0-9]*$/;

function validateName(value) {
  if (!value) return 'Имя не может быть пустым';
  if (!NAME_RE.test(value)) return 'Имя должно состоять из букв, цифр и «_» и не начинаться с цифры';
  return null;
}

function autoName(parent, prefix) {
  let n = 1;
  const names = new Set((parent.children || []).map(c => c.name));
  while (names.has(prefix + n)) n++;
  return prefix + n;
}

async function askName(title, def) {
  return vscode.window.showInputBox({ title, value: def, prompt: 'Имя', validateInput: validateName });
}

const KNOWN_TYPES = ['Строка', 'Число', 'Дата', 'Булево'];

async function askType(current) {
  const items = [
    ...KNOWN_TYPES.map(t => ({ label: t })),
    { label: 'СправочникСсылка.…', custom: 'СправочникСсылка.' },
    { label: 'ДокументСсылка.…', custom: 'ДокументСсылка.' },
    { label: 'ПеречислениеСсылка.…', custom: 'ПеречислениеСсылка.' }
  ];
  const pick = await vscode.window.showQuickPick(items, { title: 'Тип значения', placeHolder: 'Текущий: ' + (current || 'Строка') });
  if (!pick) return undefined;
  if (!pick.custom) return pick.label;
  return vscode.window.showInputBox({
    title: 'Укажите имя объекта', value: pick.custom,
    prompt: 'Например: СправочникСсылка.Номенклатура'
  });
}

async function cmdAdd(provider, treeView, node) {
  node = node || treeView.selection[0] || provider.model;

  if (node.kind === 'root') {
    const pick = await vscode.window.showQuickPick(
      CLASS_DEFS.map(d => ({ label: d.label, def: d })),
      { title: 'Добавить объект метаданных', placeHolder: 'Выберите вид объекта' });
    if (!pick) return;
    node = provider.model.children.find(c => c.classId === pick.def.id);
  } else if (node.kind === 'class' && node.classId === 'common') {
    const pick = await vscode.window.showQuickPick(
      COMMON_DEFS.map(d => ({ label: d.label, def: d })),
      { title: 'Добавить общий объект', placeHolder: 'Выберите вид объекта' });
    if (!pick) return;
    node = node.children.find(c => c.classId === pick.def.id);
  }

  if (node.kind === 'class') {
    const def = classDefById(node.classId);
    if (!def) return;
    const name = await askName('Новый: ' + (def.prefix || def.label), autoName(node, def.prefix));
    if (!name) return;
    const obj = CLASS_DEFS.includes(def)
      ? mkObject(def, name)
      : mkNode('object', name, def.icon, { classId: def.id, typeLabel: def.prefix });
    if (TABLE_PREFIX[def.id]) obj.table = nextTableName(provider.model, TABLE_PREFIX[def.id]);
    node.children.push(obj);
    provider.refresh();
    treeView.reveal(obj, { select: true, focus: true });
    return;
  }

  if (node.kind === 'object' || node.kind === 'folder' || (node.kind === 'leaf' && node.folderType === 'Табличные части')) {
    let folderNode = null;
    if (node.kind === 'folder') {
      folderNode = node;
    } else if (node.kind === 'object') {
      const folders = (node.children || []).filter(c => c.kind === 'folder');
      if (!folders.length) {
        vscode.window.showInformationMessage('У объекта «' + node.name + '» нет подчинённых групп.');
        return;
      }
      const pick = await vscode.window.showQuickPick(
        folders.map(f => ({ label: 'Добавить: ' + FOLDER_DEFS[f.folderType].prefix, f })),
        { title: node.name, placeHolder: 'Что добавить?' });
      if (!pick) return;
      folderNode = pick.f;
    } else {
      const name = await askName('Новый реквизит табличной части', autoName(node, 'Реквизит'));
      if (!name) return;
      const leaf = mkLeaf('Реквизиты', name);
      leaf.column = nextColumnName(provider.model);
      node.children.push(leaf);
      provider.refresh();
      treeView.reveal(leaf, { select: true });
      return;
    }
    const def = FOLDER_DEFS[folderNode.folderType];
    const name = await askName('Новый: ' + def.prefix, autoName(folderNode, def.prefix));
    if (!name) return;
    const leaf = mkLeaf(folderNode.folderType, name);
    if (folderNode.folderType === 'Табличные части') leaf.table = nextTableName(provider.model, VT_PREFIX);
    else if (COLUMN_FOLDERS.has(folderNode.folderType)) leaf.column = nextColumnName(provider.model);
    folderNode.children.push(leaf);
    provider.refresh();
    treeView.reveal(leaf, { select: true, focus: true });
    return;
  }

  vscode.window.showInformationMessage('Для этой ветки добавление недоступно.');
}

async function cmdDelete(provider, treeView, node) {
  node = node || treeView.selection[0];
  if (!node) return;
  if (node.kind !== 'object' && node.kind !== 'leaf') {
    vscode.window.showWarningMessage('Эту ветку удалить нельзя.');
    return;
  }
  const answer = await vscode.window.showWarningMessage(
    'Объект «' + node.name + '» будет удален. Продолжить?', { modal: true }, 'Да');
  if (answer !== 'Да') return;
  const parent = provider.parents.get(node.id);
  if (!parent) return;
  parent.children = parent.children.filter(c => c.id !== node.id);
  provider.refresh();
}

// --- Целостность при переименовании --------------------------------------
// Как в 1С: данные и перекрёстные ссылки конфигурации не ломаются при смене имён.

// Папки, чьи элементы соответствуют колонкам таблиц или хранимым значениям
const PREV_NAME_FOLDERS = new Set(['Реквизиты', 'Измерения', 'Ресурсы', 'Значения']);

function pushPrevName(node, oldName, newName) {
  const prev = (node.prevNames || []).filter(n => n !== newName); // вернули старое имя — из истории убрать
  if (!prev.includes(oldName)) prev.push(oldName);
  node.prevNames = prev;
}

function applyRenameIntegrity(provider, node, oldName, newName) {
  if (node.kind === 'object') {
    // константы хранятся строками таблицы Константы — публикатору нужна история имён
    if (node.classId === 'constants') pushPrevName(node, oldName, newName);
    // ссылочные типы во всей конфигурации: СправочникСсылка.Старое -> СправочникСсылка.Новое
    const def = classDefById(node.classId);
    if (!def) return;
    const oldType = def.kind1c + 'Ссылка.' + oldName;
    const newType = def.kind1c + 'Ссылка.' + newName;
    let fixed = 0;
    const walk = n => {
      if (n.type === oldType) { n.type = newType; fixed++; }
      for (const c of n.children || []) walk(c);
    };
    walk(provider.model);
    if (fixed > 0)
      vscode.window.showInformationMessage(`Обновлены ссылочные типы «${oldType}» → «${newType}»: ${fixed}`);
    return;
  }
  if (node.kind !== 'leaf') return;

  // история имён — публикатор переименует колонку (реквизит) или значение (перечисление)
  if (PREV_NAME_FOLDERS.has(node.folderType)) pushPrevName(node, oldName, newName);

  // формы объекта-владельца ссылаются на реквизиты и табличные части по имени
  let owner = provider.parents.get(node.id);
  let внутриТЧ = false;
  while (owner && owner.kind !== 'object') {
    if (owner.kind === 'leaf' && owner.folderType === 'Табличные части') внутриТЧ = true;
    owner = provider.parents.get(owner.id);
  }
  if (!owner) return;
  const formsFolder = (owner.children || []).find(c => c.kind === 'folder' && c.folderType === 'Формы');
  let formsFixed = 0;
  for (const форма of (formsFolder && formsFolder.children) || []) {
    for (const эл of форма.form || []) {
      if (!внутриТЧ && node.folderType === 'Реквизиты' && эл.Реквизит === oldName) { эл.Реквизит = newName; formsFixed++; }
      if (node.folderType === 'Табличные части' && эл.ТабличнаяЧасть === oldName) { эл.ТабличнаяЧасть = newName; formsFixed++; }
    }
  }
  if (formsFixed > 0)
    vscode.window.showInformationMessage(`Обновлены элементы форм объекта «${owner.name}»: ${formsFixed}`);
}

async function cmdRename(provider, treeView, node) {
  node = node || treeView.selection[0];
  if (!node) return;
  if (node.kind === 'class' || node.kind === 'folder') {
    vscode.window.showWarningMessage('Эту ветку переименовать нельзя.');
    return;
  }
  const name = await askName('Переименование: ' + node.name, node.name);
  if (!name || name === node.name) return;
  const oldName = node.name;
  node.name = name;
  node.synonym = splitWords(name);
  applyRenameIntegrity(provider, node, oldName, name);
  if (node.kind === 'object') renameModuleWithObject(provider.storage, node, oldName, name);
  provider.refresh();
}

// --- Модуль объекта на C# ---------------------------------------------------

// При переименовании объекта переименовать файл модуля и поправить код в нём
function renameModuleWithObject(storage, node, oldName, newName) {
  const def = classDefById(node.classId);
  if (!storage.root || !def || !MODULE_KINDS.has(def.kind1c)) return;
  const dir = path.join(storage.root, 'src', 'BusinessLogic', 'Modules');
  const oldFile = path.join(dir, node.module || (def.kind1c + '.' + oldName + '.cs'));
  if (!fs.existsSync(oldFile)) return;

  let text = fs.readFileSync(oldFile, 'utf8');
  const pairs = [
    ['"' + def.kind1c + '.' + oldName + '"', '"' + def.kind1c + '.' + newName + '"'],
    [def.kind1c + oldName + 'Запись', def.kind1c + newName + 'Запись'],
    ['Модуль' + def.kind1c + oldName, 'Модуль' + def.kind1c + newName],
    [def.kind1c + '_' + oldName, def.kind1c + '_' + newName],
    [def.kind1c + '.' + oldName, def.kind1c + '.' + newName]
  ];
  for (const [a, b] of pairs) text = text.split(a).join(b);

  const newFile = path.join(dir, def.kind1c + '.' + newName + '.cs');
  fs.writeFileSync(newFile, text, 'utf8');
  if (path.resolve(newFile) !== path.resolve(oldFile)) fs.unlinkSync(oldFile);
  node.module = path.basename(newFile);
  vscode.window.showInformationMessage('Модуль переименован: ' + path.basename(newFile));
}

function moduleTemplate(kind1c, name) {
  // Для справочников и документов — типизированный модуль:
  // реквизиты через точку + автодополнение (типы генерирует публикатор).
  if (kind1c === 'Справочник' || kind1c === 'Документ') {
    const rec = `${kind1c}${name}Запись`;
    const base = `Модуль${kind1c}${name}`;
    return `using OneC.Core;

namespace BusinessLogic.Modules;

/// <summary>
/// Модуль объекта: ${kind1c}.${name}
/// Реквизиты доступны через точку: запись.ИмяРеквизита
/// Типы генерируются публикатором (кнопка «Опубликовать в SQLite»).
/// </summary>
[МодульОбъекта("${kind1c}.${name}")]
public class ${kind1c}_${name} : ${base}
{
    public override void ПередЗаписью(${rec} запись, Отказ отказ)
    {
        // if (string.IsNullOrWhiteSpace(запись.Наименование))
        //     отказ.Установить("Не заполнено наименование.");
    }

    public override void ПриЗаписи(${rec} запись)
    {
    }

    public override void ПриЗаполнении(${rec} запись)
    {
        // запись.ИмяРеквизита = "значение по умолчанию";
        // запись.СтавкаНДС = Перечисления.СтавкиНДС.НДС20;
    }
}
`;
  }
  return `using OneC.Core;

namespace BusinessLogic.Modules;

/// <summary>
/// Модуль объекта: ${kind1c}.${name}
/// Обработчики в стиле 1С: ПередЗаписью, ПриЗаписи, ПриЗаполнении.
/// </summary>
[МодульОбъекта("${kind1c}.${name}")]
public class ${kind1c}_${name} : МодульОбъекта
{
    public override void ПередЗаписью(ЗаписьОбъекта запись, Отказ отказ)
    {
    }

    public override void ПриЗаписи(ЗаписьОбъекта запись)
    {
    }

    public override void ПриЗаполнении(ЗаписьОбъекта запись)
    {
    }
}
`;
}

async function cmdOpenModule(provider, treeView, storage, node) {
  node = node || treeView.selection[0];
  if (!node || node.kind !== 'object') return;
  const def = classDefById(node.classId);
  if (!def || !MODULE_KINDS.has(def.kind1c)) {
    vscode.window.showInformationMessage('У этого вида объектов нет модуля.');
    return;
  }
  if (!storage.root) {
    vscode.window.showWarningMessage('Откройте папку проекта, чтобы редактировать модули.');
    return;
  }
  const dir = path.join(storage.root, 'src', 'BusinessLogic', 'Modules');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, node.module || `${def.kind1c}.${node.name}.cs`);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, moduleTemplate(def.kind1c, node.name), 'utf8');
  }
  if (node.module !== path.basename(file)) {
    node.module = path.basename(file);   // фиксируем имя модуля в метаданных
    provider.refresh();
  }
  const doc = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(doc);
}

// --- Визуальный редактор форм -------------------------------------------------

const formEditor = require('./formeditor.js');
const formPanels = new Map(); // node.id -> webview panel

// Команды объекта (закладка «Команды» в дизайнере, как в 1С):
// публичные методы модуля C#, кроме стандартных переопределений-событий
const STD_MODULE_OVERRIDES = ['ПередЗаписью', 'ПриЗаписи', 'ПриЗаполнении', 'ОбработкаПроведения'];
function moduleCommands(provider, objNode) {
  try {
    const def = classDefById(objNode.classId);
    const storage = provider.storage;
    if (!storage || !storage.root) return [];
    const имяФайла = objNode.module || (def ? `${def.kind1c}.${objNode.name}.cs` : null);
    if (!имяФайла) return [];
    const file = path.join(storage.root, 'src', 'BusinessLogic', 'Modules', имяФайла);
    if (!fs.existsSync(file)) return [];
    const текст = fs.readFileSync(file, 'utf8');
    const имена = [];
    const re = /public\s+(?:override\s+|virtual\s+|async\s+)*[\wА-Яа-яЁё<>\[\],?.]+\s+([A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_]*)\s*\(/g;
    let m;
    while ((m = re.exec(текст)) !== null)
      if (!STD_MODULE_OVERRIDES.includes(m[1]) && !имена.includes(m[1])) имена.push(m[1]);
    return имена.map(и => ({ имя: и }));
  } catch { return []; }
}

function objectInfoFor(provider, objNode) {
  const def = classDefById(objNode.classId);
  const byFolder = type => {
    const f = (objNode.children || []).find(c => c.kind === 'folder' && c.folderType === type);
    return f ? f.children : [];
  };
  return {
    команды: moduleCommands(provider, objNode),
    вид: def ? def.kind1c : '',
    имя: objNode.name,
    синоним: objNode.synonym || objNode.name,
    стандартные: formEditor.standardFields(def ? def.kind1c : ''),
    реквизиты: byFolder('Реквизиты').map(l => ({ имя: l.name, синоним: l.synonym || l.name, тип: l.type || 'Строка' })),
    таблицы: byFolder('Табличные части').map(t => ({
      имя: t.name, синоним: t.synonym || t.name,
      реквизиты: (t.children || []).map(l => ({ имя: l.name, синоним: l.synonym || l.name, тип: l.type || 'Строка' }))
    }))
  };
}

// Открыть модуль объекта (создав из шаблона при необходимости)
async function openObjectModule(provider, storage, objNode) {
  const def = classDefById(objNode.classId);
  if (!def || !storage.root) return;
  const dir = path.join(storage.root, 'src', 'BusinessLogic', 'Modules');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, objNode.module || `${def.kind1c}.${objNode.name}.cs`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, moduleTemplate(def.kind1c, objNode.name), 'utf8');
  if (objNode.module !== path.basename(file)) {
    objNode.module = path.basename(file);
    provider.refresh();
  }
  const док = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(док);
}

// Открыть (при необходимости создать) обработчик события/команды в модуле объекта
async function openHandlerInModule(provider, storage, objNode, method) {
  const def = classDefById(objNode.classId);
  if (!def || !storage.root || !/^[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_]*$/.test(method)) return;
  const dir = path.join(storage.root, 'src', 'BusinessLogic', 'Modules');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, objNode.module || `${def.kind1c}.${objNode.name}.cs`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, moduleTemplate(def.kind1c, objNode.name), 'utf8');
  if (objNode.module !== path.basename(file)) {
    objNode.module = path.basename(file);
    provider.refresh();
  }
  let text = fs.readFileSync(file, 'utf8');
  // ВАЖНО: \b в JS не считает кириллицу «словом» — границу проверяем вручную,
  // иначе существующий метод не находится и дописывается дубликат
  const имяЭкранированное = method.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const методЕсть = new RegExp('(^|[^0-9A-Za-zА-Яа-яЁё_])' + имяЭкранированное + '\\s*\\(', 'm').test(text);
  if (!методЕсть) {
    const idx = text.lastIndexOf('}');
    if (idx < 0) return;
    const snippet = '\n    // Обработчик события/команды формы (клиент вызывает его по имени)\n' +
      `    public void ${method}(${def.kind1c}${objNode.name}Запись запись)\n` +
      '    {\n        \n    }\n';
    text = text.slice(0, idx) + snippet + text.slice(idx);
    fs.writeFileSync(file, text, 'utf8');
  }
  const doc = await vscode.workspace.openTextDocument(file);
  const editor = await vscode.window.showTextDocument(doc);
  const offset = doc.getText().indexOf('void ' + method);
  if (offset >= 0) {
    const pos = doc.positionAt(offset);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
  }
}

// --- Экспорт формы из дизайнера в произвольную AXAML-форму -------------------

function axamlEscape(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// генерация AXAML по элементам формы; info — objectInfoFor, formName — имя формы
function generateAxaml(info, formName, elements) {
  const модель = `${info.вид}_${info.имя}_Модель`;
  const класс = `${info.вид}_${info.имя}_${formName}`;
  const типПоля = имя => {
    const стд = { Код: 'Строка', Наименование: 'Строка', Номер: 'Строка', Дата: 'Дата', Проведен: 'Булево' };
    const р = (info.реквизиты || []).find(р => р.имя === имя);
    return (р && р.тип) || стд[имя] || 'Строка';
  };
  const L = [];
  const push = (отступ, текст) => L.push('  '.repeat(отступ) + текст);

  const поле = (о, э) => {
    const имя = э.Реквизит || '';
    const тип = типПоля(имя);
    const заголовок = э.Заголовок || имя;
    if (тип.includes('.'))
      push(о, `<!-- TODO: «${имя}» — ссылка (${тип}); в заготовке редактируется значение-ссылка, замените на выбор -->`);
    const ro = э.ТолькоПросмотр;
    // свойства из палитры (как в 1С)
    let общие = '';
    if (э.Видимость === false) общие += ' IsVisible="False"';
    if (э.Доступность === false) общие += ' IsEnabled="False"';
    let редактор;
    if (тип === 'Булево')
      редактор = col => `<CheckBox${col} IsChecked="{Binding ${имя}}"${ro ? ' IsEnabled="False"' : ''}/>`;
    else {
      let доп = ro ? ' IsReadOnly="True"' : '';
      if (э.МногострочныйРежим) доп += ' AcceptsReturn="True" TextWrapping="Wrap" MinHeight="64"';
      if (э.РежимПароля) доп += ' PasswordChar="●"';
      редактор = col => `<TextBox${col} Text="{Binding ${имя}}"${доп}/>`;
    }
    const пз = э.ПоложениеЗаголовка;
    if (пз === 'Нет') {
      push(о, `<StackPanel${общие}>` );
      push(о + 1, редактор(''));
      push(о, `</StackPanel>`);
    } else if (пз === 'Верх') {
      push(о, `<StackPanel Spacing="2"${общие}>`);
      push(о + 1, `<TextBlock Text="${axamlEscape(заголовок)}:"/>`);
      push(о + 1, редактор(''));
      push(о, `</StackPanel>`);
    } else {
      push(о, `<Grid ColumnDefinitions="140,*"${общие}>`);
      push(о + 1, `<TextBlock Text="${axamlEscape(заголовок)}:" VerticalAlignment="Center"/>`);
      push(о + 1, редактор(' Grid.Column="1"'));
      push(о, `</Grid>`);
    }
  };

  const таблица = (о, э) => {
    const тч = (info.таблицы || []).find(t => t.имя === э.ТабличнаяЧасть);
    if (!тч) return;
    const строка = `${info.вид}_${info.имя}_${тч.имя}_Строка`;
    // состав колонок: из дизайнера (порядок/заголовок/видимость/ширина) или все реквизиты ТЧ
    const видимые = (э.Колонки && э.Колонки.length)
      ? э.Колонки.filter(к => к.Видимость !== false)
          .map(к => ({ р: тч.реквизиты.find(р => р.имя === к.Реквизит), к })).filter(x => x.р)
      : тч.реквизиты.map(р => ({ р, к: null }));
    const колонки = видимые.map(({ р, к }) =>
      (к && к.Ширина > 0) ? String(к.Ширина) : (р.тип === 'Число' ? '90' : '*')).concat('32').join(',');
    push(о, `<TextBlock Text="${axamlEscape(э.Заголовок || тч.синоним || тч.имя)}" FontWeight="Bold"/>`);
    push(о, `<Grid ColumnDefinitions="${колонки}">`);
    видимые.forEach(({ р, к }, i) =>
      push(о + 1, `<TextBlock Grid.Column="${i}" Text="${axamlEscape((к && к.Заголовок) || р.синоним || р.имя)}" FontSize="11" Foreground="#8A6D3B"/>`));
    push(о, `</Grid>`);
    push(о, `<ItemsControl ItemsSource="{Binding ${тч.имя}}">`);
    push(о + 1, `<ItemsControl.ItemTemplate>`);
    push(о + 2, `<DataTemplate x:DataType="m:${строка}">`);
    push(о + 3, `<Grid ColumnDefinitions="${колонки}" Margin="0,1,0,0">`);
    видимые.forEach(({ р, к }, i) =>
      push(о + 4, `<TextBox Grid.Column="${i}" Text="{Binding ${р.имя}}"${(к && к.ТолькоПросмотр) ? ' IsReadOnly="True"' : ''}/>`));
    push(о + 4, `<Button Grid.Column="${видимые.length}" Content="✕" Click="УдалитьСтроку_${тч.имя}"/>`);
    push(о + 3, `</Grid>`);
    push(о + 2, `</DataTemplate>`);
    push(о + 1, `</ItemsControl.ItemTemplate>`);
    push(о, `</ItemsControl>`);
    push(о, `<Button Content="Добавить строку" Click="ДобавитьСтроку_${тч.имя}"/>`);
  };

  const элемент = (о, э) => {
    switch (э.Тип) {
      case 'Группа':
        push(о, `<StackPanel Orientation="${э.Группировка === 'Горизонтальная' ? 'Horizontal' : 'Vertical'}" Spacing="8"${э.Видимость === false ? ' IsVisible="False"' : ''}${э.Доступность === false ? ' IsEnabled="False"' : ''}>`);
        (э.Элементы || []).forEach(в => элемент(о + 1, в));
        push(о, `</StackPanel>`);
        break;
      case 'Страницы':
        push(о, `<TabControl>`);
        (э.Элементы || []).forEach(в => элемент(о + 1, в));
        push(о, `</TabControl>`);
        break;
      case 'Страница':
        push(о, `<TabItem Header="${axamlEscape(э.Заголовок || 'Страница')}">`);
        push(о + 1, `<StackPanel Spacing="6" Margin="0,6,0,0">`);
        (э.Элементы || []).forEach(в => элемент(о + 2, в));
        push(о + 1, `</StackPanel>`);
        push(о, `</TabItem>`);
        break;
      case 'Декорация':
        push(о, `<TextBlock Text="${axamlEscape(э.Заголовок)}" Foreground="#8A6D3B" TextWrapping="Wrap"${э.Видимость === false ? ' IsVisible="False"' : ''}/>`);
        break;
      case 'Кнопка':
        if (э.Действие)
          push(о, `<Button Content="${axamlEscape(э.Заголовок || э.Действие)}" Command="{Binding ${э.Действие}Команда}"${э.КнопкаПоУмолчанию ? ' IsDefault="True"' : ''}${э.Видимость === false ? ' IsVisible="False"' : ''}${э.Доступность === false ? ' IsEnabled="False"' : ''}/>`);
        break;
      case 'Таблица': таблица(о, э); break;
      default: поле(о, э);
    }
  };

  push(0, `<Window xmlns="https://github.com/avaloniaui"`);
  push(0, `        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"`);
  push(0, `        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"`);
  push(0, `        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"`);
  push(0, `        xmlns:m="using:BusinessLogic"`);
  push(0, `        mc:Ignorable="d" d:DesignWidth="700" d:DesignHeight="500"`);
  push(0, `        x:Class="BusinessLogic.Forms.${класс}"`);
  push(0, `        x:DataType="m:${модель}"`);
  push(0, `        Width="700" SizeToContent="Height" WindowStartupLocation="CenterOwner"`);
  push(0, `        Title="${axamlEscape(info.синоним || info.имя)}" Background="#FFE7B4">`);
  push(1, `<StackPanel Margin="16" Spacing="8">`);
  elements.forEach(э => элемент(2, э));
  push(2, `<TextBlock Text="{Binding Ошибки}" IsVisible="{Binding ЕстьОшибки}" Foreground="#B00020" TextWrapping="Wrap"/>`);
  push(2, `<StackPanel Orientation="Horizontal" Spacing="8" HorizontalAlignment="Right">`);
  if (info.вид === 'Документ') {
    push(3, `<Button Content="Провести и закрыть" Click="ПровестиИЗакрыть"/>`);
    push(3, `<Button Content="Записать" Click="ЗаписатьБезПроведения"/>`);
  } else {
    push(3, `<Button Content="Записать и закрыть" Click="ЗаписатьИЗакрыть"/>`);
  }
  push(3, `<Button Content="Отмена" Click="Отмена"/>`);
  push(2, `</StackPanel>`);
  push(1, `</StackPanel>`);
  push(0, `</Window>`);
  return L.join('\n') + '\n';
}

function generateAxamlCodeBehind(info, formName, elements) {
  const модель = `${info.вид}_${info.имя}_Модель`;
  const класс = `${info.вид}_${info.имя}_${formName}`;
  const таблицы = [];
  const walk = эл => (эл || []).forEach(э => {
    if (э.Тип === 'Таблица' && э.ТабличнаяЧасть && !таблицы.includes(э.ТабличнаяЧасть)) таблицы.push(э.ТабличнаяЧасть);
    walk(э.Элементы);
  });
  walk(elements);

  const L = [];
  L.push('using Avalonia.Controls;');
  L.push('using Avalonia.Interactivity;');
  L.push('using Avalonia.Markup.Xaml;');
  L.push('using OneC.Core;');
  L.push('');
  L.push('namespace BusinessLogic.Forms;');
  L.push('');
  L.push(`/// <summary>Произвольная форма «${formName}» объекта ${info.вид}.${info.имя} (экспорт из дизайнера).</summary>`);
  L.push(`[ПроизвольнаяФорма("${info.вид}.${info.имя}")]`);
  L.push(`public partial class ${класс} : Window, IПроизвольнаяФорма`);
  L.push('{');
  L.push('    КонтекстФормы? _контекст;');
  L.push(`    public ${модель} Модель { get; } = new();`);
  L.push('');
  L.push(`    public ${класс}() => AvaloniaXamlLoader.Load(this);`);
  L.push('');
  L.push('    public void Инициализировать(КонтекстФормы контекст)');
  L.push('    {');
  L.push('        _контекст = контекст;');
  L.push('        Модель.Загрузить(контекст.Запись);');
  L.push('        DataContext = Модель;');
  L.push('    }');
  L.push('');
  L.push('    void Записать(bool провести)');
  L.push('    {');
  L.push('        if (_контекст == null) return;');
  L.push('        Модель.Выгрузить(_контекст.Запись);');
  L.push('        var отказ = _контекст.Записать(_контекст.Запись, провести);');
  L.push('        if (отказ.Значение)');
  L.push('        {');
  L.push('            Модель.Ошибки = string.Join("\\n", отказ.Сообщения.Select(с => "• " + с));');
  L.push('            return;');
  L.push('        }');
  L.push('        Close(true);');
  L.push('    }');
  L.push('');
  if (info.вид === 'Документ') {
    L.push('    void ПровестиИЗакрыть(object? sender, RoutedEventArgs e) => Записать(true);');
    L.push('    void ЗаписатьБезПроведения(object? sender, RoutedEventArgs e) => Записать(false);');
  } else {
    L.push('    void ЗаписатьИЗакрыть(object? sender, RoutedEventArgs e) => Записать(false);');
  }
  L.push('    void Отмена(object? sender, RoutedEventArgs e) => Close(false);');
  for (const тч of таблицы) {
    const строка = `${info.вид}_${info.имя}_${тч}_Строка`;
    L.push('');
    L.push(`    void ДобавитьСтроку_${тч}(object? sender, RoutedEventArgs e) => Модель.${тч}.Add(new());`);
    L.push(`    void УдалитьСтроку_${тч}(object? sender, RoutedEventArgs e)`);
    L.push('    {');
    L.push(`        if ((sender as Control)?.DataContext is ${строка} строка) Модель.${тч}.Remove(строка);`);
    L.push('    }');
  }
  L.push('}');
  return L.join('\n') + '\n';
}

async function exportFormToAxaml(storage, provider, objNode, formName, elements) {
  if (!storage.root) return;
  const info = objectInfoFor(provider, objNode);
  if (info.вид !== 'Справочник' && info.вид !== 'Документ') {
    vscode.window.showWarningMessage('Экспорт в AXAML доступен для форм справочников и документов.');
    return;
  }
  const dir = path.join(storage.root, 'src', 'BusinessLogic', 'Forms');
  fs.mkdirSync(dir, { recursive: true });
  const база = `${info.вид}_${info.имя}_${formName}`;
  const axamlFile = path.join(dir, база + '.axaml');
  const csFile = path.join(dir, база + '.axaml.cs');
  if (fs.existsSync(axamlFile) || fs.existsSync(csFile)) {
    const ответ = await vscode.window.showWarningMessage(
      `Файлы формы «${база}» уже существуют. Перезаписать? (ручные правки будут потеряны)`,
      'Перезаписать', 'Отмена');
    if (ответ !== 'Перезаписать') return;
  }
  fs.writeFileSync(axamlFile, generateAxaml(info, formName, elements), 'utf8');
  fs.writeFileSync(csFile, generateAxamlCodeBehind(info, formName, elements), 'utf8');
  const док = await vscode.workspace.openTextDocument(axamlFile);
  await vscode.window.showTextDocument(док);
  vscode.window.showInformationMessage(
    `Произвольная форма создана: ${path.basename(axamlFile)}. После публикации клиент будет открывать её вместо генерируемой.`);
}

function cmdOpenForm(provider, treeView, storage, node) {
  node = node || treeView.selection[0];
  if (!node || node.folderType !== 'Формы') return;
  const folder = provider.parents.get(node.id);
  const objNode = folder ? provider.parents.get(folder.id) : null;
  if (!objNode) return;

  const info = objectInfoFor(provider, objNode);
  if (!node.form || !node.form.length) node.form = formEditor.defaultElements(info);

  if (!node.props) node.props = { Заголовок: '', Ширина: 0, Высота: 0 };
  let panel = formPanels.get(node.id);
  if (panel) {
    panel.webview.html = formEditor.html(info, node.name, node.form, node.props);
    panel.reveal();
    return;
  }
  panel = vscode.window.createWebviewPanel(
    'onecForm', 'Форма: ' + objNode.name + '.' + node.name,
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true });
  formPanels.set(node.id, panel);
  panel.onDidDispose(() => formPanels.delete(node.id));
  panel.webview.onDidReceiveMessage(msg => {
    if (msg.type === 'openHandler') {
      openHandlerInModule(provider, storage, objNode, msg.method);
      return;
    }
    if (msg.type === 'exportAxaml') {
      exportFormToAxaml(storage, provider, objNode, node.name, msg.elements || node.form || []);
      return;
    }
    if (msg.type === 'elementSelected') {
      propsView.showElement(msg.element, panel, objNode, node.name);
      return;
    }
    if (msg.type === 'openModule') {   // вкладка «Модуль» под превью — как в 1С
      openObjectModule(provider, storage, objNode);
      return;
    }
    if (msg.type === 'focusProps') {   // пункт «Свойства» контекстного меню дизайнера
      vscode.commands.executeCommand('onecProps.focus');
      return;
    }
    if (msg.type !== 'save') return;
    node.form = msg.elements;
    if (msg.props) node.props = msg.props;
    provider.refresh();
  });
  // при возврате на вкладку дизайнера палитра снова показывает его выделение
  panel.onDidChangeViewState(e => {
    if (e.webviewPanel.active) e.webviewPanel.webview.postMessage({ type: 'requestSelection' });
  });
  panel.webview.html = formEditor.html(info, node.name, node.form, node.props);
}

// --- Публикация в SQLite ------------------------------------------------------

async function cmdPublish(provider, storage, context) {
  if (!storage.isProject) {
    vscode.window.showWarningMessage('Нет проекта конфигурации. Откройте папку с каталогом metadata/ или выполните «1С: Инициализировать проект».');
    return;
  }
  try {
    const publisher = require('./publisher.js');
    const res = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Публикация конфигурации в SQLite…' },
      () => publisher.publish(provider.model, storage.root, context.extensionPath)
    );
    const parts = [`таблиц создано: ${res.created}, обновлено: ${res.updated}`];
    if (res.genFile) parts.push('код метаданных перегенерирован');
    vscode.window.showInformationMessage('Публикация выполнена (' + parts.join('; ') + '). База: data/app.db');
  } catch (e) {
    vscode.window.showErrorMessage('Ошибка публикации: ' + (e && e.message ? e.message : e));
  }
}

// Запуск клиента под отладчиком (точки останова в модулях бизнес-логики)
async function cmdDebug(storage) {
  if (!storage.root) {
    vscode.window.showWarningMessage('Откройте папку проекта конфигурации.');
    return;
  }
  const folder = vscode.workspace.workspaceFolders[0];
  const started = await vscode.debug.startDebugging(folder, 'Клиент 1С-мини (отладка)');
  if (!started) {
    vscode.window.showErrorMessage(
      'Не удалось запустить отладку. Нужны: расширение «C#» (ms-dotnettools.csharp), .NET SDK 8 и конфигурация «Клиент 1С-мини (отладка)» в .vscode/launch.json.');
  }
}

// Резервный вариант — через консольный публикатор на .NET
function cmdPublishDotnet(storage) {
  if (!storage.isProject) {
    vscode.window.showWarningMessage('Нет проекта конфигурации.');
    return;
  }
  const terminal = vscode.window.terminals.find(t => t.name === 'Публикация 1С')
    || vscode.window.createTerminal({ name: 'Публикация 1С', cwd: storage.root });
  terminal.show();
  terminal.sendText('dotnet run --project tools/Publisher -- metadata data/app.db');
}

async function cmdInit(provider, storage) {
  if (!storage.root) {
    vscode.window.showWarningMessage('Сначала откройте папку (File → Open Folder).');
    return;
  }
  if (storage.isProject) {
    vscode.window.showInformationMessage('Проект уже инициализирован: ' + storage.metadataDir);
    return;
  }
  provider.model = buildDefaultModel();
  provider.fileMode = true;
  storage.save(provider.model);
  provider.refresh();
  vscode.window.showInformationMessage('Конфигурация создана в ' + storage.metadataDir);
}

// ---------------------------------------------------------------------------
// Палитра свойств (webview)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Палитра свойств — панель в правой боковой панели VS Code (как в Конфигураторе 1С).
// Показывает свойства выделенного узла дерева ИЛИ элемента в дизайнере форм.
// ---------------------------------------------------------------------------

const PAL_EVENTS = { 'Поле': ['ПриИзменении', 'ПриВходе', 'ПриВыходе'], 'Таблица': ['ПриИзменении'] };
const PAL_STD_ACTIONS = ['ЗаписатьИЗакрыть', 'Отмена'];

class PropsViewProvider {
  constructor() {
    this.view = null;
    this.mode = null;            // {kind:'node', node} | {kind:'element', element, formPanel, objNode, formName}
    this.provider = null;        // OnecTreeProvider (устанавливается в activate)
    this.storage = null;
    this._lastElementJson = null;
  }

  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.onDidReceiveMessage(msg => this.onMessage(msg));
    this.rerender();
  }

  showNode(node) {
    if (!node) return;
    this.mode = { kind: 'node', node };
    this._lastElementJson = null;
    this.rerender();
  }

  showElement(element, formPanel, objNode, formName) {
    // дизайнер шлёт выделение при каждой перерисовке: если это тот же элемент
    // с теми же значениями — не перерисовываем палитру (не сбрасываем фокус ввода)
    const j = JSON.stringify({ e: element, f: formName });
    const тотЖе = this.mode && this.mode.kind === 'element' && this._lastElementJson === j;
    this.mode = { kind: 'element', element, formPanel, objNode, formName };
    if (тотЖе) return;
    this._lastElementJson = j;
    this.rerender();
  }

  rerender() {
    if (!this.view) return;
    const m = this.mode;
    if (!m) {
      this.view.description = '';
      this.view.webview.html = emptyPropsHtml();
      return;
    }
    if (m.kind === 'node') {
      const editable = ['object', 'leaf', 'root'].includes(m.node.kind);
      this.view.description = m.node.name;
      this.view.webview.html = propsHtml(m.node, editable);
    } else {
      const e = m.element;
      this.view.description = e ? (e.Заголовок || e.Реквизит || e.ТабличнаяЧасть || e.Тип) : m.formName;
      this.view.webview.html = elementPropsHtml(e, m.formName);
    }
  }

  onMessage(msg) {
    // --- правки узла дерева ---
    if (msg.type === 'set') {
      const n = this.provider && this.provider.index.get(msg.id);
      if (!n) return;
      if (msg.field === 'name') {
        if (validateName(msg.value) || msg.value === n.name) return;
        const oldName = n.name;
        n.name = msg.value;
        applyRenameIntegrity(this.provider, n, oldName, msg.value);
        if (n.kind === 'object') renameModuleWithObject(this.provider.storage, n, oldName, msg.value);
      } else if (msg.field === 'synonym') n.synonym = msg.value;
      else if (msg.field === 'comment') n.comment = msg.value;
      else if (msg.field === 'type') n.type = msg.value;
      else if (msg.field === 'version') n.version = msg.value;
      this.provider.refresh();
      if (this.mode && this.mode.kind === 'node' && this.mode.node.id === n.id) this.view.description = n.name;
      return;
    }
    // --- правки элемента формы: применяем локально и пересылаем в дизайнер ---
    if (msg.type === 'elSet') {
      const m = this.mode;
      if (!m || m.kind !== 'element' || !m.element || !m.formPanel) return;
      const e = m.element;
      if (msg.field === 'Событие') {
        e.События = e.События || {};
        if (msg.value) e.События[msg.event] = msg.value; else delete e.События[msg.event];
      } else e[msg.field] = msg.value;
      this._lastElementJson = JSON.stringify({ e, f: m.formName });   // не перерисовывать палитру
      m.formPanel.webview.postMessage({ type: 'propEdit', field: msg.field, event: msg.event, value: msg.value });
      return;
    }
    // --- переход «→» к обработчику в модуле ---
    if (msg.type === 'openHandler') {
      const m = this.mode;
      if (m && m.kind === 'element' && m.objNode)
        openHandlerInModule(this.provider, this.storage, m.objNode, msg.method);
    }
  }
}

const propsView = new PropsViewProvider();

const PAL_STYLE = `
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 0; margin: 0; font-size: 13px; }
  .cat { padding: 4px 10px; font-weight: 600; color: var(--vscode-descriptionForeground); border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-editorGroupHeader-tabsBackground); }
  table { width: 100%; border-collapse: collapse; }
  td { border-bottom: 1px solid var(--vscode-panel-border); padding: 2px 6px; vertical-align: middle; }
  td.lbl { width: 42%; border-right: 1px solid var(--vscode-panel-border); }
  input, select { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid transparent; padding: 3px 4px; font-family: inherit; font-size: inherit; }
  input:focus, select:focus { outline: none; border-color: var(--vscode-focusBorder); }
  input[disabled] { opacity: .6; }
  input[type=checkbox] { width: auto; }
  .ro { color: var(--vscode-descriptionForeground); padding: 3px 4px; }
  .evt { display: flex; gap: 4px; }
  .gobtn { flex: none; width: 26px; cursor: pointer; background: var(--vscode-button-secondaryBackground, #ddd); color: var(--vscode-button-secondaryForeground, #333); border: 1px solid var(--vscode-panel-border); border-radius: 3px; }
  .gobtn:hover { background: var(--vscode-button-secondaryHoverBackground, #ccc); }
  .empty { padding: 16px 10px; color: var(--vscode-descriptionForeground); }`;

function emptyPropsHtml() {
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><style>${PAL_STYLE}</style></head>
<body><div class="empty">Выберите объект в дереве конфигурации или элемент в редакторе формы.</div></body></html>`;
}

// Свойства элемента формы (дизайнер) — палитра как в 1С: группы «Основные» и «Использование»
function elementPropsHtml(e, formName) {
  if (!e) return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><style>${PAL_STYLE}</style></head>
<body><div class="cat">Форма: ${esc(formName)}</div><div class="empty">Выберите элемент формы.</div></body></html>`;

  // --- свойства САМОЙ ФОРМЫ (корневой узел «Форма» в дереве дизайнера) ---
  if (e.Тип === 'Форма') {
    return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><style>${PAL_STYLE}</style></head>
<body>
  <div class="cat">Свойства: Форма «${esc(formName)}»</div>
  <div class="cat">Основные:</div>
  <table>
    <tr><td class="lbl">Заголовок</td><td><input data-f="Заголовок" value="${esc(e.Заголовок)}" placeholder="(автозаголовок)"></td></tr>
    <tr><td class="lbl">Ширина</td><td><input data-f="Ширина" type="number" min="0" value="${e.Ширина || 0}" title="0 — автоматически"></td></tr>
    <tr><td class="lbl">Высота</td><td><input data-f="Высота" type="number" min="0" value="${e.Высота || 0}" title="0 — автоматически"></td></tr>
  </table>
  <script>
    const vscode = acquireVsCodeApi();
    for (const el of document.querySelectorAll('[data-f]'))
      el.addEventListener('input', () => vscode.postMessage({
        type: 'elSet', field: el.dataset.f,
        value: el.type === 'number' ? (parseInt(el.value, 10) || 0) : el.value
      }));
  </script>
</body></html>`;
  }
  if (e.Тип === 'КоманднаяПанель') {
    return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><style>${PAL_STYLE}</style></head>
<body><div class="cat">Командная панель формы «${esc(formName)}»</div>
<div class="empty">Кнопки формы. Состав пополняется с закладки «Команды» дизайнера.</div></body></html>`;
  }

  const text = (lbl, f, val, ph) =>
    `<tr><td class="lbl">${lbl}</td><td><input data-f="${f}" value="${esc(val)}"${ph ? ` placeholder="${esc(ph)}"` : ''}></td></tr>`;
  const check = (lbl, f, val) =>
    `<tr><td class="lbl">${lbl}</td><td><input type="checkbox" data-f="${f}"${val ? ' checked' : ''}></td></tr>`;
  const combo = (lbl, f, val, варианты) =>
    `<tr><td class="lbl">${lbl}</td><td><select data-f="${f}">` +
    варианты.map(v => `<option${val === v ? ' selected' : ''}>${v}</option>`).join('') + `</select></td></tr>`;
  const ro = (lbl, val) => `<tr><td class="lbl">${lbl}</td><td><div class="ro">${esc(val)}</div></td></tr>`;

  // --- Основные ---
  const осн = [];
  осн.push(text('Имя', 'Имя', e.Имя || '', e.Реквизит || e.ТабличнаяЧасть || e.Тип));
  осн.push(ro('Тип элемента', e.Тип));
  if (e.Тип === 'Поле') {
    if (e.Вид) осн.push(ro('Вид', e.Вид));
    осн.push(ro('ПутьКДанным', e.ПутьКДанным || ('Объект.' + (e.Реквизит || ''))));
    if (e.ТипЗначения) осн.push(ro('Тип значения', e.ТипЗначения));
  }
  if (e.Тип === 'Таблица') осн.push(ro('ПутьКДанным', e.ПутьКДанным || ('Объект.' + (e.ТабличнаяЧасть || ''))));
  if (e.Тип === 'Колонка') {
    осн.push(ro('ПутьКДанным', e.ПутьКДанным || ''));
    if (e.ТипЗначения) осн.push(ro('Тип значения', e.ТипЗначения));
  }
  if (e.Тип === 'Кнопка') {
    if (PAL_STD_ACTIONS.includes(e.Действие))
      осн.push(ro('Действие', e.Действие));
    else
      осн.push(`<tr><td class="lbl">Команда (метод C#)</td><td><div class="evt">` +
        `<input id="pAction" value="${esc(e.Действие)}" placeholder="имя метода">` +
        `<button class="gobtn" id="goAction" title="Перейти к обработчику в модуле (создаётся при необходимости)">→</button></div></td></tr>`);
  }
  осн.push(text('Заголовок', 'Заголовок', e.Заголовок));
  if (e.Тип === 'Поле')
    осн.push(combo('ПоложениеЗаголовка', 'ПоложениеЗаголовка', e.ПоложениеЗаголовка || 'Авто', ['Авто', 'Лево', 'Верх', 'Нет']));
  if (e.Тип === 'Группа')
    осн.push(combo('Группировка', 'Группировка', e.Группировка || 'Вертикальная', ['Вертикальная', 'Горизонтальная']));
  if (e.Тип === 'Колонка')
    осн.push(`<tr><td class="lbl">Ширина</td><td><input data-f="Ширина" type="number" min="0" value="${e.Ширина || 0}" title="0 — автоматически"></td></tr>`);

  // --- Использование ---
  const исп = [];
  исп.push(check('Видимость', 'Видимость', e.Видимость !== false));
  if (!['Декорация', 'Страница', 'Страницы', 'Колонка'].includes(e.Тип))
    исп.push(check('Доступность', 'Доступность', e.Доступность !== false));
  if (e.Тип === 'Поле' || e.Тип === 'Таблица' || e.Тип === 'Колонка')
    исп.push(check('ТолькоПросмотр', 'ТолькоПросмотр', !!e.ТолькоПросмотр));
  if (e.Тип === 'Кнопка')
    исп.push(check('КнопкаПоУмолчанию', 'КнопкаПоУмолчанию', !!e.КнопкаПоУмолчанию));
  if (e.Тип === 'Поле' && (!e.Вид || e.Вид === 'Поле ввода')) {
    исп.push(check('МногострочныйРежим', 'МногострочныйРежим', !!e.МногострочныйРежим));
    исп.push(check('РежимПароля', 'РежимПароля', !!e.РежимПароля));
  }

  const события = PAL_EVENTS[e.Тип] || [];
  const рядыСобытий = события.map(соб =>
    `<tr><td class="lbl">${соб}</td><td><div class="evt">` +
    `<input class="evtInp" data-evt="${соб}" value="${esc((e.События || {})[соб] || '')}" placeholder="имя метода">` +
    `<button class="gobtn goEvt" data-evt="${соб}" title="Перейти к обработчику в модуле (создаётся при необходимости)">→</button></div></td></tr>`).join('');

  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><style>${PAL_STYLE}</style></head>
<body>
  <div class="cat">Свойства: ${esc(e.Имя || e.Реквизит || e.ТабличнаяЧасть || e.Тип)} — форма «${esc(formName)}»</div>
  <div class="cat">Основные:</div>
  <table>${осн.join('')}</table>
  <div class="cat">Использование:</div>
  <table>${исп.join('')}</table>
  ${события.length ? `<div class="cat">События:</div><table>${рядыСобытий}</table>` : ''}
  <script>
    const vscode = acquireVsCodeApi();
    const автоимя = ${JSON.stringify((e.Реквизит || e.ТабличнаяЧасть || 'Элемент'))};
    // универсальная привязка: текст — по input, флажки и списки — по change
    for (const el of document.querySelectorAll('[data-f]')) {
      const отправить = () => vscode.postMessage({
        type: 'elSet', field: el.dataset.f,
        value: el.type === 'checkbox' ? el.checked : el.type === 'number' ? (parseInt(el.value, 10) || 0) : el.value
      });
      el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', отправить);
    }
    const pAction = document.getElementById('pAction');
    if (pAction) pAction.addEventListener('input', () => vscode.postMessage({ type: 'elSet', field: 'Действие', value: pAction.value }));
    const goAction = document.getElementById('goAction');
    if (goAction) goAction.addEventListener('click', () => {
      let имя = (pAction.value || '').trim();
      if (!имя) {
        имя = 'Команда1';
        pAction.value = имя;
        vscode.postMessage({ type: 'elSet', field: 'Действие', value: имя });
      }
      vscode.postMessage({ type: 'openHandler', method: имя });
    });
    for (const inp of document.querySelectorAll('.evtInp'))
      inp.addEventListener('input', () =>
        vscode.postMessage({ type: 'elSet', field: 'Событие', event: inp.dataset.evt, value: inp.value.trim() }));
    for (const btn of document.querySelectorAll('.goEvt'))
      btn.addEventListener('click', () => {
        const inp = document.querySelector('.evtInp[data-evt="' + btn.dataset.evt + '"]');
        let имя = (inp.value || '').trim();
        if (!имя) {   // как в 1С: имя обработчика по умолчанию — <Элемент><Событие>
          имя = автоимя + btn.dataset.evt;
          inp.value = имя;
          vscode.postMessage({ type: 'elSet', field: 'Событие', event: btn.dataset.evt, value: имя });
        }
        vscode.postMessage({ type: 'openHandler', method: имя });
      });
  </script>
</body></html>`;
}

function nodeTypeLabel(node) {
  if (node.kind === 'root') return 'Конфигурация';
  if (node.kind === 'class') return 'Группа метаданных';
  if (node.kind === 'folder') return 'Группа';
  return node.typeLabel || 'Объект';
}

function cmdProperties(provider, treeView, node) {
  node = node || treeView.selection[0] || provider.model;
  propsView.showNode(node);
  vscode.commands.executeCommand('onecProps.focus');
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function propsHtml(node, editable) {
  const dis = editable ? '' : 'disabled';
  const hasType = node.type !== undefined;
  const typeRow = hasType ? `
    <tr><td class="lbl">Тип</td><td>
      <input id="type" value="${esc(node.type)}" list="types" ${dis}>
      <datalist id="types">
        <option>Строка</option><option>Число</option><option>Дата</option><option>Булево</option>
        <option>СправочникСсылка.</option><option>ДокументСсылка.</option><option>ПеречислениеСсылка.</option>
      </datalist>
    </td></tr>` : '';
  const versionRow = node.kind === 'root' ? `
    <tr><td class="lbl">Версия</td><td><input id="version" value="${esc(node.version || '1.0.0')}"></td></tr>` : '';
  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 0; margin: 0; font-size: 13px; }
  .hdr { padding: 6px 10px; font-weight: 600; background: var(--vscode-sideBarSectionHeader-background); border-bottom: 1px solid var(--vscode-panel-border); }
  .cat { padding: 4px 10px; font-weight: 600; color: var(--vscode-descriptionForeground); border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-editorGroupHeader-tabsBackground); }
  table { width: 100%; border-collapse: collapse; }
  td { border-bottom: 1px solid var(--vscode-panel-border); padding: 2px 6px; vertical-align: middle; }
  td.lbl { width: 38%; border-right: 1px solid var(--vscode-panel-border); }
  input { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid transparent; padding: 3px 4px; font-family: inherit; font-size: inherit; }
  input:focus { outline: none; border-color: var(--vscode-focusBorder); }
  input[disabled] { opacity: .6; }
  .ro { color: var(--vscode-descriptionForeground); padding: 3px 4px; }
</style></head>
<body>
  <div class="hdr">Свойства: ${esc(node.name)}</div>
  <div class="cat">Основные:</div>
  <table>
    <tr><td class="lbl">Имя</td><td><input id="name" value="${esc(node.name)}" ${dis}></td></tr>
    <tr><td class="lbl">Синоним</td><td><input id="synonym" value="${esc(node.synonym)}" ${dis}></td></tr>
    <tr><td class="lbl">Комментарий</td><td><input id="comment" value="${esc(node.comment)}" ${dis}></td></tr>
    ${typeRow}${versionRow}
    ${node.table ? `<tr><td class="lbl">Таблица БД</td><td><div class="ro">${esc(node.table)}</div></td></tr>` : ''}
    ${node.module ? `<tr><td class="lbl">Модуль</td><td><div class="ro">${esc(node.module)}</div></td></tr>` : ''}
    <tr><td class="lbl">Тип метаданных</td><td><div class="ro">${esc(nodeTypeLabel(node))}</div></td></tr>
  </table>
  <script>
    const vscode = acquireVsCodeApi();
    const nodeId = '${node.id}';
    for (const id of ['name','synonym','comment','type','version']) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => vscode.postMessage({ type: 'set', id: nodeId, field: id, value: el.value }));
    }
  </script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Активация
// ---------------------------------------------------------------------------

function activate(context) {
  const storage = new Storage();
  const provider = new OnecTreeProvider(context, storage);
  propsView.provider = provider;
  propsView.storage = storage;
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('onecProps', propsView,
    { webviewOptions: { retainContextWhenHidden: true } }));
  const treeView = vscode.window.createTreeView('onecConfigTree', {
    treeDataProvider: provider,
    showCollapseAll: true
  });

  // Слежение за внешними изменениями metadata/**.json
  if (storage.root) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(storage.root, 'metadata/**/*.json'));
    let timer = null;
    const onFsChange = () => {
      if (Date.now() - storage.lastWrite < 1500) return; // наши собственные записи
      clearTimeout(timer);
      timer = setTimeout(() => provider.reloadFromDisk(), 400);
    };
    watcher.onDidChange(onFsChange);
    watcher.onDidCreate(onFsChange);
    watcher.onDidDelete(onFsChange);
    context.subscriptions.push(watcher);
  }

  // Палитра свойств (правая панель) следует за выделением в дереве — как в Конфигураторе 1С
  treeView.onDidChangeSelection(e => {
    const n = e.selection && e.selection[0];
    if (n) propsView.showNode(n);
  });

  context.subscriptions.push(
    treeView,
    vscode.commands.registerCommand('onecTree.add', n => cmdAdd(provider, treeView, n)),
    vscode.commands.registerCommand('onecTree.delete', n => cmdDelete(provider, treeView, n)),
    vscode.commands.registerCommand('onecTree.rename', n => cmdRename(provider, treeView, n)),
    vscode.commands.registerCommand('onecTree.properties', n => cmdProperties(provider, treeView, n)),
    vscode.commands.registerCommand('onecTree.openModule', n => cmdOpenModule(provider, treeView, storage, n)),
    vscode.commands.registerCommand('onecTree.publish', () => cmdPublish(provider, storage, context)),
    vscode.commands.registerCommand('onecTree.publishDotnet', () => cmdPublishDotnet(storage)),
    vscode.commands.registerCommand('onecTree.debug', () => cmdDebug(storage)),
    vscode.commands.registerCommand('onecTree.openForm', n => cmdOpenForm(provider, treeView, storage, n)),
    vscode.commands.registerCommand('onecTree.init', () => cmdInit(provider, storage)),
    vscode.commands.registerCommand('onecTree.setType', async n => {
      n = n || treeView.selection[0];
      if (!n || n.type === undefined) return;
      const t = await askType(n.type);
      if (t) { n.type = t; provider.refresh(); }
    }),
    vscode.commands.registerCommand('onecTree.refresh', () => {
      if (provider.fileMode) provider.reloadFromDisk();
      else provider.refresh();
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
