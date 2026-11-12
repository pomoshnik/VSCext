using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Markup.Xaml;
using OneC.Core;

namespace BusinessLogic.Forms;

/// <summary>
/// Произвольная форма справочника «Склады»: окно Avalonia с компилируемыми биндингами
/// к генерируемой модели (Generated/Модели.g.cs). Компилируется в DLL конфигурации.
/// </summary>
[ПроизвольнаяФорма("Справочник.Склады")]
public partial class ФормаСклада : Window, IПроизвольнаяФорма
{
    КонтекстФормы? _контекст;
    public Справочник_Склады_Модель Модель { get; } = new();

    public ФормаСклада() => AvaloniaXamlLoader.Load(this);

    public void Инициализировать(КонтекстФормы контекст)
    {
        _контекст = контекст;
        Модель.Загрузить(контекст.Запись);
        DataContext = Модель;
    }

    void ЗаписатьИЗакрыть(object? sender, RoutedEventArgs e)
    {
        if (_контекст == null) return;
        Модель.Выгрузить(_контекст.Запись);
        var отказ = _контекст.Записать(_контекст.Запись, false);
        if (отказ.Значение)
        {
            Модель.Ошибки = string.Join("\n", отказ.Сообщения.Select(с => "• " + с));
            return;
        }
        Close(true);
    }

    void Отмена(object? sender, RoutedEventArgs e) => Close(false);
}
