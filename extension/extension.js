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
  return j;
}

function objectToJson(node, def) {
  const j = { Вид: def.kind1c, Имя: node.name, Синоним: node.synonym || '', Комментарий: node.comment || '' };
  if (node.type) j.Тип = node.type;
  if (node.table) j.Таблица = node.table;
  if (node.module) j.Модуль = node.module;
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
  return leaf;
}

function jsonToObject(j, def) {
  const obj = mkObject(def, j.Имя || 'БезИмени');
  obj.synonym = j.Синоним || splitWords(obj.name);
  obj.comment = j.Комментарий || '';
  if (j.Тип) obj.type = j.Тип;
  if (j.Таблица) obj.table = j.Таблица;
  if (j.Модуль) obj.module = j.Модуль;
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
    this.migrated = assignTables(root);
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
    if (!this.fileMode) assignTables(this.model);
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
      : node.kind === 'object' && this.hasModule(node) ? 'objectM'
      : node.kind;
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

let propPanel = null;
let propNodeId = null;

function nodeTypeLabel(node) {
  if (node.kind === 'root') return 'Конфигурация';
  if (node.kind === 'class') return 'Группа метаданных';
  if (node.kind === 'folder') return 'Группа';
  return node.typeLabel || 'Объект';
}

function cmdProperties(provider, treeView, node) {
  node = node || treeView.selection[0] || provider.model;
  propNodeId = node.id;

  if (!propPanel) {
    propPanel = vscode.window.createWebviewPanel(
      'onecProps', 'Свойства', { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true });
    propPanel.onDidDispose(() => { propPanel = null; propNodeId = null; });
    propPanel.webview.onDidReceiveMessage(msg => {
      const n = provider.index.get(propNodeId);
      if (!n || msg.type !== 'set') return;
      if (msg.field === 'name') {
        if (validateName(msg.value) || msg.value === n.name) return;
        const oldName = n.name;
        n.name = msg.value;
        if (n.kind === 'object') renameModuleWithObject(provider.storage, n, oldName, msg.value);
      } else if (msg.field === 'synonym') n.synonym = msg.value;
      else if (msg.field === 'comment') n.comment = msg.value;
      else if (msg.field === 'type') n.type = msg.value;
      else if (msg.field === 'version') n.version = msg.value;
      provider.refresh();
      propPanel.title = 'Свойства: ' + n.name;
    });
  }

  const editable = ['object', 'leaf', 'root'].includes(node.kind);
  propPanel.title = 'Свойства: ' + node.name;
  propPanel.webview.html = propsHtml(node, editable);
  propPanel.reveal(vscode.ViewColumn.Beside, true);
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
    for (const id of ['name','synonym','comment','type','version']) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => vscode.postMessage({ type: 'set', field: id, value: el.value }));
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

  context.subscriptions.push(
    treeView,
    vscode.commands.registerCommand('onecTree.add', n => cmdAdd(provider, treeView, n)),
    vscode.commands.registerCommand('onecTree.delete', n => cmdDelete(provider, treeView, n)),
    vscode.commands.registerCommand('onecTree.rename', n => cmdRename(provider, treeView, n)),
    vscode.commands.registerCommand('onecTree.properties', n => cmdProperties(provider, treeView, n)),
    vscode.commands.registerCommand('onecTree.openModule', n => cmdOpenModule(provider, treeView, storage, n)),
    vscode.commands.registerCommand('onecTree.publish', () => cmdPublish(provider, storage, context)),
    vscode.commands.registerCommand('onecTree.publishDotnet', () => cmdPublishDotnet(storage)),
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
