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
    readonly TextBlock _ошибки = Шаблон.ТекстОшибки();
    readonly List<СекцияТЧ> _табличныеЧасти = new();

    sealed class СекцияТЧ
    {
        public required ТабличнаяЧасть Мета;
        public required string Таблица;
        public required StackPanel ПанельСтрок;
        public List<СтрокаТЧ> Строки { get; } = new();
    }

    sealed class СтрокаТЧ
    {
        public required Control Панель;
        public Dictionary<string, Func<object?>> Чтение { get; } = new(StringComparer.OrdinalIgnoreCase);
    }

    public РедакторЗаписи(Конфигурация конфиг, База база, ОбъектМетаданных объект, Dictionary<string, object?>? строка)
    {
        _база = база; _объект = объект; _исходная = строка;

        var новый = строка == null;
        Title = $"{объект.Представление} ({(новый ? "создание" : "изменение")})";
        Width = 520; SizeToContent = SizeToContent.Height;
        MaxHeight = 680;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;

        var поляПанель = Шаблон.ПанельФормы();

        void Поле(string имя, string подпись, string тип, bool толькоПросмотр = false)
        {
            var метка = Шаблон.Подпись(подпись);
            Control редактор;

            if (тип == "Булево")
            {
                var флажок = Шаблон.Флажок();
                _чтение[имя] = () => флажок.IsChecked == true ? 1 : 0;
                _запись[имя] = v => флажок.IsChecked = v?.ToString() is "1" or "True" or "true";
                редактор = флажок;
            }
            else if (тип.Contains("Ссылка."))
            {
                var комбо = Шаблон.ПолеВыбора();
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
                var текст = Шаблон.ПолеВвода();
                _чтение[имя] = () => текст.Text ?? "";
                _запись[имя] = v => текст.Text = v?.ToString() ?? "";
                редактор = текст;
            }

            if (толькоПросмотр) редактор.IsEnabled = false;
            поляПанель.Children.Add(Шаблон.СтрокаФормы(метка, редактор));
        }

        // Тип реквизита по имени (стандартные + объявленные)
        string ТипРеквизита(string имя) => имя switch
        {
            "Код" or "Номер" or "Наименование" => "Строка",
            "Дата" => "Дата",
            _ => объект.Реквизиты.FirstOrDefault(р => р.Имя == имя)?.Тип ?? "Строка"
        };

        // --- Табличные части -------------------------------------------------
        void ДобавитьСтроку(СекцияТЧ секция, Dictionary<string, object?>? данные)
        {
            var панель = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            var строкаТч = new СтрокаТЧ { Панель = панель };

            foreach (var р in секция.Мета.Реквизиты)
            {
                var значение = данные != null && данные.TryGetValue(р.Имя, out var v) ? v : null;
                if (р.Тип == "Булево")
                {
                    var флажок = Шаблон.Флажок();
                    флажок.IsChecked = значение?.ToString() is "1" or "True" or "true";
                    строкаТч.Чтение[р.Имя] = () => флажок.IsChecked == true ? 1 : 0;
                    панель.Children.Add(флажок);
                }
                else if (р.Тип.Contains("Ссылка."))
                {
                    var комбо = Шаблон.ВыборЯчейки();
                    комбо.Items.Add(new ComboBoxItem { Content = "<не выбрано>", Tag = "" });
                    foreach (var (ссылка, представление) in база.СписокВыбора(р.Тип))
                        комбо.Items.Add(new ComboBoxItem { Content = представление, Tag = ссылка });
                    комбо.SelectedIndex = 0;
                    var текущее = значение?.ToString() ?? "";
                    for (int i = 0; i < комбо.Items.Count; i++)
                        if ((комбо.Items[i] as ComboBoxItem)?.Tag?.ToString() == текущее) { комбо.SelectedIndex = i; break; }
                    строкаТч.Чтение[р.Имя] = () => (комбо.SelectedItem as ComboBoxItem)?.Tag?.ToString() ?? "";
                    панель.Children.Add(комбо);
                }
                else
                {
                    var текст = Шаблон.ПолеЯчейки();
                    текст.Text = значение?.ToString() ?? "";
                    строкаТч.Чтение[р.Имя] = () => текст.Text ?? "";
                    панель.Children.Add(текст);
                }
            }

            панель.Children.Add(Шаблон.КнопкаСтроки("✕", () =>
            {
                секция.Строки.Remove(строкаТч);
                секция.ПанельСтрок.Children.Remove(панель);
            }));

            секция.Строки.Add(строкаТч);
            секция.ПанельСтрок.Children.Add(панель);
        }

        void ТаблицаНаФорме(ТабличнаяЧасть тч, string? заголовок)
        {
            if (тч.Таблица == null) return;
            var секция = new СекцияТЧ { Мета = тч, Таблица = тч.Таблица, ПанельСтрок = new StackPanel { Spacing = 2 } };
            _табличныеЧасти.Add(секция);

            поляПанель.Children.Add(Шаблон.ЗаголовокТЧ(
                заголовок ?? (string.IsNullOrEmpty(тч.Синоним) ? тч.Имя : тч.Синоним)));

            var шапка = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            foreach (var р in тч.Реквизиты)
                шапка.Children.Add(Шаблон.ЯчейкаШапкиТЧ(string.IsNullOrEmpty(р.Синоним) ? р.Имя : р.Синоним));
            поляПанель.Children.Add(шапка);
            поляПанель.Children.Add(секция.ПанельСтрок);
            var низ = new StackPanel { Orientation = Orientation.Horizontal };
            низ.Children.Add(Шаблон.КнопкаСтроки("Добавить строку", () => ДобавитьСтроку(секция, null)));
            поляПанель.Children.Add(низ);

            // существующие строки
            if (строка != null && строка.TryGetValue("Ссылка", out var сс) && сс != null)
                foreach (var данные in база.Строки(тч.Таблица, "Ссылка", сс.ToString()!, "НомерСтроки"))
                    ДобавитьСтроку(секция, данные);
        }

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
                else if (э.Тип == "Таблица" && !string.IsNullOrEmpty(э.ТабличнаяЧасть))
                {
                    var тч = объект.ТабличныеЧасти.FirstOrDefault(t => t.Имя == э.ТабличнаяЧасть);
                    if (тч != null) ТаблицаНаФорме(тч, э.Заголовок);
                }
                // Кнопки из макета: стандартные кнопки добавляются всегда ниже
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
            foreach (var тч in объект.ТабличныеЧасти)
                ТаблицаНаФорме(тч, null);
        }

        if (_табличныеЧасти.Count > 0) Width = 760;

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

        var ок = Шаблон.Кнопка("Записать и закрыть", Сохранить, основная: true);
        var отмена = Шаблон.Кнопка("Отмена", () => Close(false));

        поляПанель.Children.Add(_ошибки);
        поляПанель.Children.Add(Шаблон.ПанельКнопокСправа(ок, отмена));
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

        var ссылкаВладельца = поля["Ссылка"]!.ToString()!;
        foreach (var секция in _табличныеЧасти)
        {
            var строкиТч = new List<Dictionary<string, object?>>();
            int номер = 1;
            foreach (var стр in секция.Строки)
            {
                var d = new Dictionary<string, object?> { ["Ссылка"] = ссылкаВладельца, ["НомерСтроки"] = номер++ };
                foreach (var (имя, читать) in стр.Чтение) d[имя] = читать();
                строкиТч.Add(d);
            }
            _база.ЗаписатьСтроки(секция.Таблица, ссылкаВладельца, строкиТч);
        }

        модуль?.ПриЗаписи(запись);
        Close(true);
    }
}

public static class РасширенияЗаписи
{
    public static string ПолноеИмяОбъекта(this ОбъектМетаданных о) => о.ПолноеИмя;
}

