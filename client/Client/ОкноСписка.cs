using Avalonia.Controls;
using OneC.Core;

namespace Client;

/// <summary>
/// Схема списков: таблица, колонки, ключ и редактируемость для каждого вида объектов.
/// Общая для главного окна и окон списка с отбором.
/// </summary>
public static class СхемаСписка
{
    public static (string Таблица, List<string> Колонки, string Ключ, bool Редактируемый) Схема(ОбъектМетаданных о)
    {
        var таблица = База.ИмяТаблицы(о);
        return о.Вид switch
        {
            "Справочник" => (таблица,
                new List<string> { "Код", "Наименование" }.Concat(о.Реквизиты.Select(р => р.Имя)).ToList(),
                "Ссылка", true),
            "Документ" => (таблица,
                new List<string> { "Номер", "Дата" }.Concat(о.Реквизиты.Select(р => р.Имя)).ToList(),
                "Ссылка", true),
            "Перечисление" => (таблица, new List<string> { "Имя", "Синоним" }, "Имя", false),
            "РегистрСведений" => (таблица,
                о.Измерения.Concat(о.Ресурсы).Concat(о.Реквизиты).Select(р => р.Имя).ToList(), "", false),
            "РегистрНакопления" => (таблица,
                new List<string> { "Период", "ВидДвижения" }
                    .Concat(о.Измерения.Concat(о.Ресурсы).Select(р => р.Имя)).ToList(), "", false),
            _ => (таблица, new List<string>(), "", false)
        };
    }

    public static string? ТипКолонки(ОбъектМетаданных о, string колонка) =>
        о.Реквизиты.Concat(о.Измерения).Concat(о.Ресурсы)
         .FirstOrDefault(р => р.Имя == колонка)?.Тип;

    public static bool Флаг(Dictionary<string, object?> строка, string имя) =>
        строка.TryGetValue(имя, out var з) && з?.ToString() is "1" or "True" or "true";
}

/// <summary>
/// Окно списка объекта с отбором (как форма списка, открытая с параметром Отбор в 1С).
/// Открывается кнопкой «Перейти» из формы записи или из модулей — Формы.ОткрытьСписок(...).
/// Повторяет список главного окна: пиктограммы состояния, форма списка из дизайнера,
/// поиск, сортировка, пометка удаления.
/// </summary>
public class ОкноСписка : Window
{
    readonly Конфигурация _конфиг;
    readonly База _база;
    readonly ОбъектМетаданных _объект;
    readonly Dictionary<string, object?>? _отбор;

    readonly StackPanel _шапка = new() { Orientation = Avalonia.Layout.Orientation.Horizontal };
    readonly ListBox _список = new();
    readonly TextBlock _статус = new();
    readonly TextBox _поиск;
    Button _кнДобавить = null!, _кнИзменить = null!, _кнУдалить = null!, _кнОбновить = null!;
    string? _сортИмя;
    bool _сортУбывание;
    List<string> _колонки = new();

    public ОкноСписка(Конфигурация конфиг, База база, ОбъектМетаданных объект,
                      Dictionary<string, object?>? отбор = null)
    {
        _конфиг = конфиг; _база = база; _объект = объект;
        _отбор = отбор is { Count: > 0 } ? отбор : null;

        Title = _объект.Представление + ОписаниеОтбора();
        Width = 860; Height = 480;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;

        var кнопки = new StackPanel { Orientation = Avalonia.Layout.Orientation.Horizontal };
        кнопки.Classes.Add("commandBar");
        _кнДобавить = Шаблон.Кнопка("Добавить", ДобавитьЗапись);
        _кнИзменить = Шаблон.Кнопка("Изменить", ИзменитьЗапись);
        _кнУдалить = Шаблон.Кнопка("Удалить", УдалитьЗапись);
        ToolTip.SetTip(_кнУдалить, "Пометить на удаление / Снять пометку");
        _кнОбновить = Шаблон.Кнопка("Обновить", () => Показать());
        _поиск = Шаблон.ПолеВвода();
        _поиск.Watermark = "Поиск";
        _поиск.Width = 200;
        _поиск.TextChanged += (_, _) => Показать();
        foreach (var к in new Control[] { _кнДобавить, _кнИзменить, _кнУдалить, _кнОбновить, _поиск })
            кнопки.Children.Add(к);

        _шапка.Classes.Add("commandBar");
        _статус.Classes.Add("status");
        _список.DoubleTapped += async (_, _) => await ИзменитьЗапись();

        var корень = new DockPanel();
        DockPanel.SetDock(кнопки, Dock.Top);
        DockPanel.SetDock(_шапка, Dock.Top);
        DockPanel.SetDock(_статус, Dock.Bottom);
        корень.Children.Add(кнопки);
        корень.Children.Add(_шапка);
        корень.Children.Add(_статус);
        корень.Children.Add(new ScrollViewer { Content = _список });
        Content = корень;

        Показать();
    }

    string ОписаниеОтбора()
    {
        if (_отбор == null) return "";
        var части = _отбор.Select(п =>
        {
            var значение = п.Value?.ToString() ?? "";
            var тип = СхемаСписка.ТипКолонки(_объект, п.Key);
            if (тип != null && тип.Contains("Ссылка.")) значение = _база.Представление(тип, значение);
            return $"{п.Key} = {значение}";
        });
        return " — отбор: " + string.Join(", ", части);
    }

    void Показать()
    {
        _шапка.Children.Clear();
        _список.Items.Clear();

        var (таблица, колонки, _, редактируемый) = СхемаСписка.Схема(_объект);

        // Форма списка из дизайнера: состав/порядок/заголовки/ширины колонок и кнопки
        var формаСписка = _объект.Формы.FirstOrDefault(ф => ф.Имя == "ФормаСписка" && ф.Элементы is { Count: > 0 });
        var списокЭл = формаСписка?.Элементы!.FirstOrDefault(э => э.Тип == "Список");
        var настройкиКолонок = new Dictionary<string, КолонкаТаблицы>(StringComparer.OrdinalIgnoreCase);
        if (списокЭл?.Колонки is { Count: > 0 } колНастр)
        {
            var выбранные = колНастр
                .Where(к => к.Видимость && колонки.Contains(к.Реквизит, StringComparer.OrdinalIgnoreCase))
                .Select(к => к.Реквизит).ToList();
            if (выбранные.Count > 0) колонки = выбранные;
            foreach (var к in колНастр) настройкиКолонок[к.Реквизит] = к;
        }
        _колонки = колонки;
        var сИконкой = _объект.Вид is "Справочник" or "Документ";
        _кнДобавить.IsEnabled = _кнИзменить.IsEnabled = _кнУдалить.IsEnabled = редактируемый;

        // Видимость кнопок — по командной панели формы списка (если нарисована)
        if (формаСписка?.Элементы != null)
        {
            ЭлементУправленияФормы? Кн(string д)
            {
                ЭлементУправленияФормы? найдена = null;
                void Обойти(List<ЭлементУправленияФормы> эл)
                {
                    foreach (var э in эл)
                    {
                        if (э.Тип == "Кнопка" && э.Действие == д) найдена = э;
                        if (э.Элементы != null) Обойти(э.Элементы);
                    }
                }
                Обойти(формаСписка.Элементы);
                return найдена;
            }
            _кнДобавить.IsVisible = Кн("Создать") is { Видимость: true };
            _кнИзменить.IsVisible = Кн("Изменить") is { Видимость: true };
            _кнУдалить.IsVisible = Кн("Удалить") is { Видимость: true };
            _кнОбновить.IsVisible = Кн("Обновить") is { Видимость: true };
        }

        if (сИконкой) _шапка.Children.Add(Шаблон.ЯчейкаШапкиИконки());
        foreach (var к in колонки)
        {
            var заголовок = настройкиКолонок.TryGetValue(к, out var нк) && !string.IsNullOrEmpty(нк.Заголовок)
                ? нк.Заголовок! : к;
            var текст = к == _сортИмя ? заголовок + (_сортУбывание ? " ▼" : " ▲") : заголовок;
            var ячейка = Шаблон.ЯчейкаШапки(текст);
            if (нк is { Ширина: > 0 }) ячейка.Width = нк.Ширина;
            ячейка.Cursor = new Avalonia.Input.Cursor(Avalonia.Input.StandardCursorType.Hand);
            var имя = к;
            ячейка.PointerPressed += (_, _) =>
            {
                if (_сортИмя == имя) _сортУбывание = !_сортУбывание;
                else { _сортИмя = имя; _сортУбывание = false; }
                Показать();
            };
            _шапка.Children.Add(ячейка);
        }

        if (!_база.ТаблицаЕсть(таблица))
        {
            _статус.Text = $"Таблица «{таблица}» не найдена. Выполните публикацию конфигурации.";
            return;
        }

        var строки = _база.Выбрать(таблица, колонки.FirstOrDefault(), _отбор);

        var представления = new List<(Dictionary<string, object?> Строка, List<string> Значения)>();
        foreach (var строка in строки)
        {
            var значения = new List<string>();
            foreach (var к in колонки)
            {
                var значение = строка.TryGetValue(к, out var v) ? v?.ToString() ?? "" : "";
                var тип = СхемаСписка.ТипКолонки(_объект, к);
                if (тип != null && тип.Contains("Ссылка."))
                    значение = _база.Представление(тип, значение);
                значения.Add(значение);
            }
            представления.Add((строка, значения));
        }

        var видимые = представления;
        var поиск = _поиск?.Text?.Trim() ?? "";
        if (поиск.Length > 0)
            видимые = видимые
                .Where(п => п.Значения.Any(з => з.Contains(поиск, StringComparison.OrdinalIgnoreCase)))
                .ToList();

        if (_сортИмя != null)
        {
            var индекс = колонки.IndexOf(_сортИмя);
            if (индекс >= 0)
            {
                int Сравнить((Dictionary<string, object?>, List<string> Значения) а, (Dictionary<string, object?>, List<string> Значения) б)
                {
                    var x = а.Значения[индекс];
                    var y = б.Значения[индекс];
                    if (decimal.TryParse(x, System.Globalization.CultureInfo.InvariantCulture, out var чх) &&
                        decimal.TryParse(y, System.Globalization.CultureInfo.InvariantCulture, out var чy))
                        return чх.CompareTo(чy);
                    return string.Compare(x, y, StringComparison.CurrentCultureIgnoreCase);
                }
                видимые = видимые.OrderBy(п => п, Comparer<(Dictionary<string, object?>, List<string>)>.Create(
                    (а, б) => _сортУбывание ? Сравнить(б, а) : Сравнить(а, б))).ToList();
            }
        }

        foreach (var (строка, значения) in видимые)
        {
            var панель = new StackPanel { Orientation = Avalonia.Layout.Orientation.Horizontal };
            if (сИконкой)
                панель.Children.Add(Шаблон.ИконкаСтроки(_объект.Вид,
                    СхемаСписка.Флаг(строка, "Проведен"), СхемаСписка.Флаг(строка, "ПометкаУдаления")));
            for (int i = 0; i < значения.Count; i++)
            {
                var яч = Шаблон.Ячейка(значения[i]);
                if (i < колонки.Count && настройкиКолонок.TryGetValue(колонки[i], out var нкЯч) && нкЯч.Ширина > 0)
                    яч.Width = нкЯч.Ширина;
                панель.Children.Add(яч);
            }
            _список.Items.Add(new ListBoxItem { Content = панель, Tag = строка });
        }
        _статус.Text = видимые.Count == строки.Count
            ? $"{_объект.ПолноеИмя} — записей: {строки.Count}"
            : $"{_объект.ПолноеИмя} — показано {видимые.Count} из {строки.Count}";
    }

    Dictionary<string, object?>? Выбранная() =>
        (_список.SelectedItem as ListBoxItem)?.Tag as Dictionary<string, object?>;

    async Task ДобавитьЗапись()
    {
        if (await ОткрытьФормуЗаписи(null)) Показать();
    }

    async Task ИзменитьЗапись()
    {
        var строка = Выбранная();
        if (строка == null) return;
        var (_, _, _, редактируемый) = СхемаСписка.Схема(_объект);
        if (!редактируемый) return;
        if (await ОткрытьФормуЗаписи(строка)) Показать();
    }

    async Task УдалитьЗапись()
    {
        var строка = Выбранная();
        if (строка == null) return;
        var (таблица, _, ключ, редактируемый) = СхемаСписка.Схема(_объект);
        if (!редактируемый || ключ == "") return;

        var имя = строка.TryGetValue("Наименование", out var н) ? н?.ToString() :
                  строка.TryGetValue("Номер", out var номер) ? номер?.ToString() : "";
        var помечен = СхемаСписка.Флаг(строка, "ПометкаУдаления");
        var да = await Шаблон.Вопрос(this, помечен
            ? $"Снять с «{имя}» пометку удаления?"
            : $"Пометить «{имя}» на удаление?");
        if (!да) return;

        var значениеКлюча = строка[ключ]?.ToString() ?? "";
        _база.ОбновитьПоле(таблица, ключ, значениеКлюча, "ПометкаУдаления", помечен ? 0 : 1);
        if (!помечен && _объект.Вид == "Документ")
        {
            _база.ОбновитьПоле(таблица, ключ, значениеКлюча, "Проведен", 0);
            _база.УдалитьДвижения(значениеКлюча);
        }
        Показать();
    }

    /// <summary>Произвольная AXAML-форма объекта, если есть; иначе генерируемый редактор.</summary>
    async Task<bool> ОткрытьФормуЗаписи(Dictionary<string, object?>? строка)
    {
        var типФормы = РеестрМодулей.НайтиФорму(_объект.ПолноеИмя);
        if (типФормы == null)
            return await new РедакторЗаписи(_конфиг, _база, _объект, строка).ShowDialog<bool>(this);

        var окно = (Window)Activator.CreateInstance(типФормы)!;
        ((IПроизвольнаяФорма)окно).Инициализировать(new КонтекстФормы
        {
            Конфигурация = _конфиг,
            Объект = _объект,
            Запись = СервисЗаписи.Прочитать(_база, _объект, строка),
            Записать = (запись, провести) => СервисЗаписи.Записать(_база, _объект, запись, провести)
        });
        return await окно.ShowDialog<bool>(this);
    }
}
