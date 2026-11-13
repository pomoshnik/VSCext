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
    /// <summary>
    /// Команда формы: как в 1С, кнопка ссылается на команду, а команда — на обработчик.
    /// Обработчик — публичный метод модуля с именем команды и параметром-записью
    /// (типизированной, например ДокументПоступлениеТоваровЗапись, или ЗаписьОбъекта) либо без параметров.
    /// Возвращает false, если метод не найден.
    /// </summary>
    public bool ВыполнитьКоманду(string имя, ЗаписьОбъекта запись)
    {
        var метод = GetType().GetMethod(имя,
            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
        if (метод == null || метод.DeclaringType == typeof(МодульОбъекта)) return false;

        var параметры = метод.GetParameters();
        object?[] аргументы;
        if (параметры.Length == 0)
            аргументы = Array.Empty<object?>();
        else if (параметры.Length == 1 && параметры[0].ParameterType.IsInstanceOfType(запись))
            аргументы = new object?[] { запись };
        else if (параметры.Length == 1 &&
                 параметры[0].ParameterType.GetConstructor(new[] { typeof(ЗаписьОбъекта) }) is { } ктор)
            аргументы = new object?[] { ктор.Invoke(new object[] { запись }) };
        else
            return false;

        try { метод.Invoke(this, аргументы); }
        catch (System.Reflection.TargetInvocationException e) when (e.InnerException != null)
        { throw e.InnerException; }
        return true;
    }

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

/// <summary>
/// База моделей произвольных форм: INotifyPropertyChanged для компилируемых биндингов AXAML.
/// Генерируемые модели (Generated/Модели.g.cs) наследуются от неё.
/// </summary>
public abstract class МодельФормы : System.ComponentModel.INotifyPropertyChanged
{
    public event System.ComponentModel.PropertyChangedEventHandler? PropertyChanged;

    protected void Изменено(string имя) =>
        PropertyChanged?.Invoke(this, new System.ComponentModel.PropertyChangedEventArgs(имя));

    protected bool Установить<T>(ref T поле, T значение,
        [System.Runtime.CompilerServices.CallerMemberName] string? имя = null)
    {
        if (EqualityComparer<T>.Default.Equals(поле, значение)) return false;
        поле = значение;
        Изменено(имя!);
        return true;
    }

    string? _ошибки;
    /// <summary>Текст ошибок (отказы, исключения команд) — биндится в форме.</summary>
    public string? Ошибки
    {
        get => _ошибки;
        set { if (Установить(ref _ошибки, value)) Изменено(nameof(ЕстьОшибки)); }
    }
    public bool ЕстьОшибки => !string.IsNullOrEmpty(_ошибки);

    // Конверсия значений записи (генерируемый код)
    protected static string Стр(Dictionary<string, object?> п, string имя) =>
        п.TryGetValue(имя, out var v) ? v?.ToString() ?? "" : "";
    protected static decimal Числ(Dictionary<string, object?> п, string имя) =>
        decimal.TryParse(Стр(п, имя), System.Globalization.CultureInfo.InvariantCulture, out var d) ? d : 0m;
    protected static bool Бул(Dictionary<string, object?> п, string имя) =>
        Стр(п, имя) is "1" or "True" or "true";
}

/// <summary>ICommand для кнопок произвольных форм: выполняет действие модели.</summary>
public sealed class КомандаМодели : System.Windows.Input.ICommand
{
    readonly Action _действие;
    public КомандаМодели(Action действие) => _действие = действие;
    public bool CanExecute(object? параметр) => true;
    public event EventHandler? CanExecuteChanged { add { } remove { } }
    public void Execute(object? параметр) => _действие();
}

/// <summary>Отмечает окно произвольной формы объекта в сборке конфигурации.</summary>
[AttributeUsage(AttributeTargets.Class)]
public sealed class ПроизвольнаяФормаAttribute : Attribute
{
    public string ПолноеИмяОбъекта { get; }
    public ПроизвольнаяФормаAttribute(string полноеИмяОбъекта) => ПолноеИмяОбъекта = полноеИмяОбъекта;
}

/// <summary>Контекст, который платформа передаёт произвольной форме при открытии.</summary>
public class КонтекстФормы
{
    public required Конфигурация Конфигурация { get; init; }
    public required ОбъектМетаданных Объект { get; init; }

    /// <summary>Данные: загруженная запись либо новая (после ПриЗаполнении).</summary>
    public required ЗаписьОбъекта Запись { get; init; }

    /// <summary>Записать через конвейер платформы (ПередЗаписью, проведение, движения). Аргументы: запись, провести.</summary>
    public required Func<ЗаписьОбъекта, bool, Отказ> Записать { get; init; }
}

/// <summary>Реализуется клиентом: открытие форм по запросу бизнес-логики.</summary>
public interface IНавигаторФорм
{
    /// <summary>Открыть форму списка объекта с отбором по равенству (имя реквизита → значение).</summary>
    void ОткрытьСписок(string полноеИмяОбъекта, Dictionary<string, object?>? отбор = null);
}

/// <summary>
/// Программное открытие форм из модулей (как ОткрытьФорму с параметром Отбор в 1С):
/// Формы.ОткрытьСписок("Документ.ПоступлениеТоваров", new() { ["Контрагент"] = запись.Ссылка }).
/// </summary>
public static class Формы
{
    /// <summary>Подставляется клиентом при старте.</summary>
    public static IНавигаторФорм? Навигатор { get; set; }

    public static void ОткрытьСписок(string полноеИмяОбъекта, Dictionary<string, object?>? отбор = null) =>
        Навигатор?.ОткрытьСписок(полноеИмяОбъекта, отбор);
}

/// <summary>Реализуется окном произвольной формы (AXAML в конфигурации).</summary>
public interface IПроизвольнаяФорма
{
    void Инициализировать(КонтекстФормы контекст);
}

/// <summary>Реестр модулей бизнес-логики: ищет классы с атрибутом [МодульОбъекта] по сборкам.</summary>
public static class РеестрМодулей
{
    static Dictionary<string, МодульОбъекта>? _кэш;
    static readonly Dictionary<string, Type> _формы = new();

    public static void Инициализировать(params Assembly[] сборки)
    {
        _кэш = new Dictionary<string, МодульОбъекта>();
        var список = сборки.Length > 0 ? сборки : AppDomain.CurrentDomain.GetAssemblies();
        foreach (var сборка in список) Сканировать(сборка);
    }

    /// <summary>Подключить сборку конфигурации (например, загруженную из базы данных).</summary>
    public static void Подключить(Assembly сборка)
    {
        _кэш ??= new Dictionary<string, МодульОбъекта>();
        Сканировать(сборка);
    }

    static void Сканировать(Assembly сборка)
    {
        Type[] типы;
        try { типы = сборка.GetTypes(); } catch { return; }
        foreach (var тип in типы)
        {
            var атрибут = тип.GetCustomAttribute<МодульОбъектаAttribute>();
            if (атрибут != null && typeof(МодульОбъекта).IsAssignableFrom(тип)
                && Activator.CreateInstance(тип) is МодульОбъекта модуль)
                _кэш![атрибут.ПолноеИмя] = модуль;

            var формa = тип.GetCustomAttribute<ПроизвольнаяФормаAttribute>();
            if (формa != null && typeof(IПроизвольнаяФорма).IsAssignableFrom(тип))
                _формы[формa.ПолноеИмяОбъекта] = тип;
        }
    }

    public static МодульОбъекта? Найти(string полноеИмя)
    {
        if (_кэш == null) Инициализировать();
        return _кэш!.TryGetValue(полноеИмя, out var м) ? м : null;
    }

    /// <summary>Тип окна произвольной формы объекта или null, если у объекта обычная (генерируемая) форма.</summary>
    public static Type? НайтиФорму(string полноеИмяОбъекта) =>
        _формы.TryGetValue(полноеИмяОбъекта, out var т) ? т : null;
}
