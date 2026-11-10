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
        RequestedThemeVariant = Avalonia.Styling.ThemeVariant.Light;
    }

    public override void OnFrameworkInitializationCompleted()
    {
        // Регистрируем модули бизнес-логики из сборки BusinessLogic
        РеестрМодулей.Инициализировать(typeof(BusinessLogic.Modules.Справочник_Номенклатура).Assembly);

        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            var корень = НайтиКореньПроекта(desktop.Args ?? Array.Empty<string>());
            desktop.MainWindow = new MainWindow(корень);
        }
        base.OnFrameworkInitializationCompleted();
    }

    static string НайтиКореньПроекта(string[] args)
    {
        if (args.Length > 0 && Directory.Exists(Path.Combine(args[0], "metadata")))
            return Path.GetFullPath(args[0]);

        foreach (var старт in new[] { Environment.CurrentDirectory, AppContext.BaseDirectory })
        {
            var каталог = new DirectoryInfo(старт);
            while (каталог != null)
            {
                if (Directory.Exists(Path.Combine(каталог.FullName, "metadata")))
                    return каталог.FullName;
                каталог = каталог.Parent;
            }
        }
        return Environment.CurrentDirectory;
    }
}
