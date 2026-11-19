"""
Robo de certificados: le o repositorio portfolio-certificados (pasta local) e
atualiza data/certificados.json + miniaturas do site.

Regras:
  - SIMULACAO por padrao: mostra o que mudaria e nao grava nada. Use --aplicar.
  - Textos editoriais (titulo, descricoes, competencias, categoria, destaque...)
    vem do cabecalho (frontmatter) do README.md da pasta. Sem cabecalho, o que ja
    esta no site e mantido; formacao nova recebe textos provisorios marcados.
  - Campos automaticos: lista de PDFs, total, pasta no GitHub, miniaturas (WebP
    recortado, 900px) e ano (so quando vazio).
  - Formacao nova entra no fim da lista. Nada e apagado: formacao sem pasta so
    aparece no relatorio.
  - Rodar duas vezes seguidas nao muda nada na segunda (idempotente).

Uso (a partir da pasta do site):
  python .github/scripts/sincronizar_certificados.py                    # simulacao
  python .github/scripts/sincronizar_certificados.py --aplicar          # grava
  python .github/scripts/sincronizar_certificados.py --relatorio rel.md # salva o relatorio

Requer: pymupdf, Pillow, numpy, pyyaml.
"""

import argparse
import io
import json
import os
import re
import sys
import unicodedata
from datetime import date
from urllib.parse import quote

import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from imagens_certificado import pdf_para_webp  # noqa: E402

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

OWNER, REPO, BRANCH = "guicorrea93", "portfolio-certificados", "main"
IMG_BASE = "assets/img/certificados"

# Mesmos grupos de filtro do site (certificates.js / ORDEM_GRUPOS)
GRUPOS = {
    "Dados & BI": ["Business Intelligence", "Power BI", "Excel e Business Intelligence", "Excel e Análise de Dados"],
    "Data Science & ML": ["Data Science", "Estatística e Data Science", "Machine Learning"],
    "Banco de Dados & SQL": ["Banco de Dados"],
    "Programação & IA": ["Programação", "Ferramentas de Desenvolvimento", "Inteligência Artificial"],
    "Gestão & Agilidade": ["Metodologias Ágeis", "Agilidade", "Agilidade e Transformação Digital",
                           "Gestão Ágil e Projetos", "Agilidade Escalada e Governança",
                           "Empreendedorismo e Negócios", "Estratégia e Gestão"],
    "Processos & Governança": ["Governança e Gestão de TI", "Processos e Governança"],
    "Comunicação & Liderança": ["Soft Skills", "Liderança e Comunicação", "Negociação e Comunicação", "Liderança e Gestão"],
}
GRUPO_DA_CATEGORIA = {c: g for g, cs in GRUPOS.items() for c in cs}
EDITORIAIS = ["titulo", "tipo", "instituicao", "categoria", "duracao", "ano", "destaque", "competencias", "grupo", "status"]
MESES = {m: i for i, m in enumerate(["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto",
                                     "setembro", "outubro", "novembro", "dezembro"], 1)}


def nfc(s):
    return unicodedata.normalize("NFC", s)


def slug(s):
    s = unicodedata.normalize("NFKD", nfc(s)).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\.pdf$", "", s)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def ler_readme(pasta):
    """(frontmatter: dict, descricao, descricaoCompleta) do README da pasta."""
    p = os.path.join(pasta, "README.md")
    if not os.path.exists(p):
        return {}, None, None
    t = open(p, encoding="utf-8").read().replace("\r\n", "\n")
    m = re.match(r"---\n(.*?)\n---\n(.*)", t, re.S)
    if not m:
        return {}, None, None
    fm = yaml.safe_load(m.group(1)) or {}

    def secao(titulo):
        s = re.search(r"^##\s+[^\n]*" + titulo + r"[^\n]*\n(.*?)(?=^#{1,6}\s|\Z)", m.group(2), re.S | re.M | re.I)
        return s.group(1).strip() if s else None
    return fm, secao("Descrição curta"), secao("Descrição completa")


def texto_pdf(caminho):
    import pymupdf
    try:
        return re.sub(r"\s+", " ", " ".join(p.get_text() for p in pymupdf.open(caminho)))
    except Exception:
        return ""


def ano_do_pdf(texto):
    for rx in (r"Finalizado em \d{1,2} de (\w+) de (\d{4})", r"T[ée]rmino:\s*\d{2}/\d{2}/(\d{4})",
               r"Date Of The Conclusion:?\s*\d{2}/\d{2}/(\d{4})", r"Conclu[íi]do em\s*\d{1,2}\s+\w+\s+(\d{4})"):
        m = re.search(rx, texto, re.I)
        if m:
            return int(m.groups()[-1])
    return None


def horas_do_pdf(texto):
    m = re.search(r"carga hor[áa]ria(?: estimada)?(?: de| em)?:?\s*(\d+)\s*h", texto, re.I) or \
        re.search(r"Course Credits:?\s*(\d+)\s*h", texto, re.I)
    return int(m.group(1)) if m else None


def eh_formacao(nome):
    return bool(re.search(r"forma[çc][ãa]o", nfc(nome), re.I))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", default=".")
    ap.add_argument("--certificados", default="../portfolio-certificados")
    ap.add_argument("--aplicar", action="store_true")
    ap.add_argument("--relatorio", help="arquivo Markdown para salvar o relatorio (corpo do pedido de aprovacao)")
    a = ap.parse_args()
    site, repo = a.site, a.certificados
    if not os.path.isdir(repo):
        sys.exit(f"Repositorio de certificados nao encontrado: {repo}")

    caminho_json = os.path.join(site, "data", "certificados.json")
    bruto = open(caminho_json, "rb").read()
    crlf = b"\r\n" in bruto
    dados = json.loads(bruto.decode("utf-8"))
    por_id = {x["id"]: x for x in dados}
    por_pasta = {x.get("githubFolder"): x for x in dados}

    rel = {"novas": [], "pdfs_novos": [], "pdfs_removidos": [], "textos": [], "miniaturas": 0,
           "provisorias": [], "sem_pasta": [], "alterados": []}
    vistos = set()
    hoje = date.today().isoformat()

    for nome_pasta in sorted(os.listdir(repo), key=lambda s: nfc(s).lower()):
        pasta = os.path.join(repo, nome_pasta)
        if not os.path.isdir(pasta) or nome_pasta.startswith("."):
            continue
        pdfs = sorted([f for f in os.listdir(pasta) if f.lower().endswith(".pdf")], key=lambda s: nfc(s).lower())
        if not pdfs:
            continue
        nome_pasta_n = nfc(nome_pasta)
        url_pasta = f"https://github.com/{OWNER}/{REPO}/tree/{BRANCH}/{quote(nome_pasta_n)}"
        fm, desc, desc_completa = ler_readme(pasta)

        item = por_id.get(fm.get("id")) if fm.get("id") else None
        item = item or por_pasta.get(url_pasta)
        nova = item is None
        if nova:
            iid = fm.get("id") or slug(nome_pasta_n)
            item = {"id": iid, "titulo": fm.get("titulo") or nome_pasta_n, "tipo": "Formação", "instituicao": "",
                    "categoria": "", "grupo": "", "duracao": "", "destaque": False, "thumbnail": "",
                    "competencias": [], "descricao": "", "descricaoCompleta": "", "certificados": [],
                    "totalCertificados": 0, "githubFolder": url_pasta, "status": "Concluído", "ano": ""}
            dados.append(item)
            por_id[iid] = item
            rel["novas"].append(item["titulo"])
        antes = json.dumps(item, ensure_ascii=False, sort_keys=True)
        vistos.add(item["id"])

        # 1) Textos editoriais do README (fonte oficial). Miniatura nunca vem de la.
        for k in EDITORIAIS:
            if k in fm and fm[k] not in (None, "") and item.get(k) != fm[k]:
                if not nova:
                    rel["textos"].append(f"{item['titulo']}: {k}")
                item[k] = fm[k]
        for k, v in (("descricao", desc), ("descricaoCompleta", desc_completa)):
            if v and item.get(k) != v:
                if not nova:
                    rel["textos"].append(f"{item['titulo']}: {k}")
                item[k] = v
        # grupo do filtro acompanha a categoria (a nao ser que o README defina "grupo")
        item["grupo"] = fm.get("grupo") or GRUPO_DA_CATEGORIA.get(item.get("categoria"), item.get("grupo", ""))
        if fm and desc:
            item.pop("revisar", None)  # README com cabecalho e descricao: textos revisados

        # 2) Lista de PDFs: preserva os existentes, acrescenta novos, tira os que sumiram
        atuais = {nfc(c["nome"]): c for c in item.get("certificados", [])}
        nova_lista, anos, horas_cursos, horas_formacao = [], [], 0, None
        usados = {c.get("preview") for c in atuais.values()}
        for pdf in pdfs:
            nome = nfc(pdf)
            texto = None
            c = atuais.get(nome)
            if c is None:
                base = f"{IMG_BASE}/{item['id']}/{slug(nome)}"
                prev, n = base + ".webp", 2
                while prev in usados:
                    prev, n = f"{base}-{n}.webp", n + 1
                usados.add(prev)
                c = {"nome": nome, "url": f"https://github.com/{OWNER}/{REPO}/blob/{BRANCH}/{quote(nome_pasta_n)}/{quote(nome)}",
                     "preview": prev, "isFormacao": eh_formacao(nome)}
                if not nova:
                    rel["pdfs_novos"].append(f"{item['titulo']}: {nome}")
            destino = os.path.join(site, c["preview"])
            if not os.path.exists(destino):
                rel["miniaturas"] += 1
                if a.aplicar:
                    os.makedirs(os.path.dirname(destino), exist_ok=True)
                    pdf_para_webp(os.path.join(pasta, pdf), destino)
            if nova or not item.get("ano") or not item.get("duracao"):
                texto = texto_pdf(os.path.join(pasta, pdf))
                ano = ano_do_pdf(texto)
                if ano:
                    anos.append(ano)
                h = horas_do_pdf(texto)
                if h:
                    if c["isFormacao"]:
                        horas_formacao = h
                    else:
                        horas_cursos += h
            nova_lista.append(c)
        for nome in sorted(set(atuais) - {nfc(p) for p in pdfs}):
            rel["pdfs_removidos"].append(f"{item['titulo']}: {nome}")
        item["certificados"] = nova_lista
        item["totalCertificados"] = len(nova_lista)
        item["githubFolder"] = url_pasta

        # 3) Campos que so sao preenchidos quando estao vazios
        if not item.get("ano") and anos:
            item["ano"] = str(max(anos)) if min(anos) == max(anos) else f"{min(anos)} - {max(anos)}"
        if not item.get("duracao") and (horas_formacao or horas_cursos):
            item["duracao"] = f"{horas_formacao or horas_cursos} horas"
        thumb_ok = item.get("thumbnail") and os.path.exists(os.path.join(site, item["thumbnail"]))
        if not thumb_ok or nova:
            preferida = next((c["preview"] for c in nova_lista if c["isFormacao"]), nova_lista[0]["preview"])
            item["thumbnail"] = preferida
        if not item.get("instituicao") and texto and "alura" in texto.lower():
            item["instituicao"] = "Alura"
        if nova and not desc:
            item["descricao"] = f"Formação em **{item['titulo']}**" + (f" pela {item['instituicao']}" if item["instituicao"] else "") + "."
            item["descricaoCompleta"] = item["descricao"]
            item["revisar"] = True
            rel["provisorias"].append(f"{item['titulo']} (pasta \"{nome_pasta_n}\" sem README com cabeçalho: "
                                      "revise título, categoria, descrição e competências)")

        if json.dumps(item, ensure_ascii=False, sort_keys=True) != antes:
            item["lastUpdated"] = hoje
            if not nova:
                rel["alterados"].append(item["titulo"])

    rel["sem_pasta"] = [x["titulo"] for x in dados if x["id"] not in vistos]

    # Relatorio
    linhas = ["## Robô de certificados", ""]
    def bloco(titulo, itens):
        if itens:
            linhas.append(f"**{titulo}** ({len(itens)})")
            linhas.extend(f"- {i}" for i in itens)
            linhas.append("")
    bloco("Formações novas", rel["novas"])
    bloco("PDFs novos em formações existentes", rel["pdfs_novos"])
    bloco("PDFs que sumiram do repositório (removidos do site)", rel["pdfs_removidos"])
    bloco("Textos atualizados a partir do README", rel["textos"])
    bloco("⚠️ Textos provisórios para revisar antes de aprovar", rel["provisorias"])
    bloco("Formações no site sem pasta no repositório (nada foi apagado)", rel["sem_pasta"])
    bloco("Formações existentes com alguma mudança", rel["alterados"])
    if rel["miniaturas"]:
        linhas.append(f"Miniaturas a gerar: {rel['miniaturas']}")
    mudou = any(rel[k] for k in ("novas", "pdfs_novos", "pdfs_removidos", "textos", "alterados")) or rel["miniaturas"]
    if not mudou:
        linhas.append("Nada novo: o site já está igual ao repositório de certificados.")
    texto_rel = "\n".join(linhas).rstrip() + "\n"

    print(("APLICADO" if a.aplicar else "SIMULACAO (nada foi gravado; use --aplicar)"))
    print(texto_rel)
    if a.relatorio:
        open(a.relatorio, "w", encoding="utf-8").write(texto_rel)
    if a.aplicar:
        s = json.dumps(dados, ensure_ascii=False, indent=2)
        novo = (s.replace("\n", "\r\n") if crlf else s).encode("utf-8")
        if novo != bruto:
            open(caminho_json, "wb").write(novo)


if __name__ == "__main__":
    main()
