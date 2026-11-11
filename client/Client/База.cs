using Microsoft.Data.Sqlite;
using OneC.Core;

namespace Client;

/// <summary>Доступ к опубликованной базе SQLite.</summary>
public class База : IDisposable
{
    readonly SqliteConnection _соединение;
    readonly Конфигурация _конфиг;

    public База(string файл, Конфигурация конфиг)
    {
        _конфиг = конфиг;
        // каталог может отсутствовать (data/*.db не хранится в git) — создаём,
        // иначе SQLite падает с «Error 14: unable to open database file»
        var каталог = Path.GetDirectoryName(Path.GetFullPath(файл));
        if (!string.IsNullOrEmpty(каталог)) Directory.CreateDirectory(каталог);
        _соединение = new SqliteConnection($"Data Source={файл}");
        _соединение.Open();
    }

    /// <summary>Стабильное имя таблицы из метаданных; для старых конфигураций — по имени объекта.</summary>
    public static string ИмяТаблицы(ОбъектМетаданных о) => о.Таблица ?? о.Вид switch
    {
        "Справочник" => $"Спр_{о.Имя}",
        "Документ" => $"Док_{о.Имя}",
        "Перечисление" => $"Переч_{о.Имя}",
        "РегистрСведений" => $"РегСвед_{о.Имя}",
        "РегистрНакопления" => $"РегНакоп_{о.Имя}",
        _ => о.Имя
    };

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
        к.CommandText = $"SELECT * FROM \"{таблица}\"" + (порядок != null ? $" ORDER BY \"{порядок}\"" : "");
        using var ч = к.ExecuteReader();
        while (ч.Read())
        {
            var строка = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i < ч.FieldCount; i++)
                строка[ч.GetName(i)] = ч.IsDBNull(i) ? null : ч.GetValue(i);
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

    public void Записать(string таблица, Dictionary<string, object?> поля, string ключ = "Ссылка")
    {
        var имена = поля.Keys.ToList();
        using var к = _соединение.CreateCommand();
        var колонки = string.Join(", ", имена.Select(и => $"\"{и}\""));
        var параметры = string.Join(", ", имена.Select((_, i) => $"@p{i}"));
        к.CommandText = $"INSERT OR REPLACE INTO \"{таблица}\" ({колонки}) VALUES ({параметры})";
        for (int i = 0; i < имена.Count; i++)
            к.Parameters.AddWithValue($"@p{i}", поля[имена[i]] ?? "");
        к.ExecuteNonQuery();
    }

    public void Удалить(string таблица, string ключ, string значение)
    {
        using var к = _соединение.CreateCommand();
        к.CommandText = $"DELETE FROM \"{таблица}\" WHERE \"{ключ}\" = @v";
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

    public void Dispose() => _соединение.Dispose();
}
