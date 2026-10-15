---
name: Vinificação em tinto
aliases: [Protocolo tinto]
tags: [protocolo, tinto]
tipo: protocolo
maturity: growing
reviewed: false
regiao: Serra Gaúcha
autor: Enologia
created: 2026-02-20
updated: 2026-04-10
executado_em: 2026-03-02
---

O caminho da uva tinta até o vinho de guarda, escrito para ser seguido por
quem chega na safra sem ter feito a anterior.

> [!caution] Não comece sem a leitura de IPT do dia
> Maceração decidida por calendário é a origem de metade dos tintos verdes
> desta região.

# Antes de começar

- [x] Leitura de [[Índice de Polifenóis Totais|IPT]] do dia registrada
- [x] Tanque sanitizado e ficha aberta
- [ ] Temperatura de entrada aferida em dois pontos
- [ ] Alguém que não seja você conferindo a pesagem

# Maceração

1. Desengace total, sem esmagamento.
2. Maceração pré-fermentativa a frio por 48 h.
3. Remontagens duas vezes ao dia enquanto o IPT subir.
4. Descuba quando a curva achatar, não quando o cronograma disser.

O passo 4 é o que ==decide a estrutura do vinho==, e é o único que não aceita
regra fixa.

> [!regra] A data de descuba é do **enólogo responsável**, e fica escrita na ficha do tanque antes da primeira remontagem.
> O cronograma propõe; quem assina a ficha decide.

> [!regra] **Separação de funções:** quem lê o IPT não é quem decide a descuba do mesmo tanque.

> [!atenção]
> Remontagem com o mosto acima de 30 °C extrai amargor, não cor. Pare e
> resfrie antes de seguir.

> [!example] A ficha do tanque, como o laboratório a preenche
> ```yaml
> tanque: T4
> casta: Cabernet Sauvignon
> entrada: 2026-03-02
> leituras:
>   - { dia: 1, ipt: 41, temperatura: 9.5 }
>   - { dia: 3, ipt: 49, temperatura: 24.0 }
> descuba: null   # decidida pela curva, não pela data
> ```

![[Índice de Polifenóis Totais]]

# Quando descubar

A regra do passo 4, escrita para quem confere a curva na planilha: descuba no
primeiro dia em que o IPT subir menos de um ponto em relação à leitura
anterior.[^curva] Duas leituras seguidas abaixo disso confirmam a decisão.[^curva]

```python
def dia_de_descuba(leituras: list[float], limite: float = 1.0) -> int | None:
    """O primeiro dia em que a curva de IPT achata, ou None se ainda sobe."""
    for dia in range(1, len(leituras)):
        if leituras[dia] - leituras[dia - 1] < limite:
            return dia
    return None


print(dia_de_descuba([41, 49, 55, 58, 58.6]))  # 4
```

O limite de um ponto vem da tese que esta adega segue desde 2019.[^tese]

# Notas de revisão

%% A maceração pré-fermentativa era de 24 h até 2025. A safra 2026 mostrou
que 48 h muda o IPT final em 8 pontos. Não voltar sem repetir o teste. %%

O que aconteceu na prática está em
[a caderneta da safra](../Safras/Safra 2026 · Serra Gaúcha.md), e o assunto
desta página é #protocolo, que não a arquiva em lugar nenhum: quem a arquiva
são as `tags:` e a pasta em que ela está.

[^curva]: Medida no mesmo horário todos os dias: uma leitura da manhã e outra
    da tarde não formam curva, formam ruído.
[^tese]: Zamora, *Elaboración y crianza del vino tinto*, cap. 4. O limite é
    dele; o de dois dias seguidos é nosso.
