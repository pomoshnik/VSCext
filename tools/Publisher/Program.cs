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

// --- Константы: одна таблица ---
var константы = конфиг.ПоВиду("Константа").ToList();
if (константы.Count > 0)
{
    Таблица("Константы", new() { ("Имя", "TEXT NOT NULL"), ("Значение", "TEXT DEFAULT ''") }, "\"Имя\"");
    foreach (var к in константы)
    {
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
    колонки.AddRange(спр.Реквизиты.Select(р => (р.Имя, ТипSQL(р.Тип))));
    Таблица($"Спр_{спр.Имя}", колонки, "\"Ссылка\"");

    foreach (var тч in спр.ТабличныеЧасти)
    {
        var кТЧ = new List<(string, string)> { ("Ссылка", "TEXT NOT NULL"), ("НомерСтроки", "INTEGER") };
        кТЧ.AddRange(тч.Реквизиты.Select(р => (р.Имя, ТипSQL(р.Тип))));
        Таблица($"Спр_{спр.Имя}_{тч.Имя}", кТЧ);
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
    колонки.AddRange(док.Реквизиты.Select(р => (р.Имя, ТипSQL(р.Тип))));
    Таблица($"Док_{док.Имя}", колонки, "\"Ссылка\"");

    foreach (var тч in док.ТабличныеЧасти)
    {
        var кТЧ = new List<(string, string)> { ("Ссылка", "TEXT NOT NULL"), ("НомерСтроки", "INTEGER") };
        кТЧ.AddRange(тч.Реквизиты.Select(р => (р.Имя, ТипSQL(р.Тип))));
        Таблица($"Док_{док.Имя}_{тч.Имя}", кТЧ);
    }
}

// --- Перечисления: таблица со значениями ---
foreach (var переч in конфиг.ПоВиду("Перечисление"))
{
    Таблица($"Переч_{переч.Имя}",
        new() { ("Имя", "TEXT NOT NULL"), ("Синоним", "TEXT DEFAULT ''"), ("Порядок", "INTEGER DEFAULT 0") },
        "\"Имя\"");
    int порядок = 0;
    foreach (var значение in переч.Значения)
    {
        using var команда = соединение.CreateCommand();
        команда.CommandText = $"INSERT OR REPLACE INTO \"Переч_{переч.Имя}\"(Имя, Синоним, Порядок) VALUES(@и, @с, @п)";
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
    колонки.AddRange(рег.Измерения.Select(и => (и.Имя, ТипSQL(и.Тип))));
    колонки.AddRange(рег.Ресурсы.Select(р => (р.Имя, ТипSQL(р.Тип))));
    колонки.AddRange(рег.Реквизиты.Select(р => (р.Имя, ТипSQL(р.Тип))));
    var ключ = string.Join(", ", рег.Измерения.Select(и => $"\"{и.Имя}\""));
    Таблица($"РегСвед_{рег.Имя}", колонки, ключ.Length > 0 ? ключ : null);
}

// --- Регистры накопления ---
foreach (var рег in конфиг.ПоВиду("РегистрНакопления"))
{
    var колонки = new List<(string, string)>
    {
        ("Регистратор", "TEXT DEFAULT ''"), ("Период", "TEXT DEFAULT ''"), ("ВидДвижения", "TEXT DEFAULT 'Приход'")
    };
    колонки.AddRange(рег.Измерения.Select(и => (и.Имя, ТипSQL(и.Тип))));
    колонки.AddRange(рег.Ресурсы.Select(р => (р.Имя, ТипSQL(р.Тип))));
    Таблица($"РегНакоп_{рег.Имя}", колонки);
}

// --- Служебная таблица с версией конфигурации ---
Таблица("_Конфигурация", new() { ("Имя", "TEXT"), ("Версия", "TEXT"), ("ДатаПубликации", "TEXT") });
Выполнить("DELETE FROM _Конфигурация");
using (var команда = соединение.CreateCommand())
{
    команда.CommandText = "INSERT INTO _Конфигурация VALUES(@и, @в, @д)";
    команда.Parameters.AddWithValue("@и", конфиг.Имя);
    команда.Parameters.AddWithValue("@в", конфиг.Версия);
    команда.Parameters.AddWithValue("@д", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
    команда.ExecuteNonQuery();
}

// --- Демо-данные при первой публикации ---
using (var проверка = соединение.CreateCommand())
{
    проверка.CommandText = "SELECT COUNT(*) FROM Спр_Номенклатура";
    if (ТаблицаЕсть("Спр_Номенклатура") && Convert.ToInt64(проверка.ExecuteScalar()) == 0)
    {
        Выполнить(@"
INSERT INTO Спр_Номенклатура(Ссылка, Код, Наименование, Артикул, ЕдиницаИзмерения, СтавкаНДС, Цена) VALUES
('" + Guid.NewGuid() + @"', '000000001', 'Ноутбук Vector 15', 'NB-015', 'шт', 'НДС20', 74990),
('" + Guid.NewGuid() + @"', '000000002', 'Мышь беспроводная', 'MS-201', 'шт', 'НДС20', 1290),
('" + Guid.NewGuid() + @"', '000000003', 'Монитор 27""', 'MN-270', 'шт', 'НДС20', 21990)");
        Console.WriteLine("  * добавлены демо-данные в Спр_Номенклатура");
    }
}

Console.WriteLine($"Готово. Таблиц создано: {создано}, обновлено: {обновлено}.");
Console.WriteLine($"База данных: {Path.GetFullPath(файлБД)}");
