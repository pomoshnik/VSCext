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
