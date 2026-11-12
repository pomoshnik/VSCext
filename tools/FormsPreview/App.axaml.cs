using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;

namespace FormsPreview;

public partial class App : Application
{
    public override void Initialize() => AvaloniaXamlLoader.Load(this);

    public override void OnFrameworkInitializationCompleted()
    {
        // Запуск вне превьюера: показать первую найденную произвольную форму конфигурации
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime рабочийСтол)
        {
            var типФормы = typeof(BusinessLogic.Forms.ФормаСклада);
            рабочийСтол.MainWindow = (Avalonia.Controls.Window)Activator.CreateInstance(типФормы)!;
        }
        base.OnFrameworkInitializationCompleted();
    }
}
