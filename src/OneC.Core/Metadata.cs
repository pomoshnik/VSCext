using System.Text.Json;
using System.Text.Json.Serialization;

namespace OneC.Core;

/// <summary>Реквизит / измерение / ресурс / значение перечисления.</summary>
public class Реквизит
{
    public string Имя { get; set; } = "";
    public string Синоним { get; set; } = "";
    public string Тип { get; set; } = "Строка";
    public string Комментарий { get; set; } = "";
    /// <summary>Стабильное имя колонки в базе (fld_0000001) — не зависит от имени реквизита.</summary>
    public string? Колонка { get; set; }
    /// <summary>История переименований: нужна для миграции баз со старыми именами колонок/значений.</summary>
    public List<string>? ПрежниеИмена { get; set; }
}

public class ТабличнаяЧасть
{
    public string Имя { get; set; } = "";
    public string Синоним { get; set; } = "";
    public string? Таблица { get; set; }      // стабильное имя таблицы (vt_0000001)
    public List<Реквизит> Реквизиты { get; set; } = new();
}

public class ЭлементУправленияФормы
{
    public string Тип { get; set; } = "Поле";       // Поле | Таблица | Кнопка
    public string? Реквизит { get; set; }
    public string? ТабличнаяЧасть { get; set; }
    public string? Заголовок { get; set; }
    public string? Действие { get; set; }
    public bool ТолькоПросмотр { get; set; }
}

public class ЭлементФормы
{
    public string Имя { get; set; } = "";
    public string Синоним { get; set; } = "";
    public List<ЭлементУправленияФормы>? Элементы { get; set; }
}

/// <summary>Объект метаданных: справочник, документ, регистр и т.д.</summary>
public class ОбъектМетаданных
{
    public string Вид { get; set; } = "";
    public string Имя { get; set; } = "";
    public string Синоним { get; set; } = "";
    public string Комментарий { get; set; } = "";
    public string? Тип { get; set; }                       // для констант
    public string? Таблица { get; set; }                   // стабильное имя таблицы (cat_0000001)
    public string? Модуль { get; set; }                    // файл модуля бизнес-логики
    public List<string>? ПрежниеИмена { get; set; }        // история переименований (константы: строка в таблице Константы)
    public List<Реквизит> Реквизиты { get; set; } = new();
    public List<Реквизит> Измерения { get; set; } = new();
    public List<Реквизит> Ресурсы { get; set; } = new();
    public List<Реквизит> Значения { get; set; } = new();  // перечисления
    public List<ТабличнаяЧасть> ТабличныеЧасти { get; set; } = new();
    public List<ЭлементФормы> Формы { get; set; } = new();
    public List<ЭлементФормы> Команды { get; set; } = new();
    public List<ЭлементФормы> Макеты { get; set; } = new();

    [JsonIgnore] public string ПолноеИмя => $"{Вид}.{Имя}";
    [JsonIgnore]
    public string Представление => string.IsNullOrWhiteSpace(Синоним) ? Имя : Синоним;
}

public class Конфигурация
{
    public string Имя { get; set; } = "Конфигурация";
    public string Синоним { get; set; } = "";
    public string Версия { get; set; } = "1.0.0";
    public string Комментарий { get; set; } = "";

    [JsonIgnore] public List<ОбъектМетаданных> Объекты { get; } = new();

    public IEnumerable<ОбъектМетаданных> ПоВиду(string вид) =>
        Объекты.Where(o => o.Вид == вид).OrderBy(o => o.Имя);

    public ОбъектМетаданных? Найти(string полноеИмя) =>
        Объекты.FirstOrDefault(o => o.ПолноеИмя == полноеИмя);
}

/// <summary>Полный снимок конфигурации для хранения в базе данных (таблица _Конфигурация).</summary>
public class СнимокКонфигурации
{
    public string Имя { get; set; } = "";
    public string Синоним { get; set; } = "";
    public string Версия { get; set; } = "";
    public string Комментарий { get; set; } = "";
    public List<ОбъектМетаданных> Объекты { get; set; } = new();
}

public static class ЗагрузчикМетаданных
{
    static readonly JsonSerializerOptions Опции = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    /// <summary>Загружает конфигурацию из каталога metadata (рекурсивно).</summary>
    public static Конфигурация Загрузить(string каталогМетаданных)
    {
        if (!Directory.Exists(каталогМетаданных))
            throw new DirectoryNotFoundException($"Каталог метаданных не найден: {каталогМетаданных}");

        var конфиг = new Конфигурация();
        var корневойФайл = Path.Combine(каталогМетаданных, "Конфигурация.json");
        if (File.Exists(корневойФайл))
        {
            var k = JsonSerializer.Deserialize<Конфигурация>(File.ReadAllText(корневойФайл), Опции);
            if (k != null)
            {
                конфиг.Имя = k.Имя; конфиг.Синоним = k.Синоним;
                конфиг.Версия = k.Версия; конфиг.Комментарий = k.Комментарий;
            }
        }

        foreach (var файл in Directory.EnumerateFiles(каталогМетаданных, "*.json", SearchOption.AllDirectories))
        {
            if (Path.GetFileName(файл) == "Конфигурация.json") continue;
            try
            {
                var объект = JsonSerializer.Deserialize<ОбъектМетаданных>(File.ReadAllText(файл), Опции);
                if (объект != null && !string.IsNullOrEmpty(объект.Имя))
                    конфиг.Объекты.Add(объект);
            }
            catch (JsonException ex)
            {
                Console.Error.WriteLine($"Ошибка чтения {файл}: {ex.Message}");
            }
        }
        return конфиг;
    }

    /// <summary>Сериализует конфигурацию в снимок для записи в базу при публикации.</summary>
    public static string ВСнимок(Конфигурация конфиг)
    {
        var снимок = new СнимокКонфигурации
        {
            Имя = конфиг.Имя, Синоним = конфиг.Синоним,
            Версия = конфиг.Версия, Комментарий = конфиг.Комментарий,
            Объекты = конфиг.Объекты.ToList()
        };
        return JsonSerializer.Serialize(снимок, new JsonSerializerOptions
        {
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        });
    }

    /// <summary>Загружает конфигурацию из снимка, сохранённого в базе данных.</summary>
    public static Конфигурация ИзСнимка(string json)
    {
        var снимок = JsonSerializer.Deserialize<СнимокКонфигурации>(json, Опции)
            ?? throw new InvalidOperationException("Снимок конфигурации в базе повреждён.");
        var конфиг = new Конфигурация
        {
            Имя = снимок.Имя, Синоним = снимок.Синоним,
            Версия = снимок.Версия, Комментарий = снимок.Комментарий
        };
        конфиг.Объекты.AddRange(снимок.Объекты);
        return конфиг;
    }
}
