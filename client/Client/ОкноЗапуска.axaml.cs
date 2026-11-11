using Avalonia;
using Avalonia.Controls;
using Avalonia.Markup.Xaml;
using System.Text.Json;

namespace Client;

/// <summary>Запись списка информационных баз (хранится в bases.json профиля пользователя).</summary>
public class ИнформационнаяБаза
{
    public string Имя { get; set; } = "";
    public string Путь { get; set; } = "";
}

/// <summary>Окно выбора информационной базы при запуске — по образцу окна «Запуск 1С:Предприятия».
/// Разметка — ОкноЗапуска.axaml, внешний вид — App.axaml.</summary>
public partial class ОкноЗапуска : Window
{
    readonly ListBox _список;
    readonly TextBlock _путьВнизу;
    List<ИнформационнаяБаза> _базы = new();

    static string ФайлСписка
    {
        get
        {
            var профиль = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            if (string.IsNullOrEmpty(профиль)) // среда без профиля (например, headless)
                профиль = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".config");
            return Path.Combine(профиль, "onec-mini", "bases.json");
        }
    }

    public ОкноЗапуска()
    {
        AvaloniaXamlLoader.Load(this);
        _список = this.FindControl<ListBox>("Список")!;
        _путьВнизу = this.FindControl<TextBlock>("ПутьВнизу")!;

        Кнопка("КнОткрыть", Открыть);
        Кнопка("КнКонфигуратор", ОткрытьКонфигуратор);
        Кнопка("КнДобавить", () => Правка(null));
        Кнопка("КнИзменить", () => Правка(Текущая()));
        Кнопка("КнУдалить", Удалить);
        Кнопка("КнВыход", () => { Close(); return Task.CompletedTask; });

        _список.DoubleTapped += async (_, _) => await Открыть();
        _список.SelectionChanged += (_, _) => ПоказатьПуть();

        if (Design.IsDesignMode)
        {
            // предпросмотрщик: показываем образец, не трогая файл профиля
            _базы.Add(new ИнформационнаяБаза { Имя = "Демонстрационная база (1С-мини)", Путь = @"D:\Base\Demo" });
            ОбновитьСписок();
            return;
        }

        ЗагрузитьСписок();
        ОбновитьСписок();
    }

    void Кнопка(string имя, Func<Task> действие) =>
        this.FindControl<Button>(имя)!.Click += async (_, _) => await действие();

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
        _список.ItemsSource = _базы.ToList(); // шаблон элемента — в ОкноЗапуска.axaml
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
        var естьМетаданные = Directory.Exists(Path.Combine(б.Путь, "metadata"));
        var естьБаза = File.Exists(Path.Combine(б.Путь, "data", "app.db"));
        if (!естьМетаданные && !естьБаза)
        {
            await Шаблон.Сообщение(this,
                "По указанному пути нет ни каталога metadata, ни файла data/app.db:\n" + б.Путь);
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
        catch { return Шаблон.Сообщение(this, "Не удалось запустить VS Code (команда `code` не найдена в PATH)."); }
        return Task.CompletedTask;
    }

    async Task Правка(ИнформационнаяБаза? база)
    {
        var новая = база == null;
        база ??= new ИнформационнаяБаза { Имя = "Новая база" };
        var диалог = new ДиалогБазы(база);
        var ок = await диалог.ShowDialog<bool>(this);
        if (!ок) return;
        if (новая) _базы.Add(база);
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
