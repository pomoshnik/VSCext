using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using OneC.Core;

namespace Client;

public class MainWindow : Window
{
    readonly string _корень;
    readonly Конфигурация _конфиг;
    readonly База _база;

    readonly TreeView _дерево = new() { Margin = new Thickness(4) };
    readonly StackPanel _шапкаТаблицы = new() { Orientation = Orientation.Horizontal, Margin = new Thickness(8, 4) };
    readonly ListBox _списокЗаписей = new();
    readonly TextBlock _статус = new() { Margin = new Thickness(8, 4), Foreground = Brushes.Gray };
    readonly Button _кнДобавить, _кнИзменить, _кнУдалить, _кнОбновить;

    ОбъектМетаданных? _текущий;
    List<string> _колонки = new();

    public MainWindow(string кореньПроекта)
    {
        _корень = кореньПроекта;
        _конфиг = ЗагрузчикМетаданных.Загрузить(Path.Combine(_корень, "metadata"));
        var файлБД = Path.Combine(_корень, "data", "app.db");
        _база = new База(файлБД);

        Title = $"{_конфиг.Представление()} — 1С-мини клиент";
        Width = 1100; Height = 700;

        _кнДобавить = Кнопка("Добавить", ДобавитьЗапись);
        _кнИзменить = Кнопка("Изменить", ИзменитьЗапись);
        _кнУдалить = Кнопка("Удалить", УдалитьЗапись);
        _кнОбновить = Кнопка("Обновить", () => { ПоказатьСписок(); return Task.CompletedTask; });

        var панельКнопок = new StackPanel
        {
            Orientation = Orientation.Horizontal, Spacing = 6, Margin = new Thickness(8, 6)
        };
        панельКнопок.Children.Add(_кнДобавить);
        панельКнопок.Children.Add(_кнИзменить);
        панельКнопок.Children.Add(_кнУдалить);
        панельКнопок.Children.Add(_кнОбновить);

        var право = new DockPanel();
        DockPanel.SetDock(панельКнопок, Dock.Top);
        DockPanel.SetDock(_шапкаТаблицы, Dock.Top);
        DockPanel.SetDock(_статус, Dock.Bottom);
        право.Children.Add(панельКнопок);
        право.Children.Add(_шапкаТаблицы);
        право.Children.Add(_статус);
        право.Children.Add(new ScrollViewer { Content = _списокЗаписей });

        var сетка = new Grid { ColumnDefinitions = new ColumnDefinitions("280,4,*") };
        var левоРамка = new Border
        {
            BorderBrush = Brushes.LightGray, BorderThickness = new Thickness(0, 0, 1, 0),
            Child = new ScrollViewer { Content = _дерево }
        };
        Grid.SetColumn(левоРамка, 0);
        var разделитель = new GridSplitter { Background = Brushes.Transparent };
        Grid.SetColumn(разделитель, 1);
        Grid.SetColumn(право, 2);
        сетка.Children.Add(левоРамка);
        сетка.Children.Add(разделитель);
        сетка.Children.Add(право);
        Content = сетка;

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

    static Button Кнопка(string текст, Func<Task> действие)
    {
        var б = new Button { Content = текст, Padding = new Thickness(14, 6) };
        б.Click += async (_, _) => await действие();
        return б;
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

        foreach (var к in колонки)
            _шапкаТаблицы.Children.Add(new TextBlock
            {
                Text = к, Width = 160, FontWeight = FontWeight.SemiBold,
                TextTrimming = TextTrimming.CharacterEllipsis
            });

        if (!_база.ТаблицаЕсть(таблица))
        {
            _статус.Text = $"Таблица «{таблица}» не найдена. Выполните публикацию конфигурации в SQLite.";
            return;
        }

        var строки = _база.Выбрать(таблица, колонки.FirstOrDefault());
        foreach (var строка in строки)
        {
            var панель = new StackPanel { Orientation = Orientation.Horizontal };
            foreach (var к in колонки)
            {
                var значение = строка.TryGetValue(к, out var v) ? v?.ToString() ?? "" : "";
                var тип = ТипКолонки(_текущий, к);
                if (тип != null && тип.Contains("Ссылка."))
                    значение = _база.Представление(тип, значение);
                панель.Children.Add(new TextBlock
                {
                    Text = значение, Width = 160,
                    TextTrimming = TextTrimming.CharacterEllipsis
                });
            }
            _списокЗаписей.Items.Add(new ListBoxItem { Content = панель, Tag = строка });
        }
        _статус.Text = $"{_текущий.ПолноеИмя} — записей: {строки.Count}";
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
        var да = await Диалоги.Вопрос(this, $"Объект «{имя}» будет удален. Продолжить?");
        if (!да) return;

        _база.Удалить(таблица, ключ, строка[ключ]?.ToString() ?? "");
        ПоказатьСписок();
    }
}

public static class РасширенияКонфигурации
{
    public static string Представление(this Конфигурация к) =>
        string.IsNullOrWhiteSpace(к.Синоним) ? к.Имя : к.Синоним;
}
