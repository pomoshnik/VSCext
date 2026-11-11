using Avalonia.Controls;
using Avalonia.Markup.Xaml;
using Avalonia.Media;
using OneC.Core;

namespace Client;

/// <summary>Главное окно клиента. Разметка — MainWindow.axaml, внешний вид — App.axaml.</summary>
public partial class MainWindow : Window
{
    string _корень = "";
    Конфигурация _конфиг = new();
    База _база = null!;

    TreeView _дерево = null!;
    StackPanel _шапкаТаблицы = null!;
    ListBox _списокЗаписей = null!;
    TextBlock _статус = null!;
    Button _кнДобавить = null!, _кнИзменить = null!, _кнУдалить = null!, _кнОбновить = null!;
    Button? _кнОстатки;

    ОбъектМетаданных? _текущий;
    List<string> _колонки = new();

    /// <summary>Конструктор для предпросмотрщика (дизайнера) — без загрузки конфигурации и БД.</summary>
    public MainWindow()
    {
        AvaloniaXamlLoader.Load(this);
        _дерево = this.FindControl<TreeView>("Дерево")!;
        _шапкаТаблицы = this.FindControl<StackPanel>("ШапкаТаблицы")!;
        _списокЗаписей = this.FindControl<ListBox>("СписокЗаписей")!;
        _статус = this.FindControl<TextBlock>("Статус")!;
        _кнДобавить = this.FindControl<Button>("КнДобавить")!;
        _кнИзменить = this.FindControl<Button>("КнИзменить")!;
        _кнУдалить = this.FindControl<Button>("КнУдалить")!;
        _кнОбновить = this.FindControl<Button>("КнОбновить")!;
        Title = "1С-мини клиент";
    }

    public MainWindow(string кореньПроекта) : this()
    {
        _корень = кореньПроекта;
        var файлБД = Path.Combine(_корень, "data", "app.db");
        var каталогМетаданных = Path.Combine(_корень, "metadata");

        // Источник метаданных:
        //  - есть каталог metadata/ (режим разработчика) — читаем исходники JSON;
        //  - иначе — снимок конфигурации из самой базы (записывается при публикации).
        if (Directory.Exists(каталогМетаданных))
            _конфиг = ЗагрузчикМетаданных.Загрузить(каталогМетаданных);
        else
            _конфиг = ЗагрузчикМетаданных.ИзСнимка(
                База.СнимокМетаданных(файлБД)
                ?? throw new InvalidOperationException(
                    "Рядом с базой нет каталога metadata, а в самой базе нет снимка конфигурации.\n" +
                    "Выполните публикацию конфигурации из конфигуратора (VS Code)."));

        _база = new База(файлБД, _конфиг);

        Title = $"{_конфиг.Представление()} — 1С-мини клиент";

        _кнДобавить.Click += async (_, _) => await ДобавитьЗапись();
        _кнИзменить.Click += async (_, _) => await ИзменитьЗапись();
        _кнУдалить.Click += async (_, _) => await УдалитьЗапись();
        _кнОбновить.Click += (_, _) => ПоказатьСписок();

        // «Остатки» — только для регистров накопления (добавляется к панели кнопок)
        _кнОстатки = Шаблон.Кнопка("Остатки", ПоказатьОстатки);
        _кнОстатки.IsVisible = false;
        if (_кнОбновить.Parent is Panel панельКнопок) панельКнопок.Children.Add(_кнОстатки);

        ПостроитьДерево();
        _дерево.SelectionChanged += (_, _) =>
        {
            if (_дерево.SelectedItem is TreeViewItem { Tag: ОбъектМетаданных о })
            {
                _текущий = о;
                ПоказатьСписок();
            }
        };
        _списокЗаписей.DoubleTapped += async (_, _) => await ИзменитьЗапись();
    }

    void ПостроитьДерево()
    {
        void Секция(string заголовок, string вид)
        {
            var объекты = _конфиг.ПоВиду(вид).ToList();
            if (объекты.Count == 0) return;
            var узел = new TreeViewItem { Header = заголовок, IsExpanded = true, FontWeight = FontWeight.SemiBold };
            foreach (var о in объекты)
                узел.Items.Add(new TreeViewItem { Header = о.Представление, Tag = о, FontWeight = FontWeight.Normal });
            _дерево.Items.Add(узел);
        }

        Секция("Справочники", "Справочник");
        Секция("Документы", "Документ");
        Секция("Перечисления", "Перечисление");
        Секция("Регистры сведений", "РегистрСведений");
        Секция("Регистры накопления", "РегистрНакопления");
    }

    (string Таблица, List<string> Колонки, string Ключ, bool Редактируемый) Схема(ОбъектМетаданных о)
    {
        var таблица = База.ИмяТаблицы(о);
        return о.Вид switch
        {
            "Справочник" => (таблица,
                new List<string> { "Код", "Наименование" }.Concat(о.Реквизиты.Select(р => р.Имя)).ToList(),
                "Ссылка", true),
            "Документ" => (таблица,
                new List<string> { "Проведен", "Номер", "Дата" }.Concat(о.Реквизиты.Select(р => р.Имя)).ToList(),
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

    string? ТипКолонки(ОбъектМетаданных о, string колонка) =>
        о.Реквизиты.Concat(о.Измерения).Concat(о.Ресурсы)
         .FirstOrDefault(р => р.Имя == колонка)?.Тип;

    void ПоказатьСписок()
    {
        _шапкаТаблицы.Children.Clear();
        _списокЗаписей.Items.Clear();
        if (_текущий == null) return;

        var (таблица, колонки, _, редактируемый) = Схема(_текущий);
        _колонки = колонки;
        _кнДобавить.IsEnabled = _кнИзменить.IsEnabled = _кнУдалить.IsEnabled = редактируемый;
        if (_кнОстатки != null) _кнОстатки.IsVisible = _текущий.Вид == "РегистрНакопления";

        foreach (var к in колонки)
            _шапкаТаблицы.Children.Add(Шаблон.ЯчейкаШапки(к));

        if (!_база.ТаблицаЕсть(таблица))
        {
            _статус.Text = $"Таблица «{таблица}» не найдена. Выполните публикацию конфигурации в SQLite.";
            return;
        }

        var порядок = колонки.FirstOrDefault(к => к != "Проведен");
        var строки = _база.Выбрать(таблица, порядок);
        foreach (var строка in строки)
        {
            var панель = new StackPanel { Orientation = Avalonia.Layout.Orientation.Horizontal };
            foreach (var к in колонки)
            {
                var значение = строка.TryGetValue(к, out var v) ? v?.ToString() ?? "" : "";
                if (к == "Проведен")
                    значение = значение is "1" or "True" or "true" ? "✓" : "";
                var тип = ТипКолонки(_текущий, к);
                if (тип != null && тип.Contains("Ссылка."))
                    значение = _база.Представление(тип, значение);
                панель.Children.Add(Шаблон.Ячейка(значение));
            }
            _списокЗаписей.Items.Add(new ListBoxItem { Content = панель, Tag = строка });
        }
        _статус.Text = $"{_текущий.ПолноеИмя} — записей: {строки.Count}";
    }

    void ПоказатьОстатки()
    {
        if (_текущий == null || _текущий.Вид != "РегистрНакопления") return;
        new ОкноОстатков(_база, _текущий).ShowDialog(this);
    }

    Dictionary<string, object?>? ВыбраннаяСтрока() =>
        (_списокЗаписей.SelectedItem as ListBoxItem)?.Tag as Dictionary<string, object?>;

    async Task ДобавитьЗапись()
    {
        if (_текущий == null) return;
        var редактор = new РедакторЗаписи(_конфиг, _база, _текущий, null);
        if (await редактор.ShowDialog<bool>(this)) ПоказатьСписок();
    }

    async Task ИзменитьЗапись()
    {
        if (_текущий == null) return;
        var строка = ВыбраннаяСтрока();
        if (строка == null) return;
        var (_, _, _, редактируемый) = Схема(_текущий);
        if (!редактируемый) return;
        var редактор = new РедакторЗаписи(_конфиг, _база, _текущий, строка);
        if (await редактор.ShowDialog<bool>(this)) ПоказатьСписок();
    }

    async Task УдалитьЗапись()
    {
        if (_текущий == null) return;
        var строка = ВыбраннаяСтрока();
        if (строка == null) return;
        var (таблица, _, ключ, редактируемый) = Схема(_текущий);
        if (!редактируемый || ключ == "") return;

        var имя = строка.TryGetValue("Наименование", out var н) ? н?.ToString() :
                  строка.TryGetValue("Номер", out var номер) ? номер?.ToString() : "";
        var да = await Шаблон.Вопрос(this, $"Объект «{имя}» будет удален. Продолжить?");
        if (!да) return;

        var значениеКлюча = строка[ключ]?.ToString() ?? "";
        _база.Удалить(таблица, ключ, значениеКлюча);
        if (_текущий.Вид == "Документ") _база.УдалитьДвижения(значениеКлюча);
        // строки табличных частей документа/справочника
        foreach (var тч in _текущий.ТабличныеЧасти.Where(т => т.Таблица != null))
            _база.Удалить(тч.Таблица!, "Ссылка", значениеКлюча);
        ПоказатьСписок();
    }
}

public static class РасширенияКонфигурации
{
    public static string Представление(this Конфигурация к) =>
        string.IsNullOrWhiteSpace(к.Синоним) ? к.Имя : к.Синоним;
}
