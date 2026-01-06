import os
import re
import json
import yaml
import requests
from urllib.parse import quote
from pypdf import PdfReader
from io import BytesIO

import fitz  # pymupdf


# =========================
# CONFIG
# =========================
OWNER = "guicorrea93"
REPO = "certificados"
BRANCH = "main"

API_BASE = "https://api.github.com"

# Token (já configurado no seu PC via env var)
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

HEADERS = {"Accept": "application/vnd.github+json"}
if GITHUB_TOKEN:
    HEADERS["Authorization"] = f"Bearer {GITHUB_TOKEN}"

# Onde salvar o JSON (na pasta data do seu site)
OUTPUT_JSON = os.path.join(os.path.dirname(__file__), "certificados.json")

# Onde salvar as imagens no SEU SITE (repo guicorrea93.github.io)
# data/ está dentro do seu site, então:
SITE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS_PREVIEW_ROOT = os.path.join(SITE_ROOT, "assets", "img", "certificados")


# =========================
# HELPERS
# =========================
def gh_contents(path: str):
    """Lista conteúdo (arquivos/pastas) de um path via GitHub Contents API."""
    url = f"{API_BASE}/repos/{OWNER}/{REPO}/contents/{quote(path)}"
    r = requests.get(url, headers=HEADERS, params={"ref": BRANCH}, timeout=60)
    r.raise_for_status()
    return r.json()


def slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"\.pdf$", "", s, flags=re.I)
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    return s


def normalize_preview_path(folder_id: str, pdf_filename: str) -> str:
    """Caminho do preview que o FRONT vai usar (relativo ao site)."""
    return f"assets/img/certificados/{folder_id}/{slugify(pdf_filename)}.png"


def preview_output_file(folder_id: str, pdf_filename: str) -> str:
    """Caminho físico no disco para salvar o PNG."""
    return os.path.join(ASSETS_PREVIEW_ROOT, folder_id, f"{slugify(pdf_filename)}.png")


def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


def parse_readme_frontmatter(readme_text: str):
    if not readme_text.startswith("---"):
        raise ValueError("README.md sem Front Matter YAML no topo (--- ... ---).")

    parts = readme_text.split("---", 2)
    if len(parts) < 3:
        raise ValueError("Front Matter inválido: não encontrei o segundo '---'.")

    yaml_block = parts[1].strip()
    markdown = parts[2].lstrip("\n")

    meta = yaml.safe_load(yaml_block) or {}
    return meta, markdown


def extract_section(markdown: str, heading: str) -> str:
    pattern = rf"##\s+{re.escape(heading)}\s*\n(.*?)(\n##\s+|\Z)"
    m = re.search(pattern, markdown, flags=re.S)
    return m.group(1).strip() if m else ""


def extract_year_from_pdf_bytes(pdf_bytes: bytes) -> str | None:
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
        text = " ".join((page.extract_text() or "") for page in reader.pages)
        m = re.search(r"\b(20\d{2})\b", text)
        return m.group(1) if m else None
    except Exception:
        return None


def load_existing_by_id(path: str) -> dict:
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    out = {}
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and item.get("id"):
                out[item["id"]] = item
    return out


def download_bytes(url: str, timeout=120) -> bytes:
    r = requests.get(url, timeout=timeout)
    r.raise_for_status()
    return r.content


def render_pdf_first_page_to_png(pdf_bytes: bytes, out_png_path: str, zoom: float = 2.0, overwrite: bool = False):
    """
    Renderiza a primeira página do PDF para PNG.
    zoom=2.0 costuma ficar nítido sem ficar pesado demais.
    """
    if (not overwrite) and os.path.exists(out_png_path):
        return  # já existe, não refaz

    ensure_dir(os.path.dirname(out_png_path))

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page = doc.load_page(0)
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    pix.save(out_png_path)
    doc.close()


# =========================
# MAIN
# =========================
def main():
    existing_by_id = load_existing_by_id(OUTPUT_JSON)
    result_by_id = {}

    root = gh_contents("")
    folders = [x for x in root if x.get("type") == "dir"]

    for folder in sorted(folders, key=lambda x: x.get("name", "").lower()):
        folder_name = folder["name"]
        folder_path = folder["path"]

        items = gh_contents(folder_path)

        readme = next((x for x in items if x.get("type") == "file" and x.get("name", "").lower() == "readme.md"), None)
        if not readme:
            continue

        readme_text = requests.get(readme["download_url"], timeout=60).text
        meta, md = parse_readme_frontmatter(readme_text)

        descricao = extract_section(md, "📌 Descrição curta")
        descricao_completa = extract_section(md, "📖 Descrição completa")

        pdf_files = [x for x in items if x.get("type") == "file" and x.get("name", "").lower().endswith(".pdf")]

        folder_id = meta.get("id") or re.sub(r"\s+", "-", folder_name.strip().lower())

        # PDF de formação (para ano e opcionalmente thumbnail automático)
        formacao_pdf = next((p for p in pdf_files if "formação" in p["name"].lower()), None)

        ano = None
        if formacao_pdf and formacao_pdf.get("download_url"):
            form_bytes = download_bytes(formacao_pdf["download_url"], timeout=120)
            ano = extract_year_from_pdf_bytes(form_bytes)

            # ✅ gera preview do certificado de formação (capa)
            out_png = preview_output_file(folder_id, formacao_pdf["name"])
            render_pdf_first_page_to_png(form_bytes, out_png, zoom=2.0, overwrite=False)

        certificados = []
        for p in sorted(pdf_files, key=lambda x: x["name"].lower()):
            pdf_name = p["name"]
            is_formacao = ("formação" in pdf_name.lower())

            # ✅ baixa e gera preview do PDF (primeira página)
            try:
                pdf_bytes = download_bytes(p["download_url"], timeout=120)
                out_png = preview_output_file(folder_id, pdf_name)
                render_pdf_first_page_to_png(pdf_bytes, out_png, zoom=2.0, overwrite=False)
            except Exception as e:
                # Não quebra o processo inteiro se um PDF falhar
                print(f"⚠️ Falha gerando preview: {folder_name}/{pdf_name} -> {e}")

            certificados.append({
                "nome": pdf_name,
                "url": f"https://github.com/{OWNER}/{REPO}/blob/{BRANCH}/{quote(folder_path)}/{quote(pdf_name)}",
                "preview": normalize_preview_path(folder_id, pdf_name),
                "isFormacao": is_formacao
            })

        # ✅ thumbnail automático opcional:
        # - se o README já definiu thumbnail, respeita
        # - senão, usa o preview do PDF de Formação (se existir)
        thumbnail = meta.get("thumbnail")
        if not thumbnail and formacao_pdf:
            thumbnail = normalize_preview_path(folder_id, formacao_pdf["name"])
        if not thumbnail:
            thumbnail = f"assets/img/certificados/{folder_id}-thumb.png"

        item = {
            "id": folder_id,
            "titulo": meta.get("titulo", folder_name),
            "tipo": meta.get("tipo", "Formação"),
            "instituicao": meta.get("instituicao", ""),
            "categoria": meta.get("categoria", ""),
            "duracao": meta.get("duracao", ""),
            "destaque": bool(meta.get("destaque", False)),
            "thumbnail": thumbnail,
            "competencias": meta.get("competencias", []) or [],
            "descricao": descricao,
            "descricaoCompleta": descricao_completa,
            "certificados": certificados,
            # ✅ totalCertificados inclui o PDF de Formação também
            "totalCertificados": len(certificados),
            "githubFolder": f"https://github.com/{OWNER}/{REPO}/tree/{BRANCH}/{quote(folder_path)}",
            "status": "Concluído",
            "ano": ano or meta.get("ano", ""),
        }

        # 🔁 anti-duplicidade: substitui por id
        result_by_id[item["id"]] = item

    # preserva itens antigos que não foram regenerados
    for old_id, old_item in existing_by_id.items():
        if old_id not in result_by_id:
            result_by_id[old_id] = old_item

    final_list = list(result_by_id.values())
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(final_list, f, ensure_ascii=False, indent=2)

    print(f"OK! certificados.json atualizado. Total itens: {len(final_list)}")
    print(f"OK! previews gerados em: {ASSETS_PREVIEW_ROOT}")


if __name__ == "__main__":
    main()
