using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Themes.Fluent;
using OneC.Core;

namespace Client;

public class App : Application
{
    public override void Initialize()
    {
        Styles.Add(new FluentTheme());
        foreach (var стиль in Шаблон.ГлобальныеСтили()) Styles.Add(стиль);
        RequestedThemeVariant = Avalonia.Styling.ThemeVariant.Light;
    }

    public override void OnFrameworkInitializationCompleted()
    {
        // Регистрируем модули бизнес-логики из сборки BusinessLogic
        РеестрМодулей.Инициализировать(typeof(BusinessLogic.Modules.Справочник_Номенклатура).Assembly);

        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            var args = desktop.Args ?? Array.Empty<string>();
            // путь базы в аргументах — открываем сразу (для запуска из отладчика/конфигуратора)
            if (args.Length > 0 && Directory.Exists(Path.Combine(args[0], "metadata")))
                desktop.MainWindow = new MainWindow(Path.GetFullPath(args[0]));
            else
                desktop.MainWindow = new ОкноЗапуска(); // окно выбора базы, как в 1С
        }
        base.OnFrameworkInitializationCompleted();
    }
}
