using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using OneC.Core;

namespace Client;

/// <summary>Автогенерируемая форма элемента/документа (как управляемая форма 1С).</summary>
public class РедакторЗаписи : Window
{
    readonly База _база;
    readonly ОбъектМетаданных _объект;
    readonly Dictionary<string, object?>? _исходная;
    readonly Dictionary<string, Func<object?>> _чтение = new();
    readonly Dictionary<string, Action<object?>> _запись = new();
    readonly TextBlock _ошибки = new()
    {
        Foreground = Brushes.Firebrick, TextWrapping = TextWrapping.Wrap,
        Margin = new Thickness(0, 6, 0, 0), IsVisible = false
    };

    public РедакторЗаписи(Конфигурация конфиг, База база, ОбъектМетаданных объект, Dictionary<string, object?>? строка)
    {
        _база = база; _объект = объект; _исходная = строка;

        var новый = строка == null;
        Title = $"{объект.Представление} ({(новый ? "создание" : "изменение")})";
        Width = 520; SizeToContent = SizeToContent.Height;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;

        var поляПанель = new StackPanel { Spacing = 8, Margin = new Thickness(16) };

        void Поле(string имя, string подпись, string тип, bool толькоПросмотр = false)
        {
            var метка = new TextBlock { Text = подпись, Width = 170, VerticalAlignment = VerticalAlignment.Center };
            Control редактор;

            if (тип == "Булево")
            {
                var флажок = new CheckBox();
                _чтение[имя] = () => флажок.IsChecked == true ? 1 : 0;
                _запись[имя] = v => флажок.IsChecked = v?.ToString() is "1" or "True" or "true";
                редактор = флажок;
            }
            else if (тип.Contains("Ссылка."))
            {
                var комбо = new ComboBox { MinWidth = 280, HorizontalAlignment = HorizontalAlignment.Stretch };
                комбо.Items.Add(new ComboBoxItem { Content = "<не выбрано>", Tag = "" });
                foreach (var (ссылка, представление) in база.СписокВыбора(тип))
                    комбо.Items.Add(new ComboBoxItem { Content = представление, Tag = ссылка });
                комбо.SelectedIndex = 0;
                _чтение[имя] = () => (комбо.SelectedItem as ComboBoxItem)?.Tag?.ToString() ?? "";
                _запись[имя] = v =>
                {
                    var значение = v?.ToString() ?? "";
                    for (int i = 0; i < комбо.Items.Count; i++)
                        if ((комбо.Items[i] as ComboBoxItem)?.Tag?.ToString() == значение)
                        { комбо.SelectedIndex = i; return; }
                };
                редактор = комбо;
            }
            else
            {
                var текст = new TextBox { MinWidth = 280 };
                _чтение[имя] = () => текст.Text ?? "";
                _запись[имя] = v => текст.Text = v?.ToString() ?? "";
                редактор = текст;
            }

            if (толькоПросмотр) редактор.IsEnabled = false;
            var строкаПанель = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            строкаПанель.Children.Add(метка);
            строкаПанель.Children.Add(редактор);
            поляПанель.Children.Add(строкаПанель);
        }

        // Тип реквизита по имени (стандартные + объявленные)
        string ТипРеквизита(string имя) => имя switch
        {
            "Код" or "Номер" or "Наименование" => "Строка",
            "Дата" => "Дата",
            _ => объект.Реквизиты.FirstOrDefault(р => р.Имя == имя)?.Тип ?? "Строка"
        };

        // Макет формы из метаданных (визуальный редактор в Конфигураторе);
        // если форма не нарисована — автогенерация, как раньше
        var имяФормы = объект.Вид == "Справочник" ? "ФормаЭлемента" : "ФормаДокумента";
        var форма = объект.Формы.FirstOrDefault(ф => ф.Имя == имяФормы && ф.Элементы is { Count: > 0 })
                 ?? объект.Формы.FirstOrDefault(ф => ф.Элементы is { Count: > 0 });

        if (форма?.Элементы != null)
        {
            foreach (var э in форма.Элементы)
            {
                if (э.Тип == "Поле" && !string.IsNullOrEmpty(э.Реквизит))
                    Поле(э.Реквизит, э.Заголовок ?? э.Реквизит, ТипРеквизита(э.Реквизит), э.ТолькоПросмотр);
                // Таблица (ТЧ) и Кнопки: редактирование ТЧ в клиенте — следующий шаг,
                // стандартные кнопки добавляются всегда ниже
            }
        }
        else
        {
            if (объект.Вид == "Справочник")
            {
                Поле("Код", "Код", "Строка");
                Поле("Наименование", "Наименование", "Строка");
            }
            else if (объект.Вид == "Документ")
            {
                Поле("Номер", "Номер", "Строка");
                Поле("Дата", "Дата", "Дата");
            }
            foreach (var р in объект.Реквизиты)
                Поле(р.Имя, string.IsNullOrEmpty(р.Синоним) ? р.Имя : р.Синоним, р.Тип);
        }

        // Значения: из строки или из обработчика ПриЗаполнении
        if (строка != null)
        {
            foreach (var (имя, установить) in _запись)
                if (строка.TryGetValue(имя, out var v)) установить(v);
        }
        else
        {
            var заготовка = new ЗаписьОбъекта { ПолноеИмяОбъекта = объект.ПолноеИмя };
            РеестрМодулей.Найти(объект.ПолноеИмя)?.ПриЗаполнении(заготовка);
            foreach (var (имя, значение) in заготовка.Поля)
                if (_запись.TryGetValue(имя, out var установить)) установить(значение);
        }

        var ок = new Button { Content = "Записать и закрыть", Padding = new Thickness(14, 6) };
        var отмена = new Button { Content = "Отмена", Padding = new Thickness(14, 6) };
        ок.Click += (_, _) => Сохранить();
        отмена.Click += (_, _) => Close(false);

        var кнопки = new StackPanel
        {
            Orientation = Orientation.Horizontal, Spacing = 8,
            HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 10, 0, 0)
        };
        кнопки.Children.Add(ок);
        кнопки.Children.Add(отмена);
        поляПанель.Children.Add(_ошибки);
        поляПанель.Children.Add(кнопки);
        Content = new ScrollViewer { Content = поляПанель };
    }

    void Сохранить()
    {
        var запись = new ЗаписьОбъекта
        {
            ПолноеИмяОбъекта = _объект.ПолноеИмя,
            Ссылка = _исходная?["Ссылка"]?.ToString()
        };
        foreach (var (имя, читать) in _чтение) запись[имя] = читать();

        // --- Бизнес-логика: ПередЗаписью ---
        var отказ = new Отказ();
        var модуль = РеестрМодулей.Найти(_объект.ПолноеИмяОбъекта());
        модуль?.ПередЗаписью(запись, отказ);
        if (отказ.Значение)
        {
            _ошибки.Text = string.Join("\n", отказ.Сообщения.Select(с => "• " + с));
            _ошибки.IsVisible = true;
            return;
        }

        var поля = new Dictionary<string, object?>(запись.Поля);
        поля["Ссылка"] = запись.Ссылка ?? Guid.NewGuid().ToString();

        // Автонумерация кода/номера
        var таблица = База.ИмяТаблицы(_объект);
        if (_объект.Вид == "Справочник" && string.IsNullOrWhiteSpace(поля.GetValueOrDefault("Код")?.ToString()))
            поля["Код"] = (_база.Количество(таблица) + 1).ToString("D9");
        if (_объект.Вид == "Документ" && string.IsNullOrWhiteSpace(поля.GetValueOrDefault("Номер")?.ToString()))
            поля["Номер"] = (_база.Количество(таблица) + 1).ToString("D9");
        if (_объект.Вид == "Документ" && string.IsNullOrWhiteSpace(поля.GetValueOrDefault("Дата")?.ToString()))
            поля["Дата"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

        _база.Записать(таблица, поля);
        модуль?.ПриЗаписи(запись);
        Close(true);
    }
}

public static class РасширенияЗаписи
{
    public static string ПолноеИмяОбъекта(this ОбъектМетаданных о) => о.ПолноеИмя;
}

/// <summary>Простые диалоги (вопрос/сообщение).</summary>
public static class Диалоги
{
    public static async Task<bool> Вопрос(Window владелец, string текст)
    {
        var окно = new Window
        {
            Title = "1С-мини клиент", Width = 420, SizeToContent = SizeToContent.Height,
            WindowStartupLocation = WindowStartupLocation.CenterOwner
        };
        var да = new Button { Content = "Да", Padding = new Thickness(18, 6) };
        var нет = new Button { Content = "Нет", Padding = new Thickness(18, 6) };
        да.Click += (_, _) => окно.Close(true);
        нет.Click += (_, _) => окно.Close(false);
        var кнопки = new StackPanel
        {
            Orientation = Orientation.Horizontal, Spacing = 8,
            HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 14, 0, 0)
        };
        кнопки.Children.Add(да);
        кнопки.Children.Add(нет);
        var панель = new StackPanel { Margin = new Thickness(16) };
        панель.Children.Add(new TextBlock { Text = текст, TextWrapping = TextWrapping.Wrap });
        панель.Children.Add(кнопки);
        окно.Content = панель;
        return await окно.ShowDialog<bool>(владелец);
    }
}
