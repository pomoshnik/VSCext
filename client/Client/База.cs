using Microsoft.Data.Sqlite;
using OneC.Core;

namespace Client;

/// <summary>Доступ к опубликованной базе SQLite.</summary>
public class База : IDisposable, IИсточникЗапросов
{
    readonly SqliteConnection _соединение;
    readonly Конфигурация _конфиг;

    // Маппинг «имя реквизита <-> стабильная колонка fld_…» по таблицам.
    // Весь клиент и бизнес-логика работают с ИМЕНАМИ; колонки видит только этот слой
    // (как в 1С: _Fld123 существует только на уровне СУБД).
    readonly Dictionary<string, Dictionary<string, string>> _вКолонку = new(StringComparer.OrdinalIgnoreCase);
    readonly Dictionary<string, Dictionary<string, string>> _изКолонки = new(StringComparer.OrdinalIgnoreCase);

    void ДобавитьМаппинг(string? таблица, IEnumerable<Реквизит> реквизиты)
    {
        if (таблица == null) return;
        var прямой = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var обратный = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var р in реквизиты)
        {
            var колонка = р.Колонка ?? р.Имя; // старые метаданные без колонок — работаем по именам
            прямой[р.Имя] = колонка;
            обратный[колонка] = р.Имя;
        }
        _вКолонку[таблица] = прямой;
        _изКолонки[таблица] = обратный;
    }

    string ВКолонку(string таблица, string имя) =>
        _вКолонку.TryGetValue(таблица, out var м) && м.TryGetValue(имя, out var к) ? к : имя;

    string ИзКолонки(string таблица, string колонка) =>
        _изКолонки.TryGetValue(таблица, out var м) && м.TryGetValue(колонка, out var и) ? и : колонка;

    public База(string файл, Конфигурация конфиг)
    {
        _конфиг = конфиг;
        foreach (var о in конфиг.Объекты)
        {
            ДобавитьМаппинг(о.Таблица, о.Реквизиты.Concat(о.Измерения).Concat(о.Ресурсы));
            foreach (var тч in о.ТабличныеЧасти)
                ДобавитьМаппинг(тч.Таблица, тч.Реквизиты);
        }
        // каталог может отсутствовать (data/*.db не хранится в git) — создаём,
        // иначе SQLite падает с «Error 14: unable to open database file»
        var каталог = Path.GetDirectoryName(Path.GetFullPath(файл));
        if (!string.IsNullOrEmpty(каталог)) Directory.CreateDirectory(каталог);
        _соединение = new SqliteConnection($"Data Source={файл}");
        _соединение.Open();

        // Запросы из модулей бизнес-логики (Запрос.Из(...)) идут через эту базу
        Запрос.Источник = this;

        // SQLite LIKE не знает кириллицу — своя функция для регистронезависимого «Подобно»
        _соединение.CreateFunction("внижнем", (string? т) => т?.ToLowerInvariant());

        // Конфигурация (модули C#) компилируется при публикации и хранится в самой базе
        ЗагрузитьКонфигурацию(файл);
    }

    /// <summary>Снимок метаданных из опубликованной базы (или null, если база не публиковалась).</summary>
    public static string? СнимокМетаданных(string файлБД)
    {
        if (!File.Exists(файлБД)) return null;
        try
        {
            using var соединение = new SqliteConnection($"Data Source={файлБД};Mode=ReadOnly");
            соединение.Open();
            using var к = соединение.CreateCommand();
            к.CommandText = "SELECT Метаданные FROM _Конфигурация LIMIT 1";
            var результат = к.ExecuteScalar();
            return результат is string json && json.Length > 0 ? json : null;
        }
        catch { return null; } // нет таблицы/колонки — база старой публикации
    }

    /// <summary>Стабильное имя таблицы из метаданных (cat_/doc_/enm_/inf_/acc_/vt_).</summary>
    public static string ИмяТаблицы(ОбъектМетаданных о) =>
        о.Таблица ?? throw new InvalidOperationException(
            $"У объекта «{о.Вид}.{о.Имя}» не задано имя таблицы. " +
            "Откройте конфигурацию в конфигураторе (VS Code) — имена таблиц будут присвоены автоматически — и выполните публикацию.");

    public bool ТаблицаЕсть(string таблица)
    {
        using var к = _соединение.CreateCommand();
        к.CommandText = "SELECT 1 FROM sqlite_master WHERE type='table' AND name=@n";
        к.Parameters.AddWithValue("@n", таблица);
        return к.ExecuteScalar() != null;
    }

    public List<Dictionary<string, object?>> Выбрать(string таблица, string? порядок = null)
    {
        var строки = new List<Dictionary<string, object?>>();
        if (!ТаблицаЕсть(таблица)) return строки;
        using var к = _соединение.CreateCommand();
        к.CommandText = $"SELECT * FROM \"{таблица}\"" + (порядок != null ? $" ORDER BY \"{ВКолонку(таблица, порядок)}\"" : "");
        using var ч = к.ExecuteReader();
        while (ч.Read())
        {
            var строка = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i < ч.FieldCount; i++)
                строка[ИзКолонки(таблица, ч.GetName(i))] = ч.IsDBNull(i) ? null : ч.GetValue(i);
            строки.Add(строка);
        }
        return строки;
    }

    /// <summary>Пары (Ссылка, Представление) для выбора ссылочных значений.</summary>
    public List<(string Ссылка, string Представление)> СписокВыбора(string тип)
    {
        var части = тип.Split('.');
        if (части.Length != 2) return new();
        var (вид, колонка) = части[0] switch
        {
            "СправочникСсылка" => ("Справочник", "Наименование"),
            "ДокументСсылка" => ("Документ", "Номер"),
            "ПеречислениеСсылка" => ("Перечисление", "Синоним"),
            _ => ("", "")
        };
        if (вид == "") return new();
        var объект = _конфиг.Найти($"{вид}.{части[1]}");
        var таблица = объект != null ? ИмяТаблицы(объект) : "";
        if (таблица == "" || !ТаблицаЕсть(таблица)) return new();

        var ключ = части[0] == "ПеречислениеСсылка" ? "Имя" : "Ссылка";
        var результат = new List<(string, string)>();
        using var к = _соединение.CreateCommand();
        к.CommandText = $"SELECT \"{ключ}\", \"{колонка}\" FROM \"{таблица}\" ORDER BY \"{колонка}\"";
        using var ч = к.ExecuteReader();
        while (ч.Read())
            результат.Add((ч.GetString(0), ч.IsDBNull(1) ? "" : ч.GetString(1)));
        return результат;
    }

    public string Представление(string тип, string? значение)
    {
        if (string.IsNullOrEmpty(значение)) return "";
        var найдено = СписокВыбора(тип).FirstOrDefault(п => п.Ссылка == значение);
        return найдено.Представление ?? значение;
    }

    /// <summary>Строки таблицы по значению ключа (например, строки ТЧ по Ссылке владельца).</summary>
    public List<Dictionary<string, object?>> Строки(string таблица, string ключ, string значение, string? порядок = null)
    {
        var строки = new List<Dictionary<string, object?>>();
        if (!ТаблицаЕсть(таблица)) return строки;
        using var к = _соединение.CreateCommand();
        к.CommandText = $"SELECT * FROM \"{таблица}\" WHERE \"{ВКолонку(таблица, ключ)}\" = @v" + (порядок != null ? $" ORDER BY \"{ВКолонку(таблица, порядок)}\"" : "");
        к.Parameters.AddWithValue("@v", значение);
        using var ч = к.ExecuteReader();
        while (ч.Read())
        {
            var строка = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i < ч.FieldCount; i++)
                строка[ИзКолонки(таблица, ч.GetName(i))] = ч.IsDBNull(i) ? null : ч.GetValue(i);
            строки.Add(строка);
        }
        return строки;
    }

    /// <summary>Полностью перезаписывает строки ТЧ владельца (DELETE + INSERT в транзакции).</summary>
    public void ЗаписатьСтроки(string таблица, string ссылка, List<Dictionary<string, object?>> строки)
    {
        if (!ТаблицаЕсть(таблица)) return;
        using var транзакция = _соединение.BeginTransaction();
        using (var к = _соединение.CreateCommand())
        {
            к.Transaction = транзакция;
            к.CommandText = $"DELETE FROM \"{таблица}\" WHERE \"Ссылка\" = @v";
            к.Parameters.AddWithValue("@v", ссылка);
            к.ExecuteNonQuery();
        }
        foreach (var строка in строки)
        {
            var имена = строка.Keys.ToList();
            using var к = _соединение.CreateCommand();
            к.Transaction = транзакция;
            var колонки = string.Join(", ", имена.Select(и => $"\"{ВКолонку(таблица, и)}\""));
            var параметры = string.Join(", ", имена.Select((_, i) => $"@p{i}"));
            к.CommandText = $"INSERT INTO \"{таблица}\" ({колонки}) VALUES ({параметры})";
            for (int i = 0; i < имена.Count; i++)
                к.Parameters.AddWithValue($"@p{i}", строка[имена[i]] ?? "");
            к.ExecuteNonQuery();
        }
        транзакция.Commit();
    }

    public void Записать(string таблица, Dictionary<string, object?> поля, string ключ = "Ссылка")
    {
        var имена = поля.Keys.ToList();
        using var к = _соединение.CreateCommand();
        var колонки = string.Join(", ", имена.Select(и => $"\"{ВКолонку(таблица, и)}\""));
        var параметры = string.Join(", ", имена.Select((_, i) => $"@p{i}"));
        к.CommandText = $"INSERT OR REPLACE INTO \"{таблица}\" ({колонки}) VALUES ({параметры})";
        for (int i = 0; i < имена.Count; i++)
            к.Parameters.AddWithValue($"@p{i}", поля[имена[i]] ?? "");
        к.ExecuteNonQuery();
    }

    public void Удалить(string таблица, string ключ, string значение)
    {
        using var к = _соединение.CreateCommand();
        к.CommandText = $"DELETE FROM \"{таблица}\" WHERE \"{ВКолонку(таблица, ключ)}\" = @v";
        к.Parameters.AddWithValue("@v", значение);
        к.ExecuteNonQuery();
    }

    public long Количество(string таблица)
    {
        if (!ТаблицаЕсть(таблица)) return 0;
        using var к = _соединение.CreateCommand();
        к.CommandText = $"SELECT COUNT(*) FROM \"{таблица}\"";
        return Convert.ToInt64(к.ExecuteScalar());
    }

    // --- Скомпилированная конфигурация из базы (_Сборки) --------------------

    /// <summary>Корень проекта (устанавливается при запуске из папки проекта — F5 из конфигуратора).</summary>
    public static string? КореньПроекта { get; set; }

    static readonly HashSet<string> _загруженныеСборки = new();

    void ЗагрузитьКонфигурацию(string файл)
    {
        // Режим отладки (F5 из папки проекта): конфигурация в базе могла быть
        // скомпилирована из ДРУГОЙ копии исходников — тогда пути и контрольные суммы
        // в её PDB не совпадут с файлами на этой машине и точки останова не сработают.
        // Поэтому под отладчиком грузим свежесобранную BusinessLogic.dll с диска
        // (preLaunchTask собирает её перед запуском) — точки совпадают всегда.
        if (System.Diagnostics.Debugger.IsAttached && КореньПроекта is { } корень)
        {
            var бин = Path.Combine(корень, "src", "BusinessLogic", "bin", "Debug");
            var файлDll = Directory.Exists(бин)
                ? Directory.GetFiles(бин, "BusinessLogic.dll", SearchOption.AllDirectories)
                    .OrderByDescending(File.GetLastWriteTimeUtc).FirstOrDefault()
                : null;
            if (файлDll != null)
            {
                lock (_загруженныеСборки)
                {
                    var ключДиск = "диск|" + файлDll;
                    if (_загруженныеСборки.Contains(ключДиск)) return;
                    var контекстДиск = new System.Runtime.Loader.AssemblyLoadContext("Конфигурация (отладка): " + файлDll);
                    РеестрМодулей.Подключить(контекстДиск.LoadFromAssemblyPath(файлDll));
                    _загруженныеСборки.Add(ключДиск);
                }
                Console.WriteLine($"[Конфигурация] ОТЛАДКА: сборка загружена с диска — {файлDll}");
                Console.WriteLine("[Конфигурация] Точки останова ставьте в src/BusinessLogic/Modules этой папки.");
                return;
            }
            Console.WriteLine($"[Конфигурация] ОТЛАДКА: {бин} не найден — сборка будет загружена из базы; " +
                              "если точки останова не сработают, опубликуйте конфигурацию из этой папки.");
        }
        byte[]? dll = null, pdb = null;
        try
        {
            using var команда = _соединение.CreateCommand();
            команда.CommandText = "SELECT Имя, Данные FROM _Сборки";
            using var чтение = команда.ExecuteReader();
            while (чтение.Read())
            {
                var имя = чтение.GetString(0);
                if (имя == "BusinessLogic.dll") dll = (byte[])чтение[1];
                else if (имя == "BusinessLogic.pdb") pdb = (byte[])чтение[1];
            }
        }
        catch (SqliteException) { /* таблицы нет — обработаем ниже */ }

        if (dll == null)
            throw new InvalidOperationException(
                "В базе нет скомпилированной конфигурации (таблица _Сборки).\n" +
                "Опубликуйте конфигурацию заново из конфигуратора (VS Code).");

        lock (_загруженныеСборки)
        {
            var ключ = Path.GetFullPath(файл) + "|" + dll.Length;
            if (_загруженныеСборки.Contains(ключ)) return;   // уже загружена для этой базы

            var контекст = new System.Runtime.Loader.AssemblyLoadContext("Конфигурация: " + файл);
            using var потокDll = new MemoryStream(dll);
            var сборка = pdb == null
                ? контекст.LoadFromStream(потокDll)
                : контекст.LoadFromStream(потокDll, new MemoryStream(pdb));
            РеестрМодулей.Подключить(сборка);   // OneC.Core разрешается в копию клиента (общая статика)
            _загруженныеСборки.Add(ключ);
            Console.WriteLine($"[Конфигурация] Сборка загружена из базы (_Сборки): {dll.Length / 1024} КБ" +
                              (pdb != null ? " + символы" : ", БЕЗ символов"));
        }
    }

    // --- Запросы с отбором и сортировкой (IИсточникЗапросов) ----------------

    static readonly Dictionary<string, string> _операторы = new(StringComparer.OrdinalIgnoreCase)
    {
        ["="] = "=", ["<>"] = "<>", [">"] = ">", [">="] = ">=", ["<"] = "<", ["<="] = "<=",
        ["Подобно"] = "LIKE", ["LIKE"] = "LIKE"
    };

    public List<ЗаписьОбъекта> Выполнить(Запрос запрос)
    {
        var объект = _конфиг.Найти(запрос.ПолноеИмя)
            ?? throw new InvalidOperationException($"Объект «{запрос.ПолноеИмя}» не найден в конфигурации.");
        var таблица = ИмяТаблицы(объект);
        var результат = new List<ЗаписьОбъекта>();
        if (!ТаблицаЕсть(таблица)) return результат;

        var sql = new System.Text.StringBuilder($"SELECT * FROM \"{таблица}\"");
        var параметры = new List<object?>();
        if (запрос.Отборы.Count > 0)
        {
            var условия = new List<string>();
            foreach (var (поле, оператор, значение) in запрос.Отборы)
            {
                if (!_операторы.TryGetValue(оператор, out var op))
                    throw new ArgumentException($"Неизвестный оператор отбора «{оператор}». Допустимо: =, <>, >, >=, <, <=, Подобно.");
                // «Подобно» — без учёта регистра (включая кириллицу), как в 1С
                условия.Add(op == "LIKE"
                    ? $"внижнем(\"{ВКолонку(таблица, поле)}\") LIKE внижнем(@p{параметры.Count})"
                    : $"\"{ВКолонку(таблица, поле)}\" {op} @p{параметры.Count}");
                параметры.Add(значение);
            }
            sql.Append(" WHERE ").Append(string.Join(" AND ", условия));
        }
        if (запрос.Сортировки.Count > 0)
            sql.Append(" ORDER BY ").Append(string.Join(", ",
                запрос.Сортировки.Select(с => $"\"{ВКолонку(таблица, с.Поле)}\"" + (с.Убывание ? " DESC" : ""))));
        if (запрос.КоличествоПервых is int н)
            sql.Append(" LIMIT ").Append(н);

        using (var к = _соединение.CreateCommand())
        {
            к.CommandText = sql.ToString();
            for (int i = 0; i < параметры.Count; i++)
                к.Parameters.AddWithValue($"@p{i}", параметры[i] ?? "");
            using var ч = к.ExecuteReader();
            while (ч.Read())
            {
                var запись = new ЗаписьОбъекта { ПолноеИмяОбъекта = запрос.ПолноеИмя };
                for (int i = 0; i < ч.FieldCount; i++)
                    запись[ИзКолонки(таблица, ч.GetName(i))] = ч.IsDBNull(i) ? null : ч.GetValue(i);
                запись.Ссылка = запись["Ссылка"]?.ToString();
                результат.Add(запись);
            }
        }

        if (запрос.ЗагружатьТабличныеЧасти)
            foreach (var запись in результат.Where(з => !string.IsNullOrEmpty(з.Ссылка)))
                foreach (var тч in объект.ТабличныеЧасти.Where(т => т.Таблица != null))
                    запись.ТабличныеЧасти[тч.Имя] = Строки(тч.Таблица!, "Ссылка", запись.Ссылка!, "НомерСтроки");

        return результат;
    }

    // --- Движения по регистрам накопления -----------------------------------

    /// <summary>Удаляет движения документа из всех регистров накопления (отмена проведения, удаление).</summary>
    public void УдалитьДвижения(string регистратор)
    {
        foreach (var регистр in _конфиг.ПоВиду("РегистрНакопления"))
        {
            var таблица = регистр.Таблица;
            if (таблица == null || !ТаблицаЕсть(таблица)) continue;
            using var к = _соединение.CreateCommand();
            к.CommandText = $"DELETE FROM \"{таблица}\" WHERE \"Регистратор\" = @р";
            к.Parameters.AddWithValue("@р", регистратор);
            к.ExecuteNonQuery();
        }
    }

    /// <summary>Записывает движения документа: старые удаляются, новые вставляются (транзакция).</summary>
    public void ЗаписатьДвижения(string регистратор, string период, НаборДвижений движения)
    {
        using var транзакция = _соединение.BeginTransaction();
        foreach (var регистр in _конфиг.ПоВиду("РегистрНакопления"))
        {
            var таблица = регистр.Таблица;
            if (таблица == null || !ТаблицаЕсть(таблица)) continue;
            using var к = _соединение.CreateCommand();
            к.Transaction = транзакция;
            к.CommandText = $"DELETE FROM \"{таблица}\" WHERE \"Регистратор\" = @р";
            к.Parameters.AddWithValue("@р", регистратор);
            к.ExecuteNonQuery();
        }
        foreach (var движение in движения.Список)
        {
            var регистр = _конфиг.Найти($"РегистрНакопления.{движение.Регистр}");
            var таблица = регистр?.Таблица;
            if (регистр == null || таблица == null)
                throw new InvalidOperationException($"Регистр накопления «{движение.Регистр}» не найден или не опубликован.");

            var поля = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
            {
                ["Регистратор"] = регистратор,
                ["Период"] = период,
                ["ВидДвижения"] = движение.ВидДвижения
            };
            foreach (var (имя, значение) in движение.Поля) поля[имя] = значение;

            var имена = поля.Keys.ToList();
            using var к = _соединение.CreateCommand();
            к.Transaction = транзакция;
            var колонки = string.Join(", ", имена.Select(и => $"\"{ВКолонку(таблица, и)}\""));
            var параметры = string.Join(", ", имена.Select((_, i) => $"@p{i}"));
            к.CommandText = $"INSERT INTO \"{таблица}\" ({колонки}) VALUES ({параметры})";
            for (int i = 0; i < имена.Count; i++)
                к.Parameters.AddWithValue($"@p{i}", поля[имена[i]] ?? "");
            к.ExecuteNonQuery();
        }
        транзакция.Commit();
    }

    /// <summary>Остатки по регистру накопления: измерения + суммы ресурсов (Приход минус Расход).</summary>
    public List<Dictionary<string, object?>> Остатки(ОбъектМетаданных регистр)
    {
        var результат = new List<Dictionary<string, object?>>();
        var таблица = регистр.Таблица;
        if (таблица == null || !ТаблицаЕсть(таблица)) return результат;

        var измерения = регистр.Измерения.Select(и => и.Имя).ToList();
        var ресурсы = регистр.Ресурсы.Select(р => р.Имя).ToList();
        if (ресурсы.Count == 0) return результат;

        var выбор = new List<string>();
        foreach (var и in измерения)
            выбор.Add($"\"{ВКолонку(таблица, и)}\" AS \"{и}\"");
        foreach (var р in ресурсы)
            выбор.Add($"SUM(CASE WHEN \"ВидДвижения\" = 'Расход' THEN -\"{ВКолонку(таблица, р)}\" ELSE \"{ВКолонку(таблица, р)}\" END) AS \"{р}\"");
        var группировка = измерения.Count > 0
            ? " GROUP BY " + string.Join(", ", измерения.Select((_, i) => (i + 1).ToString()))
            : "";

        using var к = _соединение.CreateCommand();
        к.CommandText = $"SELECT {string.Join(", ", выбор)} FROM \"{таблица}\"{группировка}";
        using var ч = к.ExecuteReader();
        while (ч.Read())
        {
            var строка = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i < ч.FieldCount; i++)
                строка[ч.GetName(i)] = ч.IsDBNull(i) ? null : ч.GetValue(i);
            // нулевые остатки не показываем
            if (ресурсы.All(р => Convert.ToDecimal(строка[р] ?? 0m) == 0m)) continue;
            результат.Add(строка);
        }
        return результат;
    }

    public void Dispose() => _соединение.Dispose();
}
