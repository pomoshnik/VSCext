using System.Reflection;

namespace OneC.Core;

/// <summary>Помечает класс как модуль объекта метаданных, например "Справочник.Номенклатура".</summary>
[AttributeUsage(AttributeTargets.Class)]
public sealed class МодульОбъектаAttribute : Attribute
{
    public string ПолноеИмя { get; }
    public МодульОбъектаAttribute(string полноеИмя) => ПолноеИмя = полноеИмя;
}

/// <summary>Запись объекта (элемент справочника, документ), передаваемая в обработчики.</summary>
public class ЗаписьОбъекта
{
    public string ПолноеИмяОбъекта { get; set; } = "";
    public string? Ссылка { get; set; }
    public bool ЭтоНовый => string.IsNullOrEmpty(Ссылка);
    public Dictionary<string, object?> Поля { get; } = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Строки табличных частей по имени ТЧ (ключи строк — имена реквизитов).</summary>
    public Dictionary<string, List<Dictionary<string, object?>>> ТабличныеЧасти { get; } =
        new(StringComparer.OrdinalIgnoreCase);

    public List<Dictionary<string, object?>> Строки(string табличнаяЧасть) =>
        ТабличныеЧасти.TryGetValue(табличнаяЧасть, out var строки) ? строки : new();

    public object? this[string имя]
    {
        get => Поля.TryGetValue(имя, out var v) ? v : null;
        set => Поля[имя] = value;
    }

    public string Строка(string имя) => this[имя]?.ToString() ?? "";
    public decimal Число(string имя) =>
        decimal.TryParse(this[имя]?.ToString(), System.Globalization.CultureInfo.InvariantCulture, out var d) ? d : 0m;
}

/// <summary>Одно движение по регистру накопления (Приход или Расход).</summary>
public class Движение
{
    public string Регистр { get; }
    public string ВидДвижения { get; }   // Приход | Расход
    public Dictionary<string, object?> Поля { get; } = new(StringComparer.OrdinalIgnoreCase);

    public Движение(string регистр, string видДвижения)
    {
        Регистр = регистр;
        ВидДвижения = видДвижения;
    }

    public object? this[string имя]
    {
        get => Поля.TryGetValue(имя, out var v) ? v : null;
        set => Поля[имя] = value;
    }
}

/// <summary>Движения документа по регистрам — заполняются в ОбработкаПроведения.</summary>
public class НаборДвижений
{
    public List<Движение> Список { get; } = new();

    public Движение Добавить(string регистр, string видДвижения)
    {
        var движение = new Движение(регистр, видДвижения);
        Список.Add(движение);
        return движение;
    }

    public Движение Приход(string регистр) => Добавить(регистр, "Приход");
    public Движение Расход(string регистр) => Добавить(регистр, "Расход");
}

/// <summary>Флаг отказа, как параметр Отказ в обработчиках 1С.</summary>
public class Отказ
{
    public bool Значение { get; private set; }
    public List<string> Сообщения { get; } = new();

    public void Установить(string сообщение)
    {
        Значение = true;
        Сообщения.Add(сообщение);
    }
}

/// <summary>Базовый класс модуля объекта — переопределите нужные обработчики.</summary>
public abstract class МодульОбъекта
{
    /// <summary>Вызывается перед записью. Установите Отказ, чтобы прервать запись.</summary>
    public virtual void ПередЗаписью(ЗаписьОбъекта запись, Отказ отказ) { }

    /// <summary>Вызывается после успешной записи.</summary>
    public virtual void ПриЗаписи(ЗаписьОбъекта запись) { }

    /// <summary>Вызывается при создании нового объекта — заполнение значений по умолчанию.</summary>
    public virtual void ПриЗаполнении(ЗаписьОбъекта запись) { }

    /// <summary>Проведение документа: сформируйте движения по регистрам. Установите Отказ, чтобы прервать.</summary>
    public virtual void ОбработкаПроведения(ЗаписьОбъекта запись, НаборДвижений движения, Отказ отказ) { }
}

/// <summary>Источник данных для запросов — реализуется слоем доступа к базе (клиент).</summary>
public interface IИсточникЗапросов
{
    List<ЗаписьОбъекта> Выполнить(Запрос запрос);
}

/// <summary>
/// Запрос к данным с отбором и сортировкой — доступен и в модулях бизнес-логики:
/// Запрос.Из("Документ.ПоступлениеТоваров").Отбор("Проведен", 1).Сортировка("Дата", убывание: true).Выбрать()
/// </summary>
public class Запрос
{
    /// <summary>Текущий источник данных. Клиент устанавливает его при открытии базы.</summary>
    public static IИсточникЗапросов? Источник { get; set; }

    public string ПолноеИмя { get; }
    public List<(string Поле, string Оператор, object? Значение)> Отборы { get; } = new();
    public List<(string Поле, bool Убывание)> Сортировки { get; } = new();
    public int? КоличествоПервых { get; private set; }
    public bool ЗагружатьТабличныеЧасти { get; private set; }

    Запрос(string полноеИмя) => ПолноеИмя = полноеИмя;

    public static Запрос Из(string полноеИмя) => new(полноеИмя);

    /// <summary>Отбор на равенство: Отбор("Контрагент", ссылка).</summary>
    public Запрос Отбор(string поле, object? значение) => Отбор(поле, "=", значение);

    /// <summary>Отбор с оператором: =, &lt;&gt;, &gt;, &gt;=, &lt;, &lt;=, Подобно (LIKE, маска %).</summary>
    public Запрос Отбор(string поле, string оператор, object? значение)
    {
        Отборы.Add((поле, оператор, значение));
        return this;
    }

    public Запрос Сортировка(string поле, bool убывание = false)
    {
        Сортировки.Add((поле, убывание));
        return this;
    }

    public Запрос Первые(int количество)
    {
        КоличествоПервых = количество;
        return this;
    }

    /// <summary>Загружать и строки табличных частей (запись.Строки("Товары")).</summary>
    public Запрос СТабличнымиЧастями()
    {
        ЗагружатьТабличныеЧасти = true;
        return this;
    }

    public List<ЗаписьОбъекта> Выбрать() =>
        (Источник ?? throw new InvalidOperationException(
            "Источник запросов не инициализирован: запросы доступны после открытия базы (клиент делает это автоматически)."))
        .Выполнить(this);

    public ЗаписьОбъекта? ВыбратьПервую()
    {
        Первые(1);
        return Выбрать().FirstOrDefault();
    }
}

/// <summary>Реестр модулей бизнес-логики: ищет классы с атрибутом [МодульОбъекта] по сборкам.</summary>
public static class РеестрМодулей
{
    static Dictionary<string, МодульОбъекта>? _кэш;

    public static void Инициализировать(params Assembly[] сборки)
    {
        _кэш = new Dictionary<string, МодульОбъекта>();
        var список = сборки.Length > 0 ? сборки : AppDomain.CurrentDomain.GetAssemblies();
        foreach (var сборка in список)
        {
            Type[] типы;
            try { типы = сборка.GetTypes(); } catch { continue; }
            foreach (var тип in типы)
            {
                var атрибут = тип.GetCustomAttribute<МодульОбъектаAttribute>();
                if (атрибут == null || !typeof(МодульОбъекта).IsAssignableFrom(тип)) continue;
                if (Activator.CreateInstance(тип) is МодульОбъекта модуль)
                    _кэш[атрибут.ПолноеИмя] = модуль;
            }
        }
    }

    public static МодульОбъекта? Найти(string полноеИмя)
    {
        if (_кэш == null) Инициализировать();
        return _кэш!.TryGetValue(полноеИмя, out var м) ? м : null;
    }
}
