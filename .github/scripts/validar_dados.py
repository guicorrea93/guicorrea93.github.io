"""
Validador dos dados do site pessoal (somente leitura: nao altera nada).

Confere, antes de publicar:
  - JSON valido e ids unicos em cada arquivo de data/
  - textos de rascunho (TODO, "a ser preenchido"...) em dados publicados
  - imagens e documentos locais referenciados que nao existem
  - certificados: totalCertificados bate com a lista; PDFs citados existem
    no repositorio de certificados; PDFs que existem mas nao estao no site
  - diplomas: PDF citado existe no repositorio de diplomas
  - DADOS PESSOAIS: CPF/RG/telefone no texto de todo PDF dos repositorios
    de certificados e diplomas, dos PDFs em assets/docs e dos JSON

Uso (a partir da pasta do site):
  python .github/scripts/validar_dados.py
  python .github/scripts/validar_dados.py --certificados ../portfolio-certificados --diplomas ../portfolio-diplomas

Saida: lista de ERROS (bloqueiam a publicacao) e AVISOS (para revisar).
Codigo de saida 1 se houver erro. Requer: pymupdf (pip install pymupdf).
"""

import argparse
import glob
import json
import os
import re
import sys
import unicodedata
from urllib.parse import unquote

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

RASCUNHO = re.compile(r"\bTODO\b|\bFIXME\b")  # so em maiusculas: "todo" e palavra comum
RASCUNHO_TEXTO = re.compile(r"a ser preenchid|lorem ipsum|preencher descri", re.I)
CPF = re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b")
RG = re.compile(r"\b\d{2}\.\d{3}\.\d{3}-[\dxX]\b")
TELEFONE = re.compile(r"\(?\b\d{2}\)?\s?9\d{4}-?\d{4}\b")
CAMPOS_ARQUIVO = ("thumbnail", "preview", "capa")

erros, avisos = [], []


def nfc(s):
    return unicodedata.normalize("NFC", s)


def textos(valor):
    """Todos os textos dentro de um valor JSON (recursivo)."""
    if isinstance(valor, str):
        yield valor
    elif isinstance(valor, list):
        for v in valor:
            yield from textos(v)
    elif isinstance(valor, dict):
        for v in valor.values():
            yield from textos(v)


def local(site, caminho):
    """Caminho local de uma referencia do site, ou None se for externa."""
    if not isinstance(caminho, str) or not caminho or caminho.startswith(("http:", "https:", "mailto:", "#")):
        return None
    return os.path.join(site, unquote(caminho).lstrip("/"))


def arquivo_no_repo(url, repo_local, nome_repo):
    """Para links github.com/guicorrea93/<repo>/blob|tree/main/<caminho>, devolve o caminho local."""
    m = re.search(r"github\.com/guicorrea93/" + re.escape(nome_repo) + r"/(?:blob|tree)/main/(.+)$", url or "")
    if not m or not repo_local:
        return None
    return os.path.join(repo_local, nfc(unquote(m.group(1))))


# PDFs digitalizados ja conferidos visualmente (sha256 + nome). Se o arquivo mudar, o aviso volta.
_LISTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pdfs_conferidos.txt")
CONFERIDOS = ({l.split()[0] for l in open(_LISTA, encoding="utf-8") if l.strip() and not l.startswith("#")}
              if os.path.exists(_LISTA) else set())


def hash_arquivo(caminho):
    import hashlib
    return hashlib.sha256(open(caminho, "rb").read()).hexdigest()


def checar_pdf(caminho, rotulo):
    try:
        import pymupdf
    except ImportError:
        avisos.append("pymupdf nao instalado: PDFs nao verificados para dados pessoais (pip install pymupdf)")
        return False
    try:
        doc = pymupdf.open(caminho)
        texto = " ".join(p.get_text() for p in doc)
    except Exception as e:
        avisos.append(f"{rotulo}: nao foi possivel ler o PDF ({e})")
        return True
    achados = [n for n, rx in (("CPF", CPF), ("RG", RG), ("telefone", TELEFONE)) if rx.search(texto)]
    if achados:
        erros.append(f"DADO PESSOAL em {rotulo}: {', '.join(achados)} no texto do PDF")
    elif len(texto.strip()) < 30 and hash_arquivo(caminho) not in CONFERIDOS:
        avisos.append(f"{rotulo}: PDF sem texto (digitalizado) - confira visualmente se ha dado pessoal "
                      f"e, se estiver ok, adicione a pdfs_conferidos.txt: {hash_arquivo(caminho)}  {rotulo}")
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", default=".")
    ap.add_argument("--certificados", default="../portfolio-certificados")
    ap.add_argument("--diplomas", default="../portfolio-diplomas")
    a = ap.parse_args()
    site = a.site
    rep_cert = a.certificados if os.path.isdir(a.certificados) else None
    rep_dipl = a.diplomas if os.path.isdir(a.diplomas) else None
    if not rep_cert:
        avisos.append(f"repositorio de certificados nao encontrado em {a.certificados}: links de PDF nao conferidos")
    if not rep_dipl:
        avisos.append(f"repositorio de diplomas nao encontrado em {a.diplomas}: links de PDF nao conferidos")

    dados = {}
    for f in sorted(glob.glob(os.path.join(site, "data", "*.json"))):
        nome = os.path.basename(f)
        try:
            dados[nome] = json.load(open(f, encoding="utf-8"))
        except Exception as e:
            erros.append(f"{nome}: JSON invalido ({e})")
            continue
        itens = dados[nome] if isinstance(dados[nome], list) else []
        ids = [i.get("id") for i in itens if isinstance(i, dict)]
        repetidos = sorted({i for i in ids if ids.count(i) > 1})
        if repetidos:
            erros.append(f"{nome}: ids repetidos {repetidos}")
        if any(not i for i in ids):
            erros.append(f"{nome}: item sem id")
        for item in itens:
            iid = item.get("id", "?")
            for t in textos(item):
                if RASCUNHO.search(t) or RASCUNHO_TEXTO.search(t):
                    erros.append(f"{nome} [{iid}]: texto de rascunho: \"{t[:70]}\"")
                if CPF.search(t) or RG.search(t):
                    erros.append(f"{nome} [{iid}]: parece CPF/RG no texto")
            if item.get("revisar"):
                avisos.append(f"{nome} [{iid}]: textos provisorios (sem README com cabecalho): revise antes de aprovar")
            refs = [item.get(c) for c in CAMPOS_ARQUIVO] + list(item.get("screenshots", []) or [])
            refs += [c.get("preview") for c in item.get("certificados", []) or []]
            for r in refs:
                p = local(site, r)
                if p and not os.path.exists(p):
                    erros.append(f"{nome} [{iid}]: arquivo nao existe: {r}")

    # Certificados x repositorio de certificados
    citados = set()
    for item in dados.get("certificados.json", []):
        lista = item.get("certificados", []) or []
        if item.get("totalCertificados") != len(lista):
            erros.append(f"certificados.json [{item.get('id')}]: totalCertificados={item.get('totalCertificados')} mas a lista tem {len(lista)}")
        for c in lista:
            p = arquivo_no_repo(c.get("url"), rep_cert, "portfolio-certificados")
            if p:
                citados.add(os.path.normcase(os.path.normpath(p)))
                if not os.path.exists(p):
                    erros.append(f"certificados.json [{item.get('id')}]: PDF nao existe no repositorio: {c.get('nome')}")
    if rep_cert:
        for pdf in sorted(glob.glob(os.path.join(rep_cert, "**", "*.pdf"), recursive=True)):
            rel = os.path.relpath(pdf, rep_cert)
            checar_pdf(pdf, f"portfolio-certificados/{rel}")
            if os.path.normcase(os.path.normpath(nfc(pdf))) not in citados:
                avisos.append(f"PDF de certificado ainda nao esta no site: {rel}")

    # Diplomas x repositorio de diplomas
    for item in dados.get("diplomas.json", []):
        p = arquivo_no_repo(item.get("link"), rep_dipl, "portfolio-diplomas")
        if p and not os.path.exists(p):
            erros.append(f"diplomas.json [{item.get('id')}]: PDF nao existe no repositorio: {item.get('link')}")
    if rep_dipl:
        for pdf in sorted(glob.glob(os.path.join(rep_dipl, "*.pdf"))):
            checar_pdf(pdf, f"portfolio-diplomas/{os.path.basename(pdf)}")

    # Documentos publicados pelo proprio site (ex.: curriculo)
    for pdf in sorted(glob.glob(os.path.join(site, "assets", "docs", "*.pdf"))):
        checar_pdf(pdf, os.path.relpath(pdf, site))

    print("=" * 60)
    print(f"VALIDACAO DOS DADOS: {len(erros)} erro(s), {len(avisos)} aviso(s)")
    print("=" * 60)
    for e in erros:
        print("ERRO  ", e)
    for w in avisos:
        print("AVISO ", w)
    if not erros:
        print("DADOS OK")
    return 1 if erros else 0


if __name__ == "__main__":
    sys.exit(main())
