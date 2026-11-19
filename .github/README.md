# Automação do site

Esta pasta não é publicada no site (o GitHub Pages ignora pastas que começam com ponto).

## Robô do portfólio (`workflows/atualizar-portfolio.yml`)

1. Você sobe PDFs no repositório [portfolio-certificados](https://github.com/guicorrea93/portfolio-certificados)
   (uma pasta por formação, de preferência com um `README.md` com cabeçalho — veja o modelo lá).
2. O robô roda toda segunda às 08:00 ou quando você clica em **Actions → Atualizar portfólio (robô) → Run workflow**.
3. Se houver novidade, ele abre um **pedido de aprovação** (pull request) com o relatório:
   formações novas, PDFs novos ou removidos, textos alterados e o resultado do validador.
4. Revise e clique em **Merge** para publicar, ou **Close** para descartar. Nada vai para o ar sem o merge.

Requisito único: *Settings → Actions → General → Workflow permissions →*
**Allow GitHub Actions to create and approve pull requests**.

O GitHub desliga o agendamento de repositórios públicos após 60 dias sem atividade.
O botão manual continua funcionando.

## Validador (`workflows/validar.yml` e `scripts/validar_dados.py`)

Roda a cada envio para o `main`. Falha (e o GitHub avisa por e-mail) se encontrar:
CPF/RG/telefone em PDFs ou nos dados, textos de rascunho (`TODO`), imagens ou PDFs citados
que não existem, ids repetidos. PDFs digitalizados já conferidos ficam em `scripts/pdfs_conferidos.txt`.

## Rodar no computador

A partir da pasta do site (com `portfolio-certificados` e `portfolio-diplomas` ao lado):

```powershell
pip install pymupdf pillow numpy pyyaml
python .github/scripts/sincronizar_certificados.py            # simulação: não grava nada
python .github/scripts/sincronizar_certificados.py --aplicar  # grava dados e miniaturas
python .github/scripts/validar_dados.py                       # confere antes de publicar
```

O robô é idempotente: rodar duas vezes seguidas não muda nada na segunda.
Os scripts antigos da pasta `scripts/` (fora do git) foram substituídos por estes;
em especial, **não use** o `scripts/extrator_certificados.py` (grava mesmo sem `--aplicar`).
