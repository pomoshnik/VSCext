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
