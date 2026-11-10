using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Controls.Primitives;
using Avalonia.Styling;

namespace Client;

/// <summary>
/// Единый шаблон оформления клиента.
/// ВСЕ элементы форм (кнопки, поля, подписи, панели, списки, диалоги) создаются
/// только через фабрики этого класса, а все параметры внешнего вида собраны
/// в «Палитра» и «Метрика» — поменяв значение здесь, вы меняете весь клиент.
/// </summary>
public static class Шаблон
{
    // ------------------------------------------------------------------ ПАЛИТРА
    /// <summary>Все цвета клиента — в одном месте.</summary>
    public static class Палитра
    {
        public static readonly IBrush ФонФормы        = Brushes.White;
        public static readonly IBrush ЗаголовокРаздела = new SolidColorBrush(Color.Parse("#1a7f1a")); // зелёный, как в окне запуска 1С
        public static readonly IBrush Рамка           = Brushes.LightGray;
        public static readonly IBrush ТекстСтатуса    = Brushes.Gray;
        public static readonly IBrush ТекстОшибки     = Brushes.Firebrick;
        public static readonly IBrush Значок          = new SolidColorBrush(Color.Parse("#4a7ebb")); // синий значок базы
        public static readonly IBrush ФонШапки        = new SolidColorBrush(Color.Parse("#f6f3ea")); // светло-бежевый, как панели 1С
    }

    // ------------------------------------------------------------------ МЕТРИКА
    /// <summary>Все размеры и отступы клиента — в одном месте.</summary>
    public static class Метрика
    {
        public const double ШиринаПодписи   = 170;  // подпись поля на форме записи
        public const double ШиринаРедактора = 280;  // минимальная ширина поля ввода
        public const double ШиринаКолонки   = 160;  // колонка в списке записей
        public const double ШиринаКнопкиОк  = 90;   // кнопки ОК/Отмена в диалогах
        public static readonly Thickness ОтступФормы   = new(16);
        public static readonly Thickness ОтступПанели  = new(8, 6);
        public static readonly Thickness ОтступКнопки  = new(14, 6);
        public const double Интервал        = 8;    // между элементами формы
        public const double ИнтервалКнопок  = 6;    // между кнопками командной панели
    }

    // ------------------------------------------------------------------ ГЛОБАЛЬНЫЕ СТИЛИ
    /// <summary>Стили, применяемые ко всем окнам приложения (подключаются в App).</summary>
    public static IEnumerable<IStyle> ГлобальныеСтили()
    {
        yield return Стиль<Button>(Button.PaddingProperty, Метрика.ОтступКнопки);
        yield return Стиль<Window>(TemplatedControl.BackgroundProperty, Палитра.ФонФормы);
        yield return Стиль<ListBoxItem>(TemplatedControl.PaddingProperty, new Thickness(6, 3));
    }

    static Style Стиль<T>(AvaloniaProperty свойство, object? значение) where T : Control
    {
        var стиль = new Style(x => x.OfType<T>());
        стиль.Setters.Add(new Setter(свойство, значение));
        return стиль;
    }

    // ------------------------------------------------------------------ КНОПКИ
    /// <summary>Обычная кнопка командной панели.</summary>
    public static Button Кнопка(string текст, Func<Task> действие, bool основная = false)
    {
        var кн = new Button
        {
            Content = текст,
            FontWeight = основная ? FontWeight.Bold : FontWeight.Normal
        };
        кн.Click += async (_, _) => await действие();
        return кн;
    }

    public static Button Кнопка(string текст, Action действие, bool основная = false) =>
        Кнопка(текст, () => { действие(); return Task.CompletedTask; }, основная);

    /// <summary>Кнопка правого столбца (окно запуска): растянута на всю ширину.</summary>
    public static Button КнопкаСтолбца(string текст, Func<Task> действие, bool основная = false)
    {
        var кн = Кнопка(текст, действие, основная);
        кн.HorizontalAlignment = HorizontalAlignment.Stretch;
        кн.HorizontalContentAlignment = HorizontalAlignment.Center;
        return кн;
    }

    /// <summary>Кнопка диалога (ОК/Отмена/Да/Нет) — фиксированная ширина, текст по центру.</summary>
    public static Button КнопкаДиалога(string текст, Action действие)
    {
        var кн = Кнопка(текст, действие);
        кн.Width = Метрика.ШиринаКнопкиОк;
        кн.HorizontalContentAlignment = HorizontalAlignment.Center;
        return кн;
    }

    // ------------------------------------------------------------------ ПАНЕЛИ
    /// <summary>Горизонтальная командная панель (верх списка).</summary>
    public static StackPanel КоманднаяПанель(params Control[] кнопки)
    {
        var п = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            Spacing = Метрика.ИнтервалКнопок,
            Margin = Метрика.ОтступПанели
        };
        foreach (var к in кнопки) п.Children.Add(к);
        return п;
    }

    /// <summary>Панель кнопок внизу формы/диалога, выровненная вправо.</summary>
    public static StackPanel ПанельКнопокСправа(params Control[] кнопки)
    {
        var п = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            Spacing = Метрика.Интервал,
            HorizontalAlignment = HorizontalAlignment.Right,
            Margin = new Thickness(0, 10, 0, 0)
        };
        foreach (var к in кнопки) п.Children.Add(к);
        return п;
    }

    /// <summary>Вертикальная панель полей формы записи.</summary>
    public static StackPanel ПанельФормы() =>
        new() { Spacing = Метрика.Интервал, Margin = Метрика.ОтступФормы };

    /// <summary>Строка формы: подпись + редактор.</summary>
    public static StackPanel СтрокаФормы(Control подпись, Control редактор)
    {
        var п = new StackPanel { Orientation = Orientation.Horizontal, Spacing = Метрика.Интервал };
        п.Children.Add(подпись);
        п.Children.Add(редактор);
        return п;
    }

    /// <summary>Рамка вокруг панели (цвет из палитры).</summary>
    public static Border Рамка(Control содержимое, Thickness толщина) =>
        new() { BorderBrush = Палитра.Рамка, BorderThickness = толщина, Child = содержимое };

    // ------------------------------------------------------------------ ТЕКСТЫ
    /// <summary>Подпись поля на форме записи.</summary>
    public static TextBlock Подпись(string текст) => new()
    {
        Text = текст,
        Width = Метрика.ШиринаПодписи,
        VerticalAlignment = VerticalAlignment.Center
    };

    /// <summary>Зелёный заголовок раздела (как «Информационные базы»).</summary>
    public static TextBlock ЗаголовокРаздела(string текст) => new()
    {
        Text = текст,
        Foreground = Палитра.ЗаголовокРаздела,
        Margin = new Thickness(12, 10, 12, 4)
    };

    /// <summary>Серый текст статуса/пути внизу окна.</summary>
    public static TextBlock Статус() => new()
    {
        Margin = Метрика.ОтступПанели,
        Foreground = Палитра.ТекстСтатуса,
        TextTrimming = TextTrimming.CharacterEllipsis
    };

    /// <summary>Текст ошибок бизнес-логики на форме записи.</summary>
    public static TextBlock ТекстОшибки() => new()
    {
        Foreground = Палитра.ТекстОшибки,
        TextWrapping = TextWrapping.Wrap,
        Margin = new Thickness(0, 6, 0, 0),
        IsVisible = false
    };

    /// <summary>Ячейка шапки списка записей.</summary>
    public static TextBlock ЯчейкаШапки(string текст) => new()
    {
        Text = текст,
        Width = Метрика.ШиринаКолонки,
        FontWeight = FontWeight.SemiBold,
        TextTrimming = TextTrimming.CharacterEllipsis
    };

    /// <summary>Ячейка строки списка записей.</summary>
    public static TextBlock Ячейка(string текст) => new()
    {
        Text = текст,
        Width = Метрика.ШиринаКолонки,
        TextTrimming = TextTrimming.CharacterEllipsis
    };

    // ------------------------------------------------------------------ РЕДАКТОРЫ ПОЛЕЙ
    /// <summary>Поле ввода строки/числа/даты.</summary>
    public static TextBox ПолеВвода() => new() { MinWidth = Метрика.ШиринаРедактора };

    /// <summary>Флажок (Булево).</summary>
    public static CheckBox Флажок() => new();

    /// <summary>Поле выбора ссылки (комбо-список).</summary>
    public static ComboBox ПолеВыбора() => new()
    {
        MinWidth = Метрика.ШиринаРедактора,
        HorizontalAlignment = HorizontalAlignment.Stretch
    };

    /// <summary>Элемент списка информационных баз: значок + имя.</summary>
    public static StackPanel ЭлементСпискаБаз(string имя)
    {
        var п = new StackPanel { Orientation = Orientation.Horizontal, Spacing = Метрика.Интервал, Margin = new Thickness(4, 3) };
        п.Children.Add(new TextBlock { Text = "🗔", Foreground = Палитра.Значок });
        п.Children.Add(new TextBlock { Text = имя });
        return п;
    }

    // ------------------------------------------------------------------ ДИАЛОГИ
    /// <summary>Стандартное окно-диалог с содержимым.</summary>
    public static Window Диалог(string заголовок, Control содержимое, double ширина = 420)
    {
        return new Window
        {
            Title = заголовок,
            Width = ширина,
            SizeToContent = SizeToContent.Height,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Content = содержимое
        };
    }

    /// <summary>Вопрос «Да/Нет».</summary>
    public static async Task<bool> Вопрос(Window владелец, string текст)
    {
        var панель = new StackPanel { Margin = Метрика.ОтступФормы };
        панель.Children.Add(new TextBlock { Text = текст, TextWrapping = TextWrapping.Wrap });
        var окно = Диалог("1С-мини", панель);
        var да = КнопкаДиалога("Да", () => окно.Close(true));
        var нет = КнопкаДиалога("Нет", () => окно.Close(false));
        панель.Children.Add(ПанельКнопокСправа(да, нет));
        return await окно.ShowDialog<bool>(владелец);
    }

    /// <summary>Сообщение с кнопкой ОК.</summary>
    public static async Task Сообщение(Window владелец, string текст)
    {
        var панель = new StackPanel { Margin = Метрика.ОтступФормы, Spacing = Метрика.Интервал };
        панель.Children.Add(new TextBlock { Text = текст, TextWrapping = TextWrapping.Wrap });
        var окно = Диалог("1С-мини", панель);
        var ок = КнопкаДиалога("ОК", () => окно.Close());
        ок.HorizontalAlignment = HorizontalAlignment.Center;
        панель.Children.Add(ок);
        await окно.ShowDialog(владелец);
    }
}
