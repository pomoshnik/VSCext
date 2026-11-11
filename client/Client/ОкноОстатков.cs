using Avalonia.Controls;
using OneC.Core;

namespace Client;

/// <summary>Остатки по регистру накопления: измерения + суммы ресурсов (Приход − Расход).</summary>
public class ОкноОстатков : Window
{
    public ОкноОстатков(База база, ОбъектМетаданных регистр)
    {
        Title = $"Остатки: {регистр.Представление}";
        Width = 560; SizeToContent = SizeToContent.Height;
        MaxHeight = 600;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;

        var панель = Шаблон.ПанельФормы();
        var колонки = регистр.Измерения.Concat(регистр.Ресурсы).ToList();

        var шапка = new StackPanel { Orientation = Avalonia.Layout.Orientation.Horizontal, Spacing = 4 };
        foreach (var к in колонки)
            шапка.Children.Add(Шаблон.ЯчейкаШапкиТЧ(string.IsNullOrEmpty(к.Синоним) ? к.Имя : к.Синоним));
        панель.Children.Add(шапка);

        var остатки = база.Остатки(регистр);
        foreach (var строка in остатки)
        {
            var р = new StackPanel { Orientation = Avalonia.Layout.Orientation.Horizontal, Spacing = 4 };
            foreach (var к in колонки)
            {
                var значение = строка.GetValueOrDefault(к.Имя)?.ToString() ?? "";
                if (к.Тип.Contains("Ссылка."))
                    значение = база.Представление(к.Тип, значение);
                р.Children.Add(Шаблон.ЯчейкаШапкиТЧ(значение));
            }
            панель.Children.Add(р);
        }

        if (остатки.Count == 0)
            панель.Children.Add(new TextBlock { Text = "Остатков нет — проведите документы." });

        панель.Children.Add(Шаблон.ПанельКнопокСправа(Шаблон.Кнопка("Закрыть", () => Close(), основная: true)));
        Content = new ScrollViewer { Content = панель };
    }
}
