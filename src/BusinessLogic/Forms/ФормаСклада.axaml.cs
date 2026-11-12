using Avalonia.Controls;
using Avalonia.Markup.Xaml;
using OneC.Core;

namespace BusinessLogic.Forms;

/// <summary>
/// Произвольная форма справочника «Склады»: обычное окно Avalonia, свёрстанное в AXAML.
/// Компилируется в DLL конфигурации и открывается клиентом вместо генерируемой формы.
/// </summary>
[ПроизвольнаяФорма("Справочник.Склады")]
public partial class ФормаСклада : Window, IПроизвольнаяФорма
{
    КонтекстФормы? _контекст;

    public ФормаСклада()
    {
        AvaloniaXamlLoader.Load(this);
        this.FindControl<Button>("КнопкаОтмена")!.Click += (_, _) => Close(false);
        this.FindControl<Button>("КнопкаЗаписать")!.Click += (_, _) => ЗаписатьИЗакрыть();
    }

    public void Инициализировать(КонтекстФормы контекст)
    {
        _контекст = контекст;
        this.FindControl<TextBox>("Код")!.Text = контекст.Запись.Строка("Код");
        this.FindControl<TextBox>("Наименование")!.Text = контекст.Запись.Строка("Наименование");
    }

    void ЗаписатьИЗакрыть()
    {
        if (_контекст == null) return;

        var запись = _контекст.Запись;
        запись["Код"] = this.FindControl<TextBox>("Код")!.Text;
        запись["Наименование"] = this.FindControl<TextBox>("Наименование")!.Text;

        var отказ = _контекст.Записать(запись, false);
        if (отказ.Значение)
        {
            var ошибки = this.FindControl<TextBlock>("Ошибки")!;
            ошибки.Text = string.Join("\n", отказ.Сообщения.Select(с => "• " + с));
            ошибки.IsVisible = true;
            return;
        }
        Close(true);
    }
}
