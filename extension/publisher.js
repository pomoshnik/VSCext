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

function attrsOf(objNode, folderType) {
  return folderItems(objNode, folderType).map(l => ({ name: l.name, synonym: l.synonym || l.name, type: l.type || 'Строка' }));
}

function collect(model) {
  const cls = id => model.children.find(c => c.classId === id) || { children: [] };
  const data = {
    config: { name: model.name, synonym: model.synonym || '', version: model.version || '1.0.0' },
    constants: cls('constants').children.map(o => ({ name: o.name, type: o.type || 'Строка' })),
    catalogs: [], documents: [], enums: [], infoRegs: [], accumRegs: []
  };
  for (const o of cls('catalogs').children) {
    data.catalogs.push({
      name: o.name, synonym: o.synonym || o.name,
      attrs: attrsOf(o, 'Реквизиты'),
      tabulars: folderItems(o, 'Табличные части').map(t => ({
        name: t.name,
        attrs: (t.children || []).map(l => ({ name: l.name, type: l.type || 'Строка' }))
      }))
    });
  }
  for (const o of cls('documents').children) {
    data.documents.push({
      name: o.name, synonym: o.synonym || o.name,
      attrs: attrsOf(o, 'Реквизиты'),
      tabulars: folderItems(o, 'Табличные части').map(t => ({
        name: t.name,
        attrs: (t.children || []).map(l => ({ name: l.name, type: l.type || 'Строка' }))
      }))
    });
  }
  for (const o of cls('enums').children) {
    data.enums.push({
      name: o.name, synonym: o.synonym || o.name,
      values: folderItems(o, 'Значения').map(v => ({ name: v.name, synonym: v.synonym || v.name }))
    });
  }
  for (const o of cls('infoRegs').children) {
    data.infoRegs.push({ name: o.name, dims: attrsOf(o, 'Измерения'), ress: attrsOf(o, 'Ресурсы'), attrs: attrsOf(o, 'Реквизиты') });
  }
  for (const o of cls('accumRegs').children) {
    data.accumRegs.push({ name: o.name, dims: attrsOf(o, 'Измерения'), ress: attrsOf(o, 'Ресурсы') });
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
        db.run(`ALTER TABLE "${name}" ADD COLUMN "${c[0]}" ${c[1]}`);
        log.push(`~ ${name}: добавлена колонка ${c[0]}`);
        updated++;
      }
    }
  }

  const data = collect(model);

  // Константы
  if (data.constants.length) {
    ensureTable('Константы', [['Имя', 'TEXT NOT NULL'], ['Значение', "TEXT DEFAULT ''"]], '"Имя"');
    for (const k of data.constants)
      db.run(`INSERT OR IGNORE INTO Константы(Имя, Значение) VALUES(${quoteStr(k.name)}, '')`);
  }

  // Справочники
  for (const c of data.catalogs) {
    const cols = [['Ссылка', 'TEXT NOT NULL'], ['Код', "TEXT DEFAULT ''"], ['Наименование', "TEXT DEFAULT ''"], ['ПометкаУдаления', 'INTEGER DEFAULT 0']];
    cols.push(...c.attrs.map(a => [a.name, sqlType(a.type)]));
    ensureTable(`Спр_${c.name}`, cols, '"Ссылка"');
    for (const t of c.tabulars) {
      const tc = [['Ссылка', 'TEXT NOT NULL'], ['НомерСтроки', 'INTEGER']];
      tc.push(...t.attrs.map(a => [a.name, sqlType(a.type)]));
      ensureTable(`Спр_${c.name}_${t.name}`, tc);
    }
  }

  // Документы
  for (const d of data.documents) {
    const cols = [['Ссылка', 'TEXT NOT NULL'], ['Номер', "TEXT DEFAULT ''"], ['Дата', "TEXT DEFAULT ''"], ['Проведен', 'INTEGER DEFAULT 0'], ['ПометкаУдаления', 'INTEGER DEFAULT 0']];
    cols.push(...d.attrs.map(a => [a.name, sqlType(a.type)]));
    ensureTable(`Док_${d.name}`, cols, '"Ссылка"');
    for (const t of d.tabulars) {
      const tc = [['Ссылка', 'TEXT NOT NULL'], ['НомерСтроки', 'INTEGER']];
      tc.push(...t.attrs.map(a => [a.name, sqlType(a.type)]));
      ensureTable(`Док_${d.name}_${t.name}`, tc);
    }
  }

  // Перечисления + значения
  for (const e of data.enums) {
    ensureTable(`Переч_${e.name}`, [['Имя', 'TEXT NOT NULL'], ['Синоним', "TEXT DEFAULT ''"], ['Порядок', 'INTEGER DEFAULT 0']], '"Имя"');
    e.values.forEach((v, i) =>
      db.run(`INSERT OR REPLACE INTO "Переч_${e.name}"(Имя, Синоним, Порядок) VALUES(${quoteStr(v.name)}, ${quoteStr(v.synonym)}, ${i})`));
  }

  // Регистры сведений
  for (const r of data.infoRegs) {
    const cols = [...r.dims, ...r.ress, ...r.attrs].map(a => [a.name, sqlType(a.type)]);
    const pk = r.dims.map(d => `"${d.name}"`).join(', ');
    ensureTable(`РегСвед_${r.name}`, cols, pk || null);
  }

  // Регистры накопления
  for (const r of data.accumRegs) {
    const cols = [['Регистратор', "TEXT DEFAULT ''"], ['Период', "TEXT DEFAULT ''"], ['ВидДвижения', "TEXT DEFAULT 'Приход'"]];
    cols.push(...[...r.dims, ...r.ress].map(a => [a.name, sqlType(a.type)]));
    ensureTable(`РегНакоп_${r.name}`, cols);
  }

  // Версия конфигурации
  ensureTable('_Конфигурация', [['Имя', 'TEXT'], ['Версия', 'TEXT'], ['ДатаПубликации', 'TEXT']]);
  db.run('DELETE FROM _Конфигурация');
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  db.run(`INSERT INTO _Конфигурация VALUES(${quoteStr(data.config.name)}, ${quoteStr(data.config.version)}, ${quoteStr(now)})`);

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

  const objects = [
    ...data.catalogs.map(c => ({ kind: 'Справочник', ...c })),
    ...data.documents.map(d => ({ kind: 'Документ', ...d }))
  ].sort((a, b) => (`${a.kind}.${a.name}` < `${b.kind}.${b.name}` ? -1 : 1));

  for (const o of objects) {
    const rec = `${o.kind}${o.name}Запись`;
    const mod = `Модуль${o.kind}${o.name}`;
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
    L.push('}');
    L.push('');
  }
  return L.join('\n');
}

module.exports = { publish, collect, generateCode };
