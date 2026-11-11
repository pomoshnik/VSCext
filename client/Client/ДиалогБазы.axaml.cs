using Avalonia.Controls;
using Avalonia.Markup.Xaml;

namespace Client;

/// <summary>Диалог добавления/изменения информационной базы.
/// Разметка — ДиалогБазы.axaml, внешний вид — App.axaml.</summary>
public partial class ДиалогБазы : Window
{
    /// <summary>Конструктор для предпросмотрщика (дизайнера).</summary>
    public ДиалогБазы() : this(new ИнформационнаяБаза()) { }

    public ДиалогБазы(ИнформационнаяБаза база)
    {
        AvaloniaXamlLoader.Load(this);
        var имя = this.FindControl<TextBox>("ПолеИмя")!;
        var путь = this.FindControl<TextBox>("ПолеПуть")!;
        имя.Text = база.Имя;
        путь.Text = база.Путь;

        this.FindControl<Button>("КнОбзор")!.Click += async (_, _) =>
        {
            var выбор = await StorageProvider.OpenFolderPickerAsync(
                new Avalonia.Platform.Storage.FolderPickerOpenOptions { Title = "Каталог информационной базы" });
            if (выбор.Count > 0) путь.Text = выбор[0].Path.LocalPath;
        };
        this.FindControl<Button>("КнОк")!.Click += (_, _) =>
        {
            база.Имя = string.IsNullOrWhiteSpace(имя.Text) ? "Без имени" : имя.Text!.Trim();
            база.Путь = (путь.Text ?? "").Trim();
            Close(true);
        };
        this.FindControl<Button>("КнОтмена")!.Click += (_, _) => Close(false);
    }
}
