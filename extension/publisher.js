// Встроенный публикатор: дерево конфигурации -> SQLite (sql.js, без внешних зависимостей)
// + генерация типизированного C#-кода (Generated/Метаданные.g.cs).
// Логика повторяет tools/Publisher (C#), результат совместим.
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Сбор данных из дерева конфигурации
// ---------------------------------------------------------------------------

function folderItems(objNode, folderType) {
  const folder = (objNode.children || []).find(c => c.kind === 'folder' && c.folderType === folderType);
  return folder ? (folder.children || []) : [];
}

function requireColumn(l, где) {
  if (!l.column) throw new Error(
    `У реквизита «${где}.${l.name}» не задано имя колонки. ` +
    'Откройте конфигурацию в конфигураторе (VS Code) — имена колонок будут присвоены автоматически — и повторите публикацию.');
  return l.column;
}

function attrsOf(objNode, folderType) {
  return folderItems(objNode, folderType).map(l => ({
    name: l.name, synonym: l.synonym || l.name, type: l.type || 'Строка',
    col: requireColumn(l, objNode.name),
    // кандидаты на переименование колонки в старых базах: текущее имя и история имён
    oldCols: [l.name, ...(l.prevNames || [])]
  }));
}

// Снимок метаданных: Конфигурация.json + все объекты из каталога metadata/
function собратьСнимок(metadataDir, config) {
  const снимок = { Имя: config.name, Синоним: config.synonym || '', Версия: config.version || '', Комментарий: '', Объекты: [] };
  try {
    const корневой = path.join(metadataDir, 'Конфигурация.json');
    if (fs.existsSync(корневой)) {
      const k = JSON.parse(fs.readFileSync(корневой, 'utf8'));
      снимок.Синоним = k.Синоним || снимок.Синоним;
      снимок.Комментарий = k.Комментарий || '';
    }
    const обойти = dir => {
      for (const имя of fs.readdirSync(dir)) {
        const полный = path.join(dir, имя);
        if (fs.statSync(полный).isDirectory()) { обойти(полный); continue; }
        if (!имя.endsWith('.json') || имя === 'Конфигурация.json') continue;
        try {
          const o = JSON.parse(fs.readFileSync(полный, 'utf8'));
          if (o && o.Имя) снимок.Объекты.push(o);
        } catch { /* битый файл пропускаем */ }
      }
    };
    if (fs.existsSync(metadataDir)) обойти(metadataDir);
  } catch { /* снимок не критичен для публикации таблиц */ }
  return JSON.stringify(снимок);
}

function requireTable(o, вид) {
  if (!o.table) throw new Error('У объекта «' + вид + '.' + o.name + '» не задано имя таблицы. Откройте дерево конфигурации — имена присваиваются автоматически.');
  return o.table;
}

function collect(model) {
  const cls = id => model.children.find(c => c.classId === id) || { children: [] };
  const data = {
    config: { name: model.name, synonym: model.synonym || '', version: model.version || '1.0.0' },
    constants: cls('constants').children.map(o => ({ name: o.name, type: o.type || 'Строка', prev: o.prevNames || [] })),
    catalogs: [], documents: [], enums: [], infoRegs: [], accumRegs: []
  };
  const vt = (o, legacyPrefix) => folderItems(o, 'Табличные части').map(t => ({
    name: t.name,
    table: requireTable({ name: `${o.name}.${t.name}`, table: t.table }, 'ТабличнаяЧасть'),
    legacy: `${legacyPrefix}_${o.name}_${t.name}`, // только для миграции баз до v0.5.0
    attrs: (t.children || []).map(l => ({
      name: l.name, type: l.type || 'Строка',
      col: requireColumn(l, `${o.name}.${t.name}`),
      oldCols: [l.name, ...(l.prevNames || [])]
    }))
  }));
  for (const o of cls('catalogs').children) {
    data.catalogs.push({
      name: o.name, synonym: o.synonym || o.name,
      table: requireTable(o, 'Справочник'), legacy: `Спр_${o.name}`, // legacy — только для миграции
      attrs: attrsOf(o, 'Реквизиты'),
      tabulars: vt(o, 'Спр')
    });
  }
  for (const o of cls('documents').children) {
    data.documents.push({
      name: o.name, synonym: o.synonym || o.name,
      table: requireTable(o, 'Документ'), legacy: `Док_${o.name}`,
      attrs: attrsOf(o, 'Реквизиты'),
      tabulars: vt(o, 'Док')
    });
  }
  for (const o of cls('enums').children) {
    data.enums.push({
      name: o.name, synonym: o.synonym || o.name,
      table: requireTable(o, 'Перечисление'), legacy: `Переч_${o.name}`,
      values: folderItems(o, 'Значения').map(v => ({ name: v.name, synonym: v.synonym || v.name, prev: v.prevNames || [] }))
    });
  }
  for (const o of cls('infoRegs').children) {
    data.infoRegs.push({ name: o.name, table: requireTable(o, 'РегистрСведений'), legacy: `РегСвед_${o.name}`,
      dims: attrsOf(o, 'Измерения'), ress: attrsOf(o, 'Ресурсы'), attrs: attrsOf(o, 'Реквизиты') });
  }
  for (const o of cls('accumRegs').children) {
    data.accumRegs.push({ name: o.name, table: requireTable(o, 'РегистрНакопления'), legacy: `РегНакоп_${o.name}`,
      dims: attrsOf(o, 'Измерения'), ress: attrsOf(o, 'Ресурсы') });
  }
  return data;
}

// ---------------------------------------------------------------------------
// SQLite (sql.js)
// ---------------------------------------------------------------------------

function sqlType(t) {
  if (t === 'Число') return 'NUMERIC DEFAULT 0';
  if (t === 'Булево') return 'INTEGER DEFAULT 0';
  return "TEXT DEFAULT ''";
}

async function publish(model, rootPath, extensionDir) {
  const initSqlJs = require(path.join(extensionDir, 'lib', 'sql-wasm.js'));
  const SQL = await initSqlJs({ locateFile: f => path.join(extensionDir, 'lib', f) });

  const dbPath = path.join(rootPath, 'data', 'app.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();

  let created = 0, updated = 0;
  const log = [];

  const tableExists = name => {
    const r = db.exec("SELECT 1 FROM sqlite_master WHERE type='table' AND name=" + quoteStr(name));
    return r.length > 0;
  };
  const columnsOf = name => {
    const r = db.exec(`PRAGMA table_info("${name}")`);
    return new Set(r.length ? r[0].values.map(v => String(v[1]).toLowerCase()) : []);
  };
  const quoteStr = s => "'" + String(s).replace(/'/g, "''") + "'";

  // создать таблицу или мягко добавить недостающие колонки
  function ensureTable(name, cols, pk) {
    if (!tableExists(name)) {
      const defs = cols.map(c => `"${c[0]}" ${c[1]}`);
      if (pk) defs.push(`PRIMARY KEY (${pk})`);
      db.run(`CREATE TABLE "${name}" (${defs.join(', ')})`);
      log.push(`+ таблица ${name}`);
      created++;
    } else {
      const have = columnsOf(name);
      for (const c of cols.filter(c => !have.has(c[0].toLowerCase()))) {
        // колонка переименована? ищем прежнее имя (с конца истории) среди существующих
        const старое = (c[2] || []).slice().reverse().find(p => have.has(String(p).toLowerCase()));
        if (старое) {
          db.run(`ALTER TABLE "${name}" RENAME COLUMN "${старое}" TO "${c[0]}"`);
          log.push(`~ ${name}: колонка ${старое} переименована в ${c[0]} (данные сохранены)`);
          have.delete(String(старое).toLowerCase());
        } else {
          db.run(`ALTER TABLE "${name}" ADD COLUMN "${c[0]}" ${c[1]}`);
          log.push(`~ ${name}: добавлена колонка ${c[0]}`);
        }
        have.add(c[0].toLowerCase());
        updated++;
      }
    }
  }

  const data = collect(model);

  // Миграция: старая таблица по имени объекта -> стабильное имя (данные сохраняются)
  function migrate(legacy, now) {
    if (legacy && now && legacy !== now && tableExists(legacy) && !tableExists(now)) {
      db.run(`ALTER TABLE "${legacy}" RENAME TO "${now}"`);
      log.push(`> ${legacy} переименована в ${now}`);
      updated++;
    }
  }

  // Константы
  if (data.constants.length) {
    ensureTable('Константы', [['Имя', 'TEXT NOT NULL'], ['Значение', "TEXT DEFAULT ''"]], '"Имя"');
    for (const k of data.constants) {
      // переименование константы: перенести строку со значением
      for (const старое of (k.prev || []).slice().reverse())
        db.run(`UPDATE Константы SET Имя=${quoteStr(k.name)} WHERE Имя=${quoteStr(старое)}
                AND NOT EXISTS(SELECT 1 FROM Константы WHERE Имя=${quoteStr(k.name)})`);
      db.run(`INSERT OR IGNORE INTO Константы(Имя, Значение) VALUES(${quoteStr(k.name)}, '')`);
    }
  }

  // Справочники
  for (const c of data.catalogs) {
    migrate(c.legacy, c.table);
    const cols = [['Ссылка', 'TEXT NOT NULL'], ['Код', "TEXT DEFAULT ''"], ['Наименование', "TEXT DEFAULT ''"], ['ПометкаУдаления', 'INTEGER DEFAULT 0']];
    cols.push(...c.attrs.map(a => [a.col, sqlType(a.type), a.oldCols]));
    ensureTable(c.table, cols, '"Ссылка"');
    for (const t of c.tabulars) {
      migrate(t.legacy, t.table);
      const tc = [['Ссылка', 'TEXT NOT NULL'], ['НомерСтроки', 'INTEGER']];
      tc.push(...t.attrs.map(a => [a.col, sqlType(a.type), a.oldCols]));
      ensureTable(t.table, tc);
    }
  }

  // Документы
  for (const d of data.documents) {
    migrate(d.legacy, d.table);
    const cols = [['Ссылка', 'TEXT NOT NULL'], ['Номер', "TEXT DEFAULT ''"], ['Дата', "TEXT DEFAULT ''"], ['Проведен', 'INTEGER DEFAULT 0'], ['ПометкаУдаления', 'INTEGER DEFAULT 0']];
    cols.push(...d.attrs.map(a => [a.col, sqlType(a.type), a.oldCols]));
    ensureTable(d.table, cols, '"Ссылка"');
    for (const t of d.tabulars) {
      migrate(t.legacy, t.table);
      const tc = [['Ссылка', 'TEXT NOT NULL'], ['НомерСтроки', 'INTEGER']];
      tc.push(...t.attrs.map(a => [a.col, sqlType(a.type), a.oldCols]));
      ensureTable(t.table, tc);
    }
  }

  // Перечисления + значения
  const переименованияЗначений = []; // [имяПеречисления, старое, новое] — применим к данным после всех таблиц
  for (const e of data.enums) {
    migrate(e.legacy, e.table);
    ensureTable(e.table, [['Имя', 'TEXT NOT NULL'], ['Синоним', "TEXT DEFAULT ''"], ['Порядок', 'INTEGER DEFAULT 0']], '"Имя"');
    for (const v of e.values) {
      // значение переименовано: перенести строку и запомнить для обновления данных
      for (const старое of (v.prev || []).slice().reverse()) {
        const r = db.exec(`SELECT 1 FROM "${e.table}" WHERE Имя=${quoteStr(старое)}`);
        if (r.length && !db.exec(`SELECT 1 FROM "${e.table}" WHERE Имя=${quoteStr(v.name)}`).length)
          db.run(`UPDATE "${e.table}" SET Имя=${quoteStr(v.name)} WHERE Имя=${quoteStr(старое)}`);
        переименованияЗначений.push([e.name, старое, v.name]);
      }
    }
    e.values.forEach((v, i) =>
      db.run(`INSERT OR REPLACE INTO "${e.table}"(Имя, Синоним, Порядок) VALUES(${quoteStr(v.name)}, ${quoteStr(v.synonym)}, ${i})`));
    // удалить значения, которых больше нет под прежними именами (после переноса)
  }

  // Регистры сведений
  for (const r of data.infoRegs) {
    migrate(r.legacy, r.table);
    const cols = [...r.dims, ...r.ress, ...r.attrs].map(a => [a.col, sqlType(a.type), a.oldCols]);
    const pk = r.dims.map(d => `"${d.col}"`).join(', ');
    ensureTable(r.table, cols, pk || null);
  }

  // Регистры накопления
  for (const r of data.accumRegs) {
    migrate(r.legacy, r.table);
    const cols = [['Регистратор', "TEXT DEFAULT ''"], ['Период', "TEXT DEFAULT ''"], ['ВидДвижения', "TEXT DEFAULT 'Приход'"]];
    cols.push(...[...r.dims, ...r.ress].map(a => [a.col, sqlType(a.type), a.oldCols]));
    ensureTable(r.table, cols);
  }

  // Ссылки на переименованные значения перечислений в данных (хранятся по имени значения)
  if (переименованияЗначений.length) {
    const колонкиСсылок = []; // [таблица, колонка, тип]
    for (const c of data.catalogs) {
      c.attrs.forEach(a => колонкиСсылок.push([c.table, a.col, a.type]));
      c.tabulars.forEach(t => t.attrs.forEach(a => колонкиСсылок.push([t.table, a.col, a.type])));
    }
    for (const d of data.documents) {
      d.attrs.forEach(a => колонкиСсылок.push([d.table, a.col, a.type]));
      d.tabulars.forEach(t => t.attrs.forEach(a => колонкиСсылок.push([t.table, a.col, a.type])));
    }
    for (const r of data.infoRegs)
      [...r.dims, ...r.ress, ...r.attrs].forEach(a => колонкиСсылок.push([r.table, a.col, a.type]));
    for (const r of data.accumRegs)
      [...r.dims, ...r.ress].forEach(a => колонкиСсылок.push([r.table, a.col, a.type]));
    for (const [переч, старое, новое] of переименованияЗначений)
      for (const [табл, кол, тип] of колонкиСсылок)
        if (тип === 'ПеречислениеСсылка.' + переч) {
          db.run(`UPDATE "${табл}" SET "${кол}"=${quoteStr(новое)} WHERE "${кол}"=${quoteStr(старое)}`);
          log.push(`~ ${табл}.${кол}: значение ${старое} -> ${новое}`);
        }
  }

  // Версия конфигурации + полный снимок метаданных (клиент может работать без каталога metadata/)
  ensureTable('_Конфигурация', [['Имя', 'TEXT'], ['Версия', 'TEXT'], ['ДатаПубликации', 'TEXT'], ['Метаданные', 'TEXT']]);
  db.run('DELETE FROM _Конфигурация');
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const снимок = собратьСнимок(path.join(rootPath, 'metadata'), data.config);
  db.run('INSERT INTO _Конфигурация (Имя, Версия, ДатаПубликации, Метаданные) VALUES(?, ?, ?, ?)',
    [data.config.name, data.config.version, now, снимок]);

  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  db.close();

  // Генерация типизированного C#-кода
  let genFile = null;
  const logicDir = path.join(rootPath, 'src', 'BusinessLogic');
  if (fs.existsSync(logicDir)) {
    genFile = path.join(logicDir, 'Generated', 'Метаданные.g.cs');
    fs.mkdirSync(path.dirname(genFile), { recursive: true });
    fs.writeFileSync(genFile, generateCode(data), 'utf8');
  }

  return { dbPath, created, updated, log, genFile };
}

// ---------------------------------------------------------------------------
// Генерация C#-кода (идентична tools/Publisher)
// ---------------------------------------------------------------------------

function csType(t) {
  if (t === 'Число') return 'decimal';
  if (t === 'Булево') return 'bool';
  return 'string';
}

function propLine(name, type) {
  const cs = csType(type);
  const getter = cs === 'decimal' ? `Запись.Число("${name}")`
    : cs === 'bool' ? `Запись.Строка("${name}") is "1" or "True" or "true"`
    : `Запись.Строка("${name}")`;
  const setter = cs === 'bool' ? `Запись["${name}"] = value ? 1 : 0` : `Запись["${name}"] = value`;
  return `    public ${cs} ${name} { get => ${getter}; set => ${setter}; }`;
}

function generateCode(data) {
  const L = [];
  L.push('// <auto-generated>');
  L.push('// Сгенерировано публикатором из metadata/*.json — не редактируйте вручную.');
  L.push('// Перегенерация: dotnet run --project tools/Publisher -- metadata data/app.db');
  L.push('// </auto-generated>');
  L.push('#nullable enable');
  L.push('using OneC.Core;');
  L.push('');
  L.push('namespace BusinessLogic;');
  L.push('');

  L.push('public static class Перечисления');
  L.push('{');
  for (const e of [...data.enums].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    L.push(`    /// <summary>${e.synonym}</summary>`);
    L.push(`    public static class ${e.name}`);
    L.push('    {');
    for (const v of e.values) {
      L.push(`        /// <summary>${v.synonym}</summary>`);
      L.push(`        public const string ${v.name} = "${v.name}";`);
    }
    L.push('    }');
  }
  L.push('}');
  L.push('');

  // статические помощники доступа к словарю — внутри каждого генерируемого класса
  const dictHelpers = [
    '    static string С(Dictionary<string, object?> п, string имя) => п.TryGetValue(имя, out var v) ? v?.ToString() ?? "" : "";',
    '    static decimal Ч(Dictionary<string, object?> п, string имя) => decimal.TryParse(С(п, имя), System.Globalization.CultureInfo.InvariantCulture, out var d) ? d : 0m;'
  ];
  const dictProp = (name, type, dict) => {
    if (type === 'Число') return `    public decimal ${name} { get => Ч(${dict}, "${name}"); set => ${dict}["${name}"] = value; }`;
    if (type === 'Булево') return `    public bool ${name} { get => С(${dict}, "${name}") is "1" or "True" or "true"; set => ${dict}["${name}"] = value ? 1 : 0; }`;
    return `    public string ${name} { get => С(${dict}, "${name}"); set => ${dict}["${name}"] = value; }`;
  };

  // --- Движения по регистрам накопления ---
  const регистры = [...data.accumRegs].sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const r of регистры) {
    L.push(`/// <summary>Движение по регистру накопления «${r.name}»</summary>`);
    L.push(`public class Движение${r.name}`);
    L.push('{');
    L.push('    public Движение Движение { get; }');
    L.push(`    public Движение${r.name}(Движение движение) => Движение = движение;`);
    L.push('    Dictionary<string, object?> Поля => Движение.Поля;');
    L.push(...dictHelpers);
    for (const a of [...r.dims, ...r.ress]) L.push(dictProp(a.name, a.type, 'Поля'));
    L.push('}');
    L.push('');
    L.push(`/// <summary>Движения документа по регистру «${r.name}»</summary>`);
    L.push(`public class Движения${r.name}`);
    L.push('{');
    L.push('    readonly НаборДвижений _набор;');
    L.push(`    public Движения${r.name}(НаборДвижений набор) => _набор = набор;`);
    L.push(`    public Движение${r.name} ДобавитьПриход() => new(_набор.Приход("${r.name}"));`);
    L.push(`    public Движение${r.name} ДобавитьРасход() => new(_набор.Расход("${r.name}"));`);
    L.push('}');
    L.push('');
  }
  L.push('/// <summary>Типизированные движения по всем регистрам накопления (параметр ОбработкаПроведения)</summary>');
  L.push('public class Движения');
  L.push('{');
  L.push('    public НаборДвижений Набор { get; }');
  L.push('    public Движения(НаборДвижений набор)');
  L.push('    {');
  L.push('        Набор = набор;');
  for (const r of регистры) L.push(`        ${r.name} = new(набор);`);
  L.push('    }');
  for (const r of регистры) L.push(`    public Движения${r.name} ${r.name} { get; }`);
  L.push('}');
  L.push('');

  const objects = [
    ...data.catalogs.map(c => ({ kind: 'Справочник', ...c })),
    ...data.documents.map(d => ({ kind: 'Документ', ...d }))
  ].sort((a, b) => (`${a.kind}.${a.name}` < `${b.kind}.${b.name}` ? -1 : 1));

  for (const o of objects) {
    const rec = `${o.kind}${o.name}Запись`;
    const mod = `Модуль${o.kind}${o.name}`;

    // --- Типизированные строки табличных частей ---
    for (const t of o.tabulars || []) {
      const row = `${o.kind}${o.name}${t.name}Строка`;
      L.push(`/// <summary>Строка ТЧ «${t.name}» объекта ${o.kind}.${o.name}</summary>`);
      L.push(`public class ${row}`);
      L.push('{');
      L.push('    public Dictionary<string, object?> Поля { get; }');
      L.push(`    public ${row}(Dictionary<string, object?> поля) => Поля = поля;`);
      L.push(...dictHelpers);
      for (const a of t.attrs) L.push(dictProp(a.name, a.type, 'Поля'));
      L.push('}');
      L.push('');
    }

    L.push(`/// <summary>Типизированная запись: ${o.kind}.${o.name}</summary>`);
    L.push(`public class ${rec}`);
    L.push('{');
    L.push('    public ЗаписьОбъекта Запись { get; }');
    L.push(`    public ${rec}(ЗаписьОбъекта запись) => Запись = запись;`);
    L.push('    public string? Ссылка => Запись.Ссылка;');
    L.push('    public bool ЭтоНовый => Запись.ЭтоНовый;');
    if (o.kind === 'Справочник') {
      L.push(propLine('Код', 'Строка'));
      L.push(propLine('Наименование', 'Строка'));
    } else {
      L.push(propLine('Номер', 'Строка'));
      L.push(propLine('Дата', 'Дата'));
    }
    for (const a of o.attrs) L.push(propLine(a.name, a.type));
    for (const t of o.tabulars || [])
      L.push(`    public List<${o.kind}${o.name}${t.name}Строка> ${t.name} => Запись.Строки("${t.name}").Select(с => new ${o.kind}${o.name}${t.name}Строка(с)).ToList();`);
    L.push('}');
    L.push('');
    L.push(`/// <summary>Базовый модуль с типизированными обработчиками: ${o.kind}.${o.name}</summary>`);
    L.push(`public abstract class ${mod} : МодульОбъекта`);
    L.push('{');
    L.push(`    public sealed override void ПередЗаписью(ЗаписьОбъекта запись, Отказ отказ) => ПередЗаписью(new ${rec}(запись), отказ);`);
    L.push(`    public virtual void ПередЗаписью(${rec} запись, Отказ отказ) { }`);
    L.push(`    public sealed override void ПриЗаписи(ЗаписьОбъекта запись) => ПриЗаписи(new ${rec}(запись));`);
    L.push(`    public virtual void ПриЗаписи(${rec} запись) { }`);
    L.push(`    public sealed override void ПриЗаполнении(ЗаписьОбъекта запись) => ПриЗаполнении(new ${rec}(запись));`);
    L.push(`    public virtual void ПриЗаполнении(${rec} запись) { }`);
    if (o.kind === 'Документ') {
      L.push(`    public sealed override void ОбработкаПроведения(ЗаписьОбъекта запись, НаборДвижений движения, Отказ отказ) => ОбработкаПроведения(new ${rec}(запись), new Движения(движения), отказ);`);
      L.push(`    public virtual void ОбработкаПроведения(${rec} запись, Движения движения, Отказ отказ) { }`);
    }
    L.push('}');
    L.push('');

    // --- Типизированный запрос ---
    const q = `Запрос${o.kind}${o.name}`;
    L.push(`/// <summary>Запрос с отбором и сортировкой: ${o.kind}.${o.name}</summary>`);
    L.push(`public class ${q}`);
    L.push('{');
    L.push(`    readonly Запрос _запрос = Запрос.Из("${o.kind}.${o.name}");`);
    L.push(`    public ${q} Отбор(string поле, object? значение) { _запрос.Отбор(поле, значение); return this; }`);
    L.push(`    public ${q} Отбор(string поле, string оператор, object? значение) { _запрос.Отбор(поле, оператор, значение); return this; }`);
    L.push(`    public ${q} Сортировка(string поле, bool убывание = false) { _запрос.Сортировка(поле, убывание); return this; }`);
    L.push(`    public ${q} Первые(int количество) { _запрос.Первые(количество); return this; }`);
    L.push(`    public ${q} СТабличнымиЧастями() { _запрос.СТабличнымиЧастями(); return this; }`);
    L.push(`    public List<${rec}> Выбрать() => _запрос.Выбрать().Select(з => new ${rec}(з)).ToList();`);
    L.push(`    public ${rec}? ВыбратьПервую() { _запрос.Первые(1); return Выбрать().FirstOrDefault(); }`);
    L.push('}');
    L.push('');
  }

  // --- Точки входа запросов: Справочники.X / Документы.X ---
  const entry = (cls, kind, arr) => {
    L.push(`/// <summary>Типизированные запросы: ${cls}.&lt;Имя&gt;.Отбор(...).Выбрать()</summary>`);
    L.push(`public static class ${cls}`);
    L.push('{');
    for (const o of [...arr].sort((a, b) => (a.name < b.name ? -1 : 1)))
      L.push(`    public static Запрос${kind}${o.name} ${o.name} => new();`);
    L.push('}');
    L.push('');
  };
  entry('Справочники', 'Справочник', data.catalogs);
  entry('Документы', 'Документ', data.documents);
  return L.join('\n');
}

module.exports = { publish, collect, generateCode };
