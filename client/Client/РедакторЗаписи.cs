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
        public string? СобытиеПриИзменении;   // метод модуля, вызываемый при изменении таблицы
        public List<СтрокаТЧ> Строки { get; } = new();
    }

    // true, пока значения устанавливаются программно (загрузка, возврат из команды) —
    // события ПриИзменении в это время не вызываются
    bool _тихо = true;

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

        // Подключение «ПриИзменении» к редактору по его типу (TextBox — по выходу с изменением,
        // чтобы не дёргать обработчик на каждый символ, как в 1С)
        void ПодключитьПриИзменении(Control контрол, Action действие)
        {
            switch (контрол)
            {
                case ComboBox комбо:
                    комбо.SelectionChanged += (_, _) => действие();
                    break;
                case CheckBox флажок:
                    флажок.IsCheckedChanged += (_, _) => действие();
                    break;
                case CalendarDatePicker дата:
                    дата.SelectedDateChanged += (_, _) => действие();
                    break;
                case TextBox текст:
                {
                    var старое = текст.Text ?? "";
                    текст.GotFocus += (_, _) => старое = текст.Text ?? "";
                    текст.LostFocus += (_, _) =>
                    {
                        if ((текст.Text ?? "") == старое) return;
                        старое = текст.Text ?? "";
                        действие();
                    };
                    break;
                }
                case Panel панель: // составной редактор (дата + время)
                    foreach (var дитя in панель.Children) ПодключитьПриИзменении(дитя, действие);
                    break;
            }
        }

        void Поле(string имя, string подпись, string тип, bool толькоПросмотр = false, Panel? куда = null,
                  Dictionary<string, string>? события = null)
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
            else if (тип == "Дата")
            {
                // как в 1С: поле даты получает календарь (+ поле времени)
                var дата = Шаблон.ПолеДаты();
                var время = Шаблон.ПолеВремени();
                var панель = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
                панель.Children.Add(дата);
                панель.Children.Add(время);
                _чтение[имя] = () =>
                {
                    if (дата.SelectedDate is not { } д) return "";
                    var t = TimeSpan.TryParse(string.IsNullOrWhiteSpace(время.Text) ? "0:0:0" : время.Text, out var ts) ? ts : TimeSpan.Zero;
                    return д.Date.Add(t).ToString("yyyy-MM-dd HH:mm:ss");
                };
                _запись[имя] = v =>
                {
                    if (DateTime.TryParse(v?.ToString(), out var д)) { дата.SelectedDate = д.Date; время.Text = д.ToString("HH:mm:ss"); }
                    else { дата.SelectedDate = null; время.Text = ""; }
                };
                редактор = панель;
            }
            else if (тип == "Число")
            {
                // как в 1С: числовое поле принимает только числа, выравнивание вправо
                var число = Шаблон.ЧисловоеПоле();
                _чтение[имя] = () =>
                {
                    var т = (число.Text ?? "").Replace(',', '.').Trim();
                    return decimal.TryParse(т, System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture, out var ч) ? ч : 0m;
                };
                _запись[имя] = v => число.Text = string.IsNullOrEmpty(v?.ToString()) ? "" : v!.ToString()!.Replace(',', '.');
                редактор = число;
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

            // --- события поля (как в 1С: обработчики — методы модуля объекта) ---
            if (события != null)
            {
                if (события.TryGetValue("ПриИзменении", out var приИзменении) && !string.IsNullOrWhiteSpace(приИзменении))
                    ПодключитьПриИзменении(редактор, () => { if (!_тихо) ВыполнитьКомандуФормы(приИзменении); });
                if (события.TryGetValue("ПриВходе", out var приВходе) && !string.IsNullOrWhiteSpace(приВходе))
                    редактор.GotFocus += (_, _) => { if (!_тихо) ВыполнитьКомандуФормы(приВходе); };
                if (события.TryGetValue("ПриВыходе", out var приВыходе) && !string.IsNullOrWhiteSpace(приВыходе))
                    редактор.LostFocus += (_, _) => { if (!_тихо) ВыполнитьКомандуФормы(приВыходе); };
            }

            (куда ?? поляПанель).Children.Add(Шаблон.СтрокаФормы(метка, редактор));
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
                else if (р.Тип == "Число")
                {
                    var число = Шаблон.ЧисловаяЯчейка();
                    число.Text = значение?.ToString()?.Replace(',', '.') ?? "";
                    строкаТч.Чтение[р.Имя] = () =>
                    {
                        var т = (число.Text ?? "").Replace(',', '.').Trim();
                        return decimal.TryParse(т, System.Globalization.NumberStyles.Any,
                            System.Globalization.CultureInfo.InvariantCulture, out var ч) ? ч : 0m;
                    };
                    панель.Children.Add(число);
                }
                else
                {
                    var текст = Шаблон.ПолеЯчейки();
                    текст.Text = значение?.ToString() ?? "";
                    строкаТч.Чтение[р.Имя] = () => текст.Text ?? "";
                    панель.Children.Add(текст);
                }
            }

            // событие таблицы: изменение любой ячейки (подключаем ПОСЛЕ установки
            // значений, чтобы программная инициализация не вызывала обработчик)
            if (секция.СобытиеПриИзменении is { } событиеТч)
                foreach (var контрол in панель.Children.ToList())
                    ПодключитьПриИзменении(контрол, () => { if (!_тихо) ВыполнитьКомандуФормы(событиеТч); });

            панель.Children.Add(Шаблон.КнопкаСтроки("✕", () =>
            {
                секция.Строки.Remove(строкаТч);
                секция.ПанельСтрок.Children.Remove(панель);
                if (!_тихо && секция.СобытиеПриИзменении is { } соб) ВыполнитьКомандуФормы(соб);
            }));

            секция.Строки.Add(строкаТч);
            секция.ПанельСтрок.Children.Add(панель);
        }

        void ТаблицаНаФорме(ТабличнаяЧасть тч, string? заголовок, Panel? куда = null,
                            Dictionary<string, string>? события = null)
        {
            if (тч.Таблица == null) return;
            var цель = куда ?? поляПанель;
            var секция = new СекцияТЧ
            {
                Мета = тч, Таблица = тч.Таблица, ПанельСтрок = new StackPanel { Spacing = 2 },
                СобытиеПриИзменении = события != null && события.TryGetValue("ПриИзменении", out var с) ? с : null
            };
            _табличныеЧасти.Add(секция);

            цель.Children.Add(Шаблон.ЗаголовокТЧ(
                заголовок ?? (string.IsNullOrEmpty(тч.Синоним) ? тч.Имя : тч.Синоним)));

            var шапка = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            foreach (var р in тч.Реквизиты)
                шапка.Children.Add(Шаблон.ЯчейкаШапкиТЧ(string.IsNullOrEmpty(р.Синоним) ? р.Имя : р.Синоним));
            цель.Children.Add(шапка);
            цель.Children.Add(секция.ПанельСтрок);
            var низ = new StackPanel { Orientation = Orientation.Horizontal };
            низ.Children.Add(Шаблон.КнопкаСтроки("Добавить строку", () =>
            {
                ДобавитьСтроку(секция, null);
                if (!_тихо && секция.СобытиеПриИзменении is { } соб) ВыполнитьКомандуФормы(соб);
            }));
            цель.Children.Add(низ);

            // существующие строки
            if (строка != null && строка.TryGetValue("Ссылка", out var сс) && сс != null)
                foreach (var данные in база.Строки(тч.Таблица, "Ссылка", сс.ToString()!, "НомерСтроки"))
                    ДобавитьСтроку(секция, данные);
        }

        // Макет формы из метаданных (визуальный редактор в Конфигураторе);
        // если форма не нарисована — автогенерация, как раньше
        var имяФормы = объект.Вид == "Справочник" ? "ФормаЭлемента" : "ФормаДокумента";
        var форма = объект.Формы.FirstOrDefault(ф => ф.Имя == имяФормы && ф.Элементы is { Count: > 0 })
                 ?? объект.Формы.FirstOrDefault(ф => ф.Имя != "ФормаСписка" && ф.Элементы is { Count: > 0 });

        // Рекурсивное размещение элементов: группы и страницы — как в дереве элементов 1С
        void Разместить(List<ЭлементУправленияФормы> элементы, Panel цель)
        {
            foreach (var э in элементы)
            {
                if (э.Тип == "Поле" && !string.IsNullOrEmpty(э.Реквизит))
                    Поле(э.Реквизит, э.Заголовок ?? э.Реквизит, ТипРеквизита(э.Реквизит), э.ТолькоПросмотр, цель, э.События);
                else if (э.Тип == "Таблица" && !string.IsNullOrEmpty(э.ТабличнаяЧасть))
                {
                    var тч = объект.ТабличныеЧасти.FirstOrDefault(t => t.Имя == э.ТабличнаяЧасть);
                    if (тч != null) ТаблицаНаФорме(тч, э.Заголовок, цель, э.События);
                }
                else if (э.Тип == "Группа")
                {
                    if (!string.IsNullOrEmpty(э.Заголовок)) цель.Children.Add(Шаблон.ЗаголовокГруппы(э.Заголовок!));
                    var панель = Шаблон.ПанельГруппы(э.Группировка == "Горизонтальная");
                    цель.Children.Add(панель);
                    if (э.Элементы != null) Разместить(э.Элементы, панель);
                }
                else if (э.Тип == "Страницы")
                {
                    var вкладки = Шаблон.Вкладки();
                    цель.Children.Add(вкладки);
                    foreach (var стр in э.Элементы ?? new())
                    {
                        if (стр.Тип != "Страница") continue;
                        var содержимое = Шаблон.ПанельСтраницы();
                        вкладки.Items.Add(Шаблон.Вкладка(
                            string.IsNullOrEmpty(стр.Заголовок) ? "Страница" : стр.Заголовок!, содержимое));
                        if (стр.Элементы != null) Разместить(стр.Элементы, содержимое);
                    }
                }
                else if (э.Тип == "Страница")
                {
                    // страница вне элемента «Страницы» — как вертикальная группа
                    var панель = Шаблон.ПанельГруппы(false);
                    цель.Children.Add(панель);
                    if (э.Элементы != null) Разместить(э.Элементы, панель);
                }
                else if (э.Тип == "Декорация")
                    цель.Children.Add(Шаблон.Декорация(э.Заголовок ?? ""));
                // Кнопки из макета: стандартные кнопки добавляются всегда ниже,
                // нестандартные — это команды формы (см. ВыполнитьКомандуФормы)
            }
        }

        if (форма?.Элементы != null)
        {
            Разместить(форма.Элементы, поляПанель);
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

            // как в 1С: у нового документа дата заполняется текущей
            if (объект.Вид == "Документ" && _чтение.TryGetValue("Дата", out var датаДок)
                && string.IsNullOrEmpty(датаДок()?.ToString()))
                _запись["Дата"](DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
        }

        // --- Команды формы: кнопка из дизайнера ссылается на метод модуля объекта (C#) ---
        void ВыполнитьКомандуФормы(string имя)
        {
            _ошибки.Text = "";
            var запись = new ЗаписьОбъекта
            {
                ПолноеИмяОбъекта = объект.ПолноеИмя,
                Ссылка = строка != null && строка.TryGetValue("Ссылка", out var сс) ? сс?.ToString() : null
            };
            foreach (var (н, читать) in _чтение) запись[н] = читать();
            foreach (var секция in _табличныеЧасти)
            {
                var строкиТч = new List<Dictionary<string, object?>>();
                foreach (var с in секция.Строки)
                {
                    var d = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
                    foreach (var (н, читать) in с.Чтение) d[н] = читать();
                    строкиТч.Add(d);
                }
                запись.ТабличныеЧасти[секция.Мета.Имя] = строкиТч;
            }

            var модуль = РеестрМодулей.Найти(объект.ПолноеИмя);
            try
            {
                if (модуль == null || !модуль.ВыполнитьКоманду(имя, запись))
                {
                    _ошибки.Text = $"Команда «{имя}» не найдена: добавьте в модуль объекта публичный метод {имя}.";
                    return;
                }
            }
            catch (Exception ошибка)
            {
                _ошибки.Text = $"Команда «{имя}»: {ошибка.Message}";
                return;
            }

            // изменения из команды — обратно на форму (тихо: без повторного вызова событий)
            var былоТихо = _тихо;
            _тихо = true;
            try
            {
                foreach (var (н, значение) in запись.Поля)
                    if (_запись.TryGetValue(н, out var установить)) установить(значение);
                // …и табличные части (команда могла добавить/изменить строки)
                foreach (var секция in _табличныеЧасти)
                {
                    if (!запись.ТабличныеЧасти.TryGetValue(секция.Мета.Имя, out var строкиТч)) continue;
                    секция.Строки.Clear();
                    секция.ПанельСтрок.Children.Clear();
                    foreach (var d in строкиТч) ДобавитьСтроку(секция, d);
                }
            }
            finally { _тихо = былоТихо; }
        }

        var кнопкиКоманд = new List<Control>();
        void СобратьКоманды(List<ЭлементУправленияФормы> элементы)
        {
            foreach (var э in элементы)
            {
                if (э.Тип == "Кнопка" && э.Действие is not (null or "" or "ЗаписатьИЗакрыть" or "Отмена"))
                {
                    var действие = э.Действие!;
                    кнопкиКоманд.Add(Шаблон.Кнопка(э.Заголовок ?? действие, () => ВыполнитьКомандуФормы(действие)));
                }
                if (э.Элементы != null) СобратьКоманды(э.Элементы);
            }
        }
        if (форма?.Элементы != null) СобратьКоманды(форма.Элементы);

        var отмена = Шаблон.Кнопка("Отмена", () => Close(false));
        поляПанель.Children.Add(_ошибки);
        if (объект.Вид == "Документ")
        {
            // как в 1С: «Провести и закрыть» — главное действие документа,
            // «Записать» — запись без проведения (снимает с проведения и удаляет движения)
            var провести = Шаблон.Кнопка("Провести и закрыть", () => Сохранить(провести: true), основная: true);
            var записать = Шаблон.Кнопка("Записать", () => Сохранить(провести: false));
            поляПанель.Children.Add(Шаблон.ПанельКнопокСправа(
                кнопкиКоманд.Concat(new Control[] { провести, записать, отмена }).ToArray()));
        }
        else
        {
            var ок = Шаблон.Кнопка("Записать и закрыть", () => Сохранить(провести: false), основная: true);
            поляПанель.Children.Add(Шаблон.ПанельКнопокСправа(
                кнопкиКоманд.Concat(new Control[] { ок, отмена }).ToArray()));
        }
        Content = new ScrollViewer { Content = поляПанель };
        _тихо = false;   // загрузка завершена — события полей активны
    }

    void Сохранить(bool провести)
    {
        var запись = new ЗаписьОбъекта
        {
            ПолноеИмяОбъекта = _объект.ПолноеИмя,
            Ссылка = _исходная?["Ссылка"]?.ToString()
        };
        foreach (var (имя, читать) in _чтение) запись[имя] = читать();

        // Табличные части — в запись (модули видят строки: запись.Товары и т.п.)
        foreach (var секция in _табличныеЧасти)
        {
            var строкиТч = new List<Dictionary<string, object?>>();
            foreach (var стр in секция.Строки)
            {
                var d = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
                foreach (var (имя, читать) in стр.Чтение) d[имя] = читать();
                строкиТч.Add(d);
            }
            запись.ТабличныеЧасти[секция.Мета.Имя] = строкиТч;
        }

        // --- Общий конвейер платформы: ПередЗаписью, проведение, автонумерация, ТЧ, движения ---
        var отказ = СервисЗаписи.Записать(_база, _объект, запись, провести);
        if (ПоказатьОтказ(отказ)) return;
        Close(true);
    }

    bool ПоказатьОтказ(Отказ отказ)
    {
        if (!отказ.Значение) return false;
        _ошибки.Text = string.Join("\n", отказ.Сообщения.Select(с => "• " + с));
        _ошибки.IsVisible = true;
        return true;
    }
}

public static class РасширенияЗаписи
{
    public static string ПолноеИмяОбъекта(this ОбъектМетаданных о) => о.ПолноеИмя;
}

