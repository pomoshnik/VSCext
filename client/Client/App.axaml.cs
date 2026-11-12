using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using OneC.Core;

namespace Client;

public partial class App : Application
{
    public override void Initialize() => AvaloniaXamlLoader.Load(this);

    public override void OnFrameworkInitializationCompleted()
    {
        // Модули бизнес-логики загружаются из базы (таблица _Сборки) при её открытии — см. База.cs

        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            var args = desktop.Args ?? Array.Empty<string>();
            // путь базы в аргументах — открываем сразу (для запуска из отладчика/конфигуратора)
            if (args.Length > 0 && (Directory.Exists(Path.Combine(args[0], "metadata"))
                                  || File.Exists(Path.Combine(args[0], "data", "app.db"))))
                desktop.MainWindow = new MainWindow(Path.GetFullPath(args[0]));
            else
                desktop.MainWindow = new ОкноЗапуска(); // окно выбора базы, как в 1С
        }
        base.OnFrameworkInitializationCompleted();
    }
}
