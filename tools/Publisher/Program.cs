// Публикатор: читает метаданные (JSON) и создаёт/обновляет базу SQLite.
// Аналог «Обновить конфигурацию базы данных (F7)» в Конфигураторе 1С.
//
// Использование: dotnet run --project tools/Publisher -- <каталог metadata> <файл.db>

using Microsoft.Data.Sqlite;
using OneC.Core;

var каталог = args.Length > 0 ? args[0] : "metadata";
var файлБД = args.Length > 1 ? args[1] : Path.Combine("data", "app.db");

Console.OutputEncoding = System.Text.Encoding.UTF8;
Console.WriteLine($"Публикация конфигурации: {каталог} -> {файлБД}");

var конфиг = ЗагрузчикМетаданных.Загрузить(каталог);
Console.WriteLine($"Конфигурация: {конфиг.Имя} ({конфиг.Синоним}), объектов: {конфиг.Объекты.Count}");

Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(файлБД))!);
using var соединение = new SqliteConnection($"Data Source={файлБД}");
соединение.Open();

int создано = 0, обновлено = 0;

void Выполнить(string sql)
{
    using var команда = соединение.CreateCommand();
    команда.CommandText = sql;
    команда.ExecuteNonQuery();
}

string Колонка(Реквизит р, string где) =>
    р.Колонка ?? throw new InvalidOperationException(
        $"У реквизита «{где}.{р.Имя}» не задано имя колонки. Откройте конфигурацию в конфигураторе (VS Code) и повторите публикацию.");

string ИмяТаблицыИлиОшибка(string? таблица, string вид, string имя) =>
    таблица ?? throw new InvalidOperationException(
        $"У объекта «{вид}.{имя}» не задано имя таблицы. Откройте конфигурацию в конфигураторе (VS Code) и повторите публикацию.");

string ТипSQL(string тип) => тип switch
{
    "Число" => "NUMERIC DEFAULT 0",
    "Булево" => "INTEGER DEFAULT 0",
    "Дата" => "TEXT DEFAULT ''",
    _ => "TEXT DEFAULT ''" // Строка и все ссылки (хранится GUID/имя значения)
};

HashSet<string> Колонки(string таблица)
{
    var результат = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    using var команда = соединение.CreateCommand();
    команда.CommandText = $"PRAGMA table_info(\"{таблица}\")";
    using var чтение = команда.ExecuteReader();
    while (чтение.Read()) результат.Add(чтение.GetString(1));
    return результат;
}

void Мигрировать(string устаревшее, string актуальное)
{
    if (устаревшее != актуальное && ТаблицаЕсть(устаревшее) && !ТаблицаЕсть(актуальное))
    {
        Выполнить($"ALTER TABLE \"{устаревшее}\" RENAME TO \"{актуальное}\"");
        Console.WriteLine($"  > {устаревшее} переименована в {актуальное}");
        обновлено++;
    }
}

bool ТаблицаЕсть(string таблица)
{
    using var команда = соединение.CreateCommand();
    команда.CommandText = "SELECT 1 FROM sqlite_master WHERE type='table' AND name=@n";
    команда.Parameters.AddWithValue("@n", таблица);
    return команда.ExecuteScalar() != null;
}

// Создать таблицу или добавить недостающие колонки (мягкое обновление схемы)
void Таблица(string имя, List<(string Имя, string Тип)> колонки, string? первичныйКлюч = null)
{
    if (!ТаблицаЕсть(имя))
    {
        var описания = колонки.Select(к => $"\"{к.Имя}\" {к.Тип}").ToList();
        if (первичныйКлюч != null) описания.Add($"PRIMARY KEY ({первичныйКлюч})");
        Выполнить($"CREATE TABLE \"{имя}\" ({string.Join(", ", описания)})");
        Console.WriteLine($"  + таблица {имя}");
        создано++;
    }
    else
    {
        var существующие = Колонки(имя);
        foreach (var к in колонки.Where(к => !существующие.Contains(к.Имя)))
        {
            Выполнить($"ALTER TABLE \"{имя}\" ADD COLUMN \"{к.Имя}\" {к.Тип}");
            Console.WriteLine($"  ~ {имя}: добавлена колонка {к.Имя}");
            обновлено++;
        }
    }
}

// Миграция колонок на стабильные имена fld_… (данные сохраняются):
// старые базы хранят колонки по имени реквизита или по одному из прежних имён
void ПереименоватьКолонки(string таблица, IEnumerable<Реквизит> реквизиты, string где)
{
    if (!ТаблицаЕсть(таблица)) return;
    var есть = Колонки(таблица);
    foreach (var р in реквизиты)
    {
        var целевая = Колонка(р, где);
        if (есть.Contains(целевая)) continue;
        var кандидаты = new[] { р.Имя }.Concat(Enumerable.Reverse(р.ПрежниеИмена ?? new List<string>()));
        var старое = кандидаты.FirstOrDefault(к => есть.Contains(к));
        if (старое == null) continue;
        Выполнить($"ALTER TABLE \"{таблица}\" RENAME COLUMN \"{старое}\" TO \"{целевая}\"");
        Console.WriteLine($"  ~ {таблица}: колонка {старое} переименована в {целевая} (данные сохранены)");
        обновлено++;
        есть.Remove(старое);
        есть.Add(целевая);
    }
}

// --- Константы: одна таблица ---
var константы = конфиг.ПоВиду("Константа").ToList();
if (константы.Count > 0)
{
    Таблица("Константы", new() { ("Имя", "TEXT NOT NULL"), ("Значение", "TEXT DEFAULT ''") }, "\"Имя\"");
    foreach (var к in константы)
    {
        // переименование константы: перенести строку со значением
        foreach (var старое in Enumerable.Reverse(к.ПрежниеИмена ?? new List<string>()))
        {
            using var перенос = соединение.CreateCommand();
            перенос.CommandText = "UPDATE Константы SET Имя=@н WHERE Имя=@с AND NOT EXISTS(SELECT 1 FROM Константы WHERE Имя=@н)";
            перенос.Parameters.AddWithValue("@н", к.Имя);
            перенос.Parameters.AddWithValue("@с", старое);
            перенос.ExecuteNonQuery();
        }
        using var команда = соединение.CreateCommand();
        команда.CommandText = "INSERT OR IGNORE INTO Константы(Имя, Значение) VALUES(@и, '')";
        команда.Parameters.AddWithValue("@и", к.Имя);
        команда.ExecuteNonQuery();
    }
}

// --- Справочники ---
foreach (var спр in конфиг.ПоВиду("Справочник"))
{
    var колонки = new List<(string, string)>
    {
        ("Ссылка", "TEXT NOT NULL"), ("Код", "TEXT DEFAULT ''"),
        ("Наименование", "TEXT DEFAULT ''"), ("ПометкаУдаления", "INTEGER DEFAULT 0")
    };
    колонки.AddRange(спр.Реквизиты.Select(р => (Колонка(р, спр.Имя), ТипSQL(р.Тип))));
    var тСпр = ИмяТаблицыИлиОшибка(спр.Таблица, "Справочник", спр.Имя);
    Мигрировать($"Спр_{спр.Имя}", тСпр); // старое имя — только для миграции баз до v0.5.0
    ПереименоватьКолонки(тСпр, спр.Реквизиты, спр.Имя);
    Таблица(тСпр, колонки, "\"Ссылка\"");

    foreach (var тч in спр.ТабличныеЧасти)
    {
        var кТЧ = new List<(string, string)> { ("Ссылка", "TEXT NOT NULL"), ("НомерСтроки", "INTEGER") };
        кТЧ.AddRange(тч.Реквизиты.Select(р => (Колонка(р, $"{спр.Имя}.{тч.Имя}"), ТипSQL(р.Тип))));
        var тТч = ИмяТаблицыИлиОшибка(тч.Таблица, "ТабличнаяЧасть", $"{спр.Имя}.{тч.Имя}");
        Мигрировать($"Спр_{спр.Имя}_{тч.Имя}", тТч);
        ПереименоватьКолонки(тТч, тч.Реквизиты, $"{спр.Имя}.{тч.Имя}");
        Таблица(тТч, кТЧ);
    }
}

// --- Документы ---
foreach (var док in конфиг.ПоВиду("Документ"))
{
    var колонки = new List<(string, string)>
    {
        ("Ссылка", "TEXT NOT NULL"), ("Номер", "TEXT DEFAULT ''"),
        ("Дата", "TEXT DEFAULT ''"), ("Проведен", "INTEGER DEFAULT 0"),
        ("ПометкаУдаления", "INTEGER DEFAULT 0")
    };
    колонки.AddRange(док.Реквизиты.Select(р => (Колонка(р, док.Имя), ТипSQL(р.Тип))));
    var тДок = ИмяТаблицыИлиОшибка(док.Таблица, "Документ", док.Имя);
    Мигрировать($"Док_{док.Имя}", тДок);
    ПереименоватьКолонки(тДок, док.Реквизиты, док.Имя);
    Таблица(тДок, колонки, "\"Ссылка\"");

    foreach (var тч in док.ТабличныеЧасти)
    {
        var кТЧ = new List<(string, string)> { ("Ссылка", "TEXT NOT NULL"), ("НомерСтроки", "INTEGER") };
        кТЧ.AddRange(тч.Реквизиты.Select(р => (Колонка(р, $"{док.Имя}.{тч.Имя}"), ТипSQL(р.Тип))));
        var тТч = ИмяТаблицыИлиОшибка(тч.Таблица, "ТабличнаяЧасть", $"{док.Имя}.{тч.Имя}");
        Мигрировать($"Док_{док.Имя}_{тч.Имя}", тТч);
        ПереименоватьКолонки(тТч, тч.Реквизиты, $"{док.Имя}.{тч.Имя}");
        Таблица(тТч, кТЧ);
    }
}

// --- Перечисления: таблица со значениями ---
var переименованияЗначений = new List<(string Перечисление, string Старое, string Новое)>();
foreach (var переч in конфиг.ПоВиду("Перечисление"))
{
    var тПереч = ИмяТаблицыИлиОшибка(переч.Таблица, "Перечисление", переч.Имя);
    Мигрировать($"Переч_{переч.Имя}", тПереч);
    Таблица(тПереч,
        new() { ("Имя", "TEXT NOT NULL"), ("Синоним", "TEXT DEFAULT ''"), ("Порядок", "INTEGER DEFAULT 0") },
        "\"Имя\"");
    int порядок = 0;
    foreach (var значение in переч.Значения)
    {
        // значение переименовано: перенести строку и запомнить для обновления данных
        foreach (var старое in Enumerable.Reverse(значение.ПрежниеИмена ?? new List<string>()))
        {
            using var перенос = соединение.CreateCommand();
            перенос.CommandText = $"UPDATE \"{тПереч}\" SET Имя=@н WHERE Имя=@с AND NOT EXISTS(SELECT 1 FROM \"{тПереч}\" WHERE Имя=@н)";
            перенос.Parameters.AddWithValue("@н", значение.Имя);
            перенос.Parameters.AddWithValue("@с", старое);
            перенос.ExecuteNonQuery();
            переименованияЗначений.Add((переч.Имя, старое, значение.Имя));
        }
        using var команда = соединение.CreateCommand();
        команда.CommandText = $"INSERT OR REPLACE INTO \"{тПереч}\"(Имя, Синоним, Порядок) VALUES(@и, @с, @п)";
        команда.Parameters.AddWithValue("@и", значение.Имя);
        команда.Parameters.AddWithValue("@с", string.IsNullOrEmpty(значение.Синоним) ? значение.Имя : значение.Синоним);
        команда.Parameters.AddWithValue("@п", порядок++);
        команда.ExecuteNonQuery();
    }
}

// --- Регистры сведений ---
foreach (var рег in конфиг.ПоВиду("РегистрСведений"))
{
    var колонки = new List<(string, string)>();
    колонки.AddRange(рег.Измерения.Select(и => (Колонка(и, рег.Имя), ТипSQL(и.Тип))));
    колонки.AddRange(рег.Ресурсы.Select(р => (Колонка(р, рег.Имя), ТипSQL(р.Тип))));
    колонки.AddRange(рег.Реквизиты.Select(р => (Колонка(р, рег.Имя), ТипSQL(р.Тип))));
    var ключ = string.Join(", ", рег.Измерения.Select(и => $"\"{Колонка(и, рег.Имя)}\""));
    var тРег = ИмяТаблицыИлиОшибка(рег.Таблица, "РегистрСведений", рег.Имя);
    Мигрировать($"РегСвед_{рег.Имя}", тРег);
    ПереименоватьКолонки(тРег, рег.Измерения.Concat(рег.Ресурсы).Concat(рег.Реквизиты), рег.Имя);
    Таблица(тРег, колонки, ключ.Length > 0 ? ключ : null);
}

// --- Регистры накопления ---
foreach (var рег in конфиг.ПоВиду("РегистрНакопления"))
{
    var колонки = new List<(string, string)>
    {
        ("Регистратор", "TEXT DEFAULT ''"), ("Период", "TEXT DEFAULT ''"), ("ВидДвижения", "TEXT DEFAULT 'Приход'")
    };
    колонки.AddRange(рег.Измерения.Select(и => (Колонка(и, рег.Имя), ТипSQL(и.Тип))));
    колонки.AddRange(рег.Ресурсы.Select(р => (Колонка(р, рег.Имя), ТипSQL(р.Тип))));
    var тНакоп = ИмяТаблицыИлиОшибка(рег.Таблица, "РегистрНакопления", рег.Имя);
    Мигрировать($"РегНакоп_{рег.Имя}", тНакоп);
    ПереименоватьКолонки(тНакоп, рег.Измерения.Concat(рег.Ресурсы), рег.Имя);
    Таблица(тНакоп, колонки);
}

// --- Ссылки на переименованные значения перечислений в данных (хранятся по имени значения) ---
if (переименованияЗначений.Count > 0)
{
    var колонкиСсылок = new List<(string Таблица, string Колонка, string Тип)>();
    foreach (var о in конфиг.Объекты)
    {
        if (о.Таблица != null)
            foreach (var р in о.Реквизиты.Concat(о.Измерения).Concat(о.Ресурсы))
                колонкиСсылок.Add((о.Таблица, р.Колонка ?? р.Имя, р.Тип));
        foreach (var тч in о.ТабличныеЧасти.Where(т => т.Таблица != null))
            foreach (var р in тч.Реквизиты)
                колонкиСсылок.Add((тч.Таблица!, р.Колонка ?? р.Имя, р.Тип));
    }
    foreach (var (переч, старое, новое) in переименованияЗначений)
        foreach (var (табл, кол, тип) in колонкиСсылок.Where(к => к.Тип == $"ПеречислениеСсылка.{переч}"))
        {
            using var команда = соединение.CreateCommand();
            команда.CommandText = $"UPDATE \"{табл}\" SET \"{кол}\"=@н WHERE \"{кол}\"=@с";
            команда.Parameters.AddWithValue("@н", новое);
            команда.Parameters.AddWithValue("@с", старое);
            var число = команда.ExecuteNonQuery();
            if (число > 0) Console.WriteLine($"  ~ {табл}.{кол}: значение {старое} -> {новое} ({число} зап.)");
        }
}

// --- Служебная таблица с версией конфигурации ---
Таблица("_Конфигурация", new() { ("Имя", "TEXT"), ("Версия", "TEXT"), ("ДатаПубликации", "TEXT"), ("Метаданные", "TEXT") });
Выполнить("DELETE FROM _Конфигурация");
using (var команда = соединение.CreateCommand())
{
    // полный снимок метаданных — клиент может работать без каталога metadata/
    команда.CommandText = "INSERT INTO _Конфигурация (Имя, Версия, ДатаПубликации, Метаданные) VALUES(@и, @в, @д, @м)";
    команда.Parameters.AddWithValue("@и", конфиг.Имя);
    команда.Parameters.AddWithValue("@в", конфиг.Версия);
    команда.Parameters.AddWithValue("@д", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
    команда.Parameters.AddWithValue("@м", ЗагрузчикМетаданных.ВСнимок(конфиг));
    команда.ExecuteNonQuery();
}

// --- Демо-данные при первой публикации ---
var номенклатура = конфиг.Найти("Справочник.Номенклатура");
var тНомен = номенклатура?.Таблица ?? "";
using (var проверка = соединение.CreateCommand())
{
    проверка.CommandText = $"SELECT COUNT(*) FROM \"{тНомен}\"";
    if (тНомен != "" && ТаблицаЕсть(тНомен) && Convert.ToInt64(проверка.ExecuteScalar()) == 0)
    {
        // колонки реквизитов — стабильные (fld_…), берём их из метаданных
        string К(string имя) => номенклатура!.Реквизиты.First(р => р.Имя == имя).Колонка ?? имя;
        Выполнить($@"
INSERT INTO ""{тНомен}""(Ссылка, Код, Наименование, ""{К("Артикул")}"", ""{К("ЕдиницаИзмерения")}"", ""{К("СтавкаНДС")}"", ""{К("Цена")}"") VALUES
('" + Guid.NewGuid() + @"', '000000001', 'Ноутбук Vector 15', 'NB-015', 'шт', 'НДС20', 74990),
('" + Guid.NewGuid() + @"', '000000002', 'Мышь беспроводная', 'MS-201', 'шт', 'НДС20', 1290),
('" + Guid.NewGuid() + @"', '000000003', 'Монитор 27""', 'MN-270', 'шт', 'НДС20', 21990)");
        Console.WriteLine($"  * добавлены демо-данные в {тНомен}");
    }
}

Console.WriteLine($"Готово. Таблиц создано: {создано}, обновлено: {обновлено}.");
Console.WriteLine($"База данных: {Path.GetFullPath(файлБД)}");

// ---------------------------------------------------------------------------
// Генерация типизированного кода для бизнес-логики (автодополнение в C#)
// ---------------------------------------------------------------------------

var каталогЛогики = Path.GetFullPath(Path.Combine(каталог, "..", "src", "BusinessLogic"));
if (args.Length > 2) каталогЛогики = Path.GetFullPath(args[2]);

if (Directory.Exists(каталогЛогики))
{
    var файлКода = Path.Combine(каталогЛогики, "Generated", "Метаданные.g.cs");
    Directory.CreateDirectory(Path.GetDirectoryName(файлКода)!);
    File.WriteAllText(файлКода, ГенераторКода.Сгенерировать(конфиг));
    Console.WriteLine($"Код метаданных: {файлКода}");
}

static class ГенераторКода
{
    static string ТипCs(string тип) => тип switch
    {
        "Число" => "decimal",
        "Булево" => "bool",
        _ => "string" // Строка, Дата, ссылки
    };

    static void Свойство(System.Text.StringBuilder к, string имя, string тип)
    {
        var cs = ТипCs(тип);
        var геттер = cs switch
        {
            "decimal" => $"Запись.Число(\"{имя}\")",
            "bool" => $"Запись.Строка(\"{имя}\") is \"1\" or \"True\" or \"true\"",
            _ => $"Запись.Строка(\"{имя}\")"
        };
        var сеттер = cs == "bool" ? $"Запись[\"{имя}\"] = value ? 1 : 0" : $"Запись[\"{имя}\"] = value";
        к.AppendLine($"    public {cs} {имя} {{ get => {геттер}; set => {сеттер}; }}");
    }

    public static string Сгенерировать(OneC.Core.Конфигурация конфиг)
    {
        var к = new System.Text.StringBuilder();
        к.AppendLine("// <auto-generated>");
        к.AppendLine("// Сгенерировано публикатором из metadata/*.json — не редактируйте вручную.");
        к.AppendLine("// Перегенерация: dotnet run --project tools/Publisher -- metadata data/app.db");
        к.AppendLine("// </auto-generated>");
        к.AppendLine("#nullable enable");
        к.AppendLine("using OneC.Core;");
        к.AppendLine();
        к.AppendLine("namespace BusinessLogic;");
        к.AppendLine();

        // --- Перечисления: Перечисления.СтавкиНДС.НДС20 ---
        var перечисления = конфиг.ПоВиду("Перечисление").ToList();
        к.AppendLine("public static class Перечисления");
        к.AppendLine("{");
        foreach (var п in перечисления)
        {
            к.AppendLine($"    /// <summary>{п.Представление}</summary>");
            к.AppendLine($"    public static class {п.Имя}");
            к.AppendLine("    {");
            foreach (var з in п.Значения)
                к.AppendLine($"        /// <summary>{з.Синоним}</summary>\n        public const string {з.Имя} = \"{з.Имя}\";");
            к.AppendLine("    }");
        }
        к.AppendLine("}");
        к.AppendLine();

        // --- Типизированные записи и базовые модули ---
        foreach (var о in конфиг.Объекты.Where(о => о.Вид is "Справочник" or "Документ").OrderBy(о => о.ПолноеИмя))
        {
            var имяЗаписи = $"{о.Вид}{о.Имя}Запись";
            var имяМодуля = $"Модуль{о.Вид}{о.Имя}";

            к.AppendLine($"/// <summary>Типизированная запись: {о.ПолноеИмя}</summary>");
            к.AppendLine($"public class {имяЗаписи}");
            к.AppendLine("{");
            к.AppendLine("    public ЗаписьОбъекта Запись { get; }");
            к.AppendLine($"    public {имяЗаписи}(ЗаписьОбъекта запись) => Запись = запись;");
            к.AppendLine("    public string? Ссылка => Запись.Ссылка;");
            к.AppendLine("    public bool ЭтоНовый => Запись.ЭтоНовый;");
            if (о.Вид == "Справочник")
            {
                Свойство(к, "Код", "Строка");
                Свойство(к, "Наименование", "Строка");
            }
            else
            {
                Свойство(к, "Номер", "Строка");
                Свойство(к, "Дата", "Дата");
            }
            foreach (var р in о.Реквизиты)
                Свойство(к, р.Имя, р.Тип);
            к.AppendLine("}");
            к.AppendLine();

            к.AppendLine($"/// <summary>Базовый модуль с типизированными обработчиками: {о.ПолноеИмя}</summary>");
            к.AppendLine($"public abstract class {имяМодуля} : МодульОбъекта");
            к.AppendLine("{");
            к.AppendLine($"    public sealed override void ПередЗаписью(ЗаписьОбъекта запись, Отказ отказ) => ПередЗаписью(new {имяЗаписи}(запись), отказ);");
            к.AppendLine($"    public virtual void ПередЗаписью({имяЗаписи} запись, Отказ отказ) {{ }}");
            к.AppendLine($"    public sealed override void ПриЗаписи(ЗаписьОбъекта запись) => ПриЗаписи(new {имяЗаписи}(запись));");
            к.AppendLine($"    public virtual void ПриЗаписи({имяЗаписи} запись) {{ }}");
            к.AppendLine($"    public sealed override void ПриЗаполнении(ЗаписьОбъекта запись) => ПриЗаполнении(new {имяЗаписи}(запись));");
            к.AppendLine($"    public virtual void ПриЗаполнении({имяЗаписи} запись) {{ }}");
            к.AppendLine("}");
            к.AppendLine();
        }
        return к.ToString();
    }
}
