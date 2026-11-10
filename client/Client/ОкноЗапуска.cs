using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using System.Text.Json;

namespace Client;

/// <summary>Запись списка информационных баз (хранится в bases.json профиля пользователя).</summary>
public class ИнформационнаяБаза
{
    public string Имя { get; set; } = "";
    public string Путь { get; set; } = "";
}

/// <summary>Окно выбора информационной базы при запуске — по образцу окна «Запуск 1С:Предприятия».</summary>
public class ОкноЗапуска : Window
{
    readonly ListBox _список = new() { Background = Brushes.White };
    readonly TextBlock _путьВнизу = Шаблон.Статус();
    List<ИнформационнаяБаза> _базы = new();

    static string ФайлСписка => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "onec-mini", "bases.json");

    public ОкноЗапуска()
    {
        Title = "Запуск 1С-мини";
        Width = 620; Height = 460;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        CanResize = true;

        var заголовок = Шаблон.ЗаголовокРаздела("Информационные базы");

        // --- кнопки справа ---
        var кнОткрыть = Кнопка("1С-мини", Открыть, жирная: true);
        var кнКонфигуратор = Кнопка("Конфигуратор", ОткрытьКонфигуратор);
        var кнДобавить = Кнопка("Добавить…", () => Правка(null));
        var кнИзменить = Кнопка("Изменить…", () => Правка(Текущая()));
        var кнУдалить = Кнопка("Удалить", Удалить);
        var кнВыход = Кнопка("Выход", () => { Close(); return Task.CompletedTask; });

        var правыйСтолбец = new DockPanel { Margin = new Thickness(0, 10, 12, 10), Width = 150 };
        var верхние = new StackPanel { Spacing = 6 };
        верхние.Children.Add(кнОткрыть);
        верхние.Children.Add(кнКонфигуратор);
        верхние.Children.Add(new Border { Height = 14 });
        верхние.Children.Add(кнДобавить);
        верхние.Children.Add(кнИзменить);
        верхние.Children.Add(кнУдалить);
        DockPanel.SetDock(кнВыход, Dock.Bottom);
        правыйСтолбец.Children.Add(кнВыход);
        правыйСтолбец.Children.Add(верхние);

        // --- список баз ---
        _список.DoubleTapped += async (_, _) => await Открыть();
        _список.SelectionChanged += (_, _) => ПоказатьПуть();
        var рамкаСписка = Шаблон.Рамка(new ScrollViewer { Content = _список }, new Thickness(1));
        рамкаСписка.Margin = new Thickness(12, 0, 0, 0);

        var сетка = new DockPanel();
        DockPanel.SetDock(заголовок, Dock.Top);
        DockPanel.SetDock(_путьВнизу, Dock.Bottom);
        DockPanel.SetDock(правыйСтолбец, Dock.Right);
        сетка.Children.Add(заголовок);
        сетка.Children.Add(_путьВнизу);
        сетка.Children.Add(правыйСтолбец);
        сетка.Children.Add(рамкаСписка);
        Content = сетка;

        ЗагрузитьСписок();
        ОбновитьСписок();
    }

    // ------------------------------------------------------------------ список

    void ЗагрузитьСписок()
    {
        try
        {
            if (File.Exists(ФайлСписка))
                _базы = JsonSerializer.Deserialize<List<ИнформационнаяБаза>>(File.ReadAllText(ФайлСписка)) ?? new();
        }
        catch { _базы = new(); }

        if (_базы.Count == 0)
        {
            // первая регистрация: найденный рядом проект — как демо-база
            var корень = НайтиКореньПроекта();
            if (корень != null)
                _базы.Add(new ИнформационнаяБаза { Имя = "Демонстрационная база (1С-мини)", Путь = корень });
            СохранитьСписок();
        }
    }

    void СохранитьСписок()
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(ФайлСписка)!);
            File.WriteAllText(ФайлСписка, JsonSerializer.Serialize(_базы,
                new JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping }));
        }
        catch { /* профиль недоступен — работаем без сохранения */ }
    }

    void ОбновитьСписок(int выбрать = -1)
    {
        var старый = выбрать >= 0 ? выбрать : _список.SelectedIndex;
        _список.ItemsSource = _базы.Select(б => Шаблон.ЭлементСпискаБаз(б.Имя)).ToList();
        if (_базы.Count > 0)
            _список.SelectedIndex = Math.Clamp(старый < 0 ? 0 : старый, 0, _базы.Count - 1);
        ПоказатьПуть();
    }

    ИнформационнаяБаза? Текущая() =>
        _список.SelectedIndex >= 0 && _список.SelectedIndex < _базы.Count ? _базы[_список.SelectedIndex] : null;

    void ПоказатьПуть() => _путьВнизу.Text = Текущая() is { } б ? $"File=\"{б.Путь}\";" : "";

    // ------------------------------------------------------------------ действия

    async Task Открыть()
    {
        var б = Текущая();
        if (б == null) return;
        if (!Directory.Exists(Path.Combine(б.Путь, "metadata")))
        {
            await Сообщение("Не найден каталог metadata по пути:\n" + б.Путь);
            return;
        }
        var окно = new MainWindow(б.Путь);
        if (Application.Current?.ApplicationLifetime is Avalonia.Controls.ApplicationLifetimes.IClassicDesktopStyleApplicationLifetime desktop)
            desktop.MainWindow = окно;
        окно.Show();
        Close();
    }

    Task ОткрытьКонфигуратор()
    {
        var б = Текущая();
        if (б == null) return Task.CompletedTask;
        try
        {
            // конфигуратор — VS Code с открытым каталогом базы
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = OperatingSystem.IsWindows() ? "code.cmd" : "code",
                Arguments = $"\"{б.Путь}\"",
                UseShellExecute = true
            });
        }
        catch { return Сообщение("Не удалось запустить VS Code (команда `code` не найдена в PATH)."); }
        return Task.CompletedTask;
    }

    async Task Правка(ИнформационнаяБаза? база)
    {
        var новая = база == null;
        if (новая && база == null) база = new ИнформационнаяБаза { Имя = "Новая база" };
        var диалог = new ДиалогБазы(база!);
        var ок = await диалог.ShowDialog<bool>(this);
        if (!ок) return;
        if (новая) _базы.Add(база!);
        СохранитьСписок();
        ОбновитьСписок(новая ? _базы.Count - 1 : _список.SelectedIndex);
    }

    Task Удалить()
    {
        var i = _список.SelectedIndex;
        if (i < 0 || i >= _базы.Count) return Task.CompletedTask;
        _базы.RemoveAt(i);
        СохранитьСписок();
        ОбновитьСписок(Math.Max(0, i - 1));
        return Task.CompletedTask;
    }

    // ------------------------------------------------------------------ вспомогательное

    Button Кнопка(string текст, Func<Task> действие, bool жирная = false) =>
        Шаблон.КнопкаСтолбца(текст, действие, жирная);

    Task Сообщение(string текст) => Шаблон.Сообщение(this, текст);

    internal static string? НайтиКореньПроекта()
    {
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
        return null;
    }
}

/// <summary>Диалог добавления/изменения информационной базы (имя + путь к каталогу).</summary>
public class ДиалогБазы : Window
{
    public ДиалогБазы(ИнформационнаяБаза база)
    {
        Title = "Информационная база";
        Width = 520; SizeToContent = SizeToContent.Height;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;

        var имя = Шаблон.ПолеВвода();
        имя.Text = база.Имя;
        var путь = Шаблон.ПолеВвода();
        путь.Text = база.Путь;
        путь.Watermark = "Каталог с metadata/ и data/";

        Button кнОбзор = null!;
        кнОбзор = Шаблон.Кнопка("Обзор…", async () =>
        {
            var выбор = await StorageProvider.OpenFolderPickerAsync(
                new Avalonia.Platform.Storage.FolderPickerOpenOptions { Title = "Каталог информационной базы" });
            if (выбор.Count > 0) путь.Text = выбор[0].Path.LocalPath;
        });
        var строкаПути = new DockPanel();
        DockPanel.SetDock(кнОбзор, Dock.Right);
        кнОбзор.Margin = new Thickness(6, 0, 0, 0);
        строкаПути.Children.Add(кнОбзор);
        строкаПути.Children.Add(путь);

        var кнОк = Шаблон.КнопкаДиалога("ОК", () =>
        {
            база.Имя = string.IsNullOrWhiteSpace(имя.Text) ? "Без имени" : имя.Text!.Trim();
            база.Путь = (путь.Text ?? "").Trim();
            Close(true);
        });
        var кнОтмена = Шаблон.КнопкаДиалога("Отмена", () => Close(false));
        var кнопки = Шаблон.ПанельКнопокСправа(кнОк, кнОтмена);
        кнопки.Margin = new Thickness(0);

        var панель = new StackPanel { Margin = new Thickness(16), Spacing = 8 };
        панель.Children.Add(new TextBlock { Text = "Наименование информационной базы:" });
        панель.Children.Add(имя);
        панель.Children.Add(new TextBlock { Text = "Каталог информационной базы:", Margin = new Thickness(0, 8, 0, 0) });
        панель.Children.Add(строкаПути);
        панель.Children.Add(new Border { Height = 8 });
        панель.Children.Add(кнопки);
        Content = панель;
    }
}
