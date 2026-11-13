using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;

namespace Client;

/// <summary>
/// Фабрики элементов для ГЕНЕРИРУЕМЫХ форм (редактор записи строит поля по метаданным,
/// поэтому его разметку нельзя описать статично в AXAML).
/// Внешний вид здесь НЕ задаётся: каждый элемент получает класс стиля,
/// а все стили (цвета, размеры, отступы) настраиваются в одном месте — App.axaml.
/// </summary>
public static class Шаблон
{
    static T С<T>(T элемент, params string[] классы) where T : Control
    {
        foreach (var к in классы) элемент.Classes.Add(к);
        return элемент;
    }

    // ------------------------------------------------------------------ кнопки
    public static Button Кнопка(string текст, Func<Task> действие, bool основная = false)
    {
        var кн = new Button { Content = текст };
        if (основная) кн.Classes.Add("primary");
        кн.Click += async (_, _) => await действие();
        return кн;
    }

    public static Button Кнопка(string текст, Action действие, bool основная = false) =>
        Кнопка(текст, () => { действие(); return Task.CompletedTask; }, основная);

    /// <summary>Кнопка с выпадающим меню (например, «Перейти» в форме записи).</summary>
    public static Button КнопкаМеню(string текст, IEnumerable<MenuItem> пункты)
    {
        var кнопка = new Button { Content = текст + " ▾" };
        кнопка.Flyout = new MenuFlyout { ItemsSource = пункты.ToList() };
        return кнопка;
    }

    public static Button КнопкаДиалога(string текст, Action действие) =>
        С(Кнопка(текст, действие), "dialog");

    // ------------------------------------------------------------------ панели
    public static StackPanel ПанельФормы() => С(new StackPanel(), "formPanel");

    public static StackPanel СтрокаФормы(Control подпись, Control редактор)
    {
        var п = С(new StackPanel(), "formRow");
        п.Children.Add(подпись);
        п.Children.Add(редактор);
        return п;
    }

    public static StackPanel ПанельКнопокСправа(params Control[] кнопки)
    {
        var п = С(new StackPanel(), "buttonsRight");
        foreach (var к in кнопки) п.Children.Add(к);
        return п;
    }

    // ------------------------------------------------------------------ тексты
    public static TextBlock Подпись(string текст) => С(new TextBlock { Text = текст }, "fieldLabel");
    public static TextBlock ТекстОшибки()
    {
        var т = С(new TextBlock(), "error");
        т.IsVisible = false;
        return т;
    }
    public static TextBlock ЯчейкаШапки(string текст) => С(new TextBlock { Text = текст }, "headerCell");
    public static TextBlock ЯчейкаШапкиИконки() => С(new TextBlock(), "iconHeaderCell");

    /// <summary>
    /// Пиктограмма состояния строки списка (как в 1С): иконка документа или элемента справочника;
    /// проведён — зелёная галочка внизу, помечен на удаление — красный крестик поверх.
    /// </summary>
    public static Control ИконкаСтроки(string вид, bool проведен, bool пометка)
    {
        var холст = new Canvas { Width = 16, Height = 16 };
        void Фигура(string контур, string? заливка, string? обводка, double толщина = 0.9) =>
            холст.Children.Add(new Avalonia.Controls.Shapes.Path
            {
                Data = Avalonia.Media.Geometry.Parse(контур),
                Fill = заливка == null ? null : Avalonia.Media.Brush.Parse(заливка),
                Stroke = обводка == null ? null : Avalonia.Media.Brush.Parse(обводка),
                StrokeThickness = обводка == null ? 0 : толщина,
                StrokeJoin = Avalonia.Media.PenLineJoin.Round,
                StrokeLineCap = Avalonia.Media.PenLineCap.Round
            });

        if (вид == "Документ")
        {
            // лист с загнутым уголком — как иконка документа в дереве конфигурации
            Фигура("M3.5,1.5 L10.5,1.5 L13,4 L13,14.5 L3.5,14.5 Z", "#FFFFFF", "#2E6DA4");
            Фигура("M10.5,1.5 L10.5,4 L13,4 Z", "#DCEEFB", "#2E6DA4");
            Фигура("M5,6 h6 v1.1 h-6 Z M5,8.4 h6 v1.1 h-6 Z M5,10.8 h4 v1.1 h-4 Z", "#5B9BD5", null);
        }
        else
        {
            // карточка — как иконка справочника в дереве конфигурации
            Фигура("M2.5,2 h11 v12 h-11 Z", "#FFFFFF", "#B8860B");
            Фигура("M2.5,2 h11 v3 h-11 Z", "#F6C445", "#B8860B");
            Фигура("M4.5,6.6 h7 v1.1 h-7 Z M4.5,9 h7 v1.1 h-7 Z M4.5,11.4 h4.5 v1.1 h-4.5 Z", "#5B9BD5", null);
        }
        if (проведен && !пометка)
            Фигура("M6,10 L9,13 L14,7", null, "#1E9E3E", 2.2);
        if (пометка)
            Фигура("M3,3 L13,13 M13,3 L3,13", null, "#D64540", 1.8);

        return С(new Border { Child = холст, VerticalAlignment = VerticalAlignment.Center }, "iconCell");
    }
    public static TextBlock Ячейка(string текст) => С(new TextBlock { Text = текст }, "cell");

    // ------------------------------------------------------------------ табличные части
    public static TextBlock ЗаголовокТЧ(string текст) => С(new TextBlock { Text = текст }, "vtTitle");
    public static TextBlock ЯчейкаШапкиТЧ(string текст) => С(new TextBlock { Text = текст }, "vtHeaderCell");
    public static TextBox ПолеЯчейки() => С(new TextBox(), "cellEdit");
    public static ComboBox ВыборЯчейки() => С(new ComboBox(), "cellEdit");
    public static Button КнопкаСтроки(string текст, Action действие) => С(Кнопка(текст, действие), "rowBtn");

    // ------------------------------------------------------------------ редакторы полей
    // --- Группы и страницы на форме (дерево элементов из дизайнера форм) ---
    public static TextBlock ЗаголовокГруппы(string текст) =>
        С(new TextBlock { Text = текст, FontWeight = Avalonia.Media.FontWeight.Bold, Margin = new Thickness(0, 8, 0, 2) }, "groupTitle");
    public static StackPanel ПанельГруппы(bool горизонтально) => С(new StackPanel
    {
        Orientation = горизонтально ? Orientation.Horizontal : Orientation.Vertical,
        Spacing = горизонтально ? 16 : 4
    }, "formGroup");
    public static TabControl Вкладки() => С(new TabControl { Margin = new Thickness(0, 4, 0, 4) }, "formTabs");
    public static StackPanel ПанельСтраницы() => С(new StackPanel { Spacing = 4, Margin = new Thickness(0, 6, 0, 0) }, "formPage");
    public static TabItem Вкладка(string заголовок, Control содержимое) => new() { Header = заголовок, Content = содержимое };

    public static TextBox ПолеВвода() => С(new TextBox(), "field");
    public static CheckBox Флажок() => new();

    /// <summary>Декорация-надпись на форме (оформление — класс decoration в App.axaml).</summary>
    public static TextBlock Декорация(string текст) => С(new TextBlock
    {
        Text = текст,
        TextWrapping = Avalonia.Media.TextWrapping.Wrap,
        Foreground = Avalonia.Media.Brushes.DimGray,
        Margin = new Thickness(0, 6, 0, 2)
    }, "decoration");

    // --- Поведение полей по типу данных (как в 1С) --------------------------
    /// <summary>Поле даты с календарём.</summary>
    public static CalendarDatePicker ПолеДаты() => С(new CalendarDatePicker(), "dateField");

    /// <summary>Поле времени (ЧЧ:ММ:СС) рядом с датой.</summary>
    public static TextBox ПолеВремени() => С(new TextBox { Width = 80, Watermark = "00:00:00" }, "timeField");

    /// <summary>Числовое поле: выравнивание вправо, принимает только цифры, разделитель и минус.</summary>
    public static TextBox ЧисловоеПоле() => Числовое(С(new TextBox { TextAlignment = Avalonia.Media.TextAlignment.Right }, "numField"));

    /// <summary>Числовая ячейка табличной части.</summary>
    public static TextBox ЧисловаяЯчейка() => Числовое(С(new TextBox { TextAlignment = Avalonia.Media.TextAlignment.Right }, "cellEdit"));

    static TextBox Числовое(TextBox поле)
    {
        поле.TextChanged += (_, _) =>
        {
            var т = поле.Text ?? "";
            var чист = new string(т.Where(c => char.IsDigit(c) || c is '.' or ',' or '-').ToArray());
            if (чист == т) return;
            var курсор = поле.CaretIndex;
            поле.Text = чист;
            поле.CaretIndex = Math.Max(0, курсор - (т.Length - чист.Length));
        };
        return поле;
    }
    public static ComboBox ПолеВыбора() => С(new ComboBox(), "field");

    // ------------------------------------------------------------------ динамические диалоги
    public static Window Диалог(string заголовок, Control содержимое, double ширина = 420) => new()
    {
        Title = заголовок,
        Width = ширина,
        SizeToContent = SizeToContent.Height,
        WindowStartupLocation = WindowStartupLocation.CenterOwner,
        Content = содержимое
    };

    public static async Task<bool> Вопрос(Window владелец, string текст)
    {
        var панель = ПанельФормы();
        панель.Children.Add(new TextBlock { Text = текст, TextWrapping = Avalonia.Media.TextWrapping.Wrap });
        var окно = Диалог("1С-мини", панель);
        панель.Children.Add(ПанельКнопокСправа(
            КнопкаДиалога("Да", () => окно.Close(true)),
            КнопкаДиалога("Нет", () => окно.Close(false))));
        return await окно.ShowDialog<bool>(владелец);
    }

    public static async Task Сообщение(Window владелец, string текст)
    {
        var панель = ПанельФормы();
        панель.Children.Add(new TextBlock { Text = текст, TextWrapping = Avalonia.Media.TextWrapping.Wrap });
        var окно = Диалог("1С-мини", панель);
        var ок = КнопкаДиалога("ОК", () => окно.Close());
        ок.HorizontalAlignment = Avalonia.Layout.HorizontalAlignment.Center;
        панель.Children.Add(ок);
        await окно.ShowDialog(владелец);
    }
}
