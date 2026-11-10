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
}

public class ТабличнаяЧасть
{
    public string Имя { get; set; } = "";
    public string Синоним { get; set; } = "";
    public List<Реквизит> Реквизиты { get; set; } = new();
}

public class ЭлементФормы
{
    public string Имя { get; set; } = "";
    public string Синоним { get; set; } = "";
}

/// <summary>Объект метаданных: справочник, документ, регистр и т.д.</summary>
public class ОбъектМетаданных
{
    public string Вид { get; set; } = "";
    public string Имя { get; set; } = "";
    public string Синоним { get; set; } = "";
    public string Комментарий { get; set; } = "";
    public string? Тип { get; set; }                       // для констант
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
}
