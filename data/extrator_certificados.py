import os
from dotenv import load_dotenv
load_dotenv()
import re
import json
import yaml
import requests
from urllib.parse import quote
from pypdf import PdfReader
from io import BytesIO
from datetime import datetime

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
    """Gera um slug limpo e curto a partir do nome do arquivo."""
    s = s.lower().strip()
    s = re.sub(r"\.pdf$", "", s, flags=re.I)
    
    # Remove acentos
    s = s.replace('ã', 'a').replace('á', 'a').replace('â', 'a').replace('à', 'a')
    s = s.replace('é', 'e').replace('ê', 'e').replace('è', 'e')
    s = s.replace('í', 'i').replace('î', 'i').replace('ì', 'i')
    s = s.replace('ó', 'o').replace('ô', 'o').replace('õ', 'o').replace('ò', 'o')
    s = s.replace('ú', 'u').replace('û', 'u').replace('ù', 'u')
    s = s.replace('ç', 'c')
    
    # Remove caracteres especiais
    s = re.sub(r"[^\w\s-]", "", s)
    
    # Substitui espaços por hífen
    s = re.sub(r"\s+", "-", s)
    
    # Remove hífens duplicados
    s = re.sub(r"-+", "-", s)
    
    # Limita o tamanho (máximo 50 caracteres)
    if len(s) > 50:
        s = s[:50].rstrip('-')
    
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
    """Tenta extrair Front Matter do README. Retorna dict vazio se falhar."""
    try:
        if not readme_text.startswith("---"):
            return {}, readme_text

        parts = readme_text.split("---", 2)
        if len(parts) < 3:
            return {}, readme_text

        yaml_block = parts[1].strip()
        markdown = parts[2].lstrip("\n")

        meta = yaml.safe_load(yaml_block) or {}
        return meta, markdown
    except Exception as e:
        print(f"⚠️ Erro ao fazer parse do README front matter: {e}")
        return {}, readme_text


def extract_section(markdown: str, heading: str) -> str:
    pattern = rf"##\s+{re.escape(heading)}\s*\n(.*?)(\n##\s+|\Z)"
    m = re.search(pattern, markdown, flags=re.S)
    return m.group(1).strip() if m else ""


def extract_info_from_pdf_text(pdf_bytes: bytes) -> dict:
    """Extrai informações úteis do texto do PDF."""
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
        text = " ".join((page.extract_text() or "") for page in reader.pages)
        
        info = {}
        
        # Ano
        year_match = re.search(r"\b(20\d{2})\b", text)
        if year_match:
            info["ano"] = year_match.group(1)
        
        # Duração (busca padrões como "40 horas", "120h", etc)
        duration_match = re.search(r"(\d+)\s*(?:horas?|h\b)", text, re.I)
        if duration_match:
            info["duracao"] = f"{duration_match.group(1)} horas"
        
        # Instituição (algumas palavras-chave comuns)
        instituicoes = [
            "Data Science Academy",
            "Coursera",
            "Udemy",
            "USP",
            "ESALQ",
            "Alura",
            "Microsoft",
            "Google",
            "AWS",
            "IBM"
        ]
        
        for inst in instituicoes:
            if inst.lower() in text.lower():
                info["instituicao"] = inst
                break
        
        return info
    except Exception as e:
        print(f"⚠️ Erro ao extrair info do PDF: {e}")
        return {}


def infer_categoria_from_folder(folder_name: str) -> str:
    """Infere categoria baseada no nome da pasta."""
    folder_lower = folder_name.lower()
    
    if any(x in folder_lower for x in ["python", "r ", "sql", "programming", "programação"]):
        return "Programação"
    elif any(x in folder_lower for x in ["bi", "power bi", "tableau", "visualização"]):
        return "Business Intelligence"
    elif any(x in folder_lower for x in ["machine learning", "ml", "deep learning", "ai", "ia"]):
        return "Machine Learning"
    elif any(x in folder_lower for x in ["data science", "ciência de dados", "analytics"]):
        return "Data Science"
    elif any(x in folder_lower for x in ["excel", "office"]):
        return "Produtividade"
    elif any(x in folder_lower for x in ["cloud", "aws", "azure", "gcp"]):
        return "Cloud Computing"
    else:
        return "Diversos"


def load_existing_data(path: str) -> dict:
    """Carrega dados existentes indexados por ID."""
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


def merge_certificate_data(existing: dict, new: dict) -> dict:
    """
    Mescla dados existentes com novos, preservando informações importantes.
    Prioriza dados do README quando disponíveis.
    """
    merged = existing.copy()
    
    # Atualiza campos básicos (só se o novo tiver valor)
    for key in ["titulo", "tipo", "instituicao", "categoria", "duracao", "descricao", "descricaoCompleta"]:
        if new.get(key):
            merged[key] = new[key]
    
    # Atualiza destaque
    if "destaque" in new:
        merged["destaque"] = new["destaque"]
    
    # Atualiza ano (se novo tiver)
    if new.get("ano"):
        merged["ano"] = new["ano"]
    
    # Atualiza thumbnail
    if new.get("thumbnail"):
        merged["thumbnail"] = new["thumbnail"]
    
    # Atualiza competências
    if new.get("competencias"):
        merged["competencias"] = new["competencias"]
    
    # Merge certificados (adiciona novos, mantém existentes)
    existing_certs = {c["nome"]: c for c in merged.get("certificados", [])}
    new_certs = {c["nome"]: c for c in new.get("certificados", [])}
    
    # Atualiza certificados existentes e adiciona novos
    existing_certs.update(new_certs)
    merged["certificados"] = list(existing_certs.values())
    merged["totalCertificados"] = len(merged["certificados"])
    
    # Atualiza links
    if new.get("githubFolder"):
        merged["githubFolder"] = new["githubFolder"]
    
    # Adiciona timestamp de última atualização
    merged["lastUpdated"] = datetime.now().isoformat()
    
    return merged


# =========================
# MAIN
# =========================
def main():
    print(f"\n{'='*60}")
    print(f"🔄 EXTRAÇÃO INCREMENTAL DE CERTIFICADOS")
    print(f"{'='*60}\n")
    
    # Carrega dados existentes
    existing_by_id = load_existing_data(OUTPUT_JSON)
    print(f"📊 Certificados existentes: {len(existing_by_id)}")
    
    result_by_id = {}
    new_count = 0
    updated_count = 0
    skipped_count = 0

    root = gh_contents("")
    folders = [x for x in root if x.get("type") == "dir"]

    for folder in sorted(folders, key=lambda x: x.get("name", "").lower()):
        folder_name = folder["name"]
        folder_path = folder["path"]

        print(f"\n📁 Processando: {folder_name}")

        try:
            items = gh_contents(folder_path)
        except Exception as e:
            print(f"❌ Erro ao acessar {folder_name}: {e}")
            continue

        # ✅ Tenta ler README (mas não é obrigatório)
        readme = next((x for x in items if x.get("type") == "file" and x.get("name", "").lower() == "readme.md"), None)
        
        meta = {}
        descricao = ""
        descricao_completa = ""
        
        if readme:
            try:
                readme_text = requests.get(readme["download_url"], timeout=60).text
                meta, md = parse_readme_frontmatter(readme_text)
                descricao = extract_section(md, "📌 Descrição curta")
                descricao_completa = extract_section(md, "📖 Descrição completa")
                print(f"  ✓ README encontrado e processado")
            except Exception as e:
                print(f"  ⚠️ Erro ao processar README: {e}")
        else:
            print(f"  ⚠️ Sem README - usando valores padrão")

        # ✅ Busca PDFs
        pdf_files = [x for x in items if x.get("type") == "file" and x.get("name", "").lower().endswith(".pdf")]
        
        if not pdf_files:
            print(f"  ⚠️ Nenhum PDF encontrado, pulando pasta")
            continue

        print(f"  ✓ {len(pdf_files)} PDF(s) encontrado(s)")

        # ✅ ID da pasta
        folder_id = meta.get("id") or slugify(folder_name)

        # ✅ Verifica se já existe
        existing_item = existing_by_id.get(folder_id)
        is_new = existing_item is None

        # ✅ PDF de formação (para ano e thumbnail)
        formacao_pdf = next((p for p in pdf_files if "formação" in p["name"].lower()), None)

        # ✅ Informações extraídas do primeiro PDF (se não tiver README)
        extracted_info = {}
        ano = meta.get("ano")
        
        if formacao_pdf and formacao_pdf.get("download_url"):
            try:
                form_bytes = download_bytes(formacao_pdf["download_url"], timeout=120)
                extracted_info = extract_info_from_pdf_text(form_bytes)
                if not ano:
                    ano = extracted_info.get("ano")

                # Gera preview do certificado de formação (só se não existir)
                out_png = preview_output_file(folder_id, formacao_pdf["name"])
                render_pdf_first_page_to_png(form_bytes, out_png, zoom=2.0, overwrite=False)
                if os.path.exists(out_png):
                    print(f"  ✓ Preview: {formacao_pdf['name']}")
            except Exception as e:
                print(f"  ⚠️ Erro ao processar PDF de formação: {e}")
        elif pdf_files:
            # Se não tem formação, usa o primeiro PDF
            try:
                first_pdf = pdf_files[0]
                first_bytes = download_bytes(first_pdf["download_url"], timeout=120)
                extracted_info = extract_info_from_pdf_text(first_bytes)
                if not ano:
                    ano = extracted_info.get("ano")
            except Exception as e:
                print(f"  ⚠️ Erro ao extrair info do primeiro PDF: {e}")

        # ✅ Processa todos os certificados
        certificados = []
        for p in sorted(pdf_files, key=lambda x: x["name"].lower()):
            pdf_name = p["name"]
            is_formacao = ("formação" in pdf_name.lower())

            # Gera preview (só se não existir)
            try:
                out_png = preview_output_file(folder_id, pdf_name)
                if not os.path.exists(out_png):
                    pdf_bytes = download_bytes(p["download_url"], timeout=120)
                    render_pdf_first_page_to_png(pdf_bytes, out_png, zoom=2.0, overwrite=False)
                    print(f"  ✓ Preview criado: {pdf_name}")
                else:
                    print(f"  ↻ Preview existente: {pdf_name}")
            except Exception as e:
                print(f"  ⚠️ Falha gerando preview: {pdf_name} -> {e}")

            certificados.append({
                "nome": pdf_name,
                "url": f"https://github.com/{OWNER}/{REPO}/blob/{BRANCH}/{quote(folder_path)}/{quote(pdf_name)}",
                "preview": normalize_preview_path(folder_id, pdf_name),
                "isFormacao": is_formacao
            })

        # ✅ Thumbnail automático
        thumbnail = meta.get("thumbnail")
        if not thumbnail and formacao_pdf:
            thumbnail = normalize_preview_path(folder_id, formacao_pdf["name"])
        elif not thumbnail and pdf_files:
            thumbnail = normalize_preview_path(folder_id, pdf_files[0]["name"])
        
        if not thumbnail:
            thumbnail = f"assets/img/certificados/{folder_id}-thumb.png"

        # ✅ Usa valores do README ou infere/extrai do PDF
        titulo = meta.get("titulo") or folder_name.replace("-", " ").title()
        instituicao = meta.get("instituicao") or extracted_info.get("instituicao", "")
        duracao = meta.get("duracao") or extracted_info.get("duracao", "")
        categoria = meta.get("categoria") or infer_categoria_from_folder(folder_name)
        
        # ✅ Descrição padrão se não houver
        if not descricao:
            descricao = f"Certificação em {titulo}"
            if instituicao:
                descricao += f" pela {instituicao}"
        
        if not descricao_completa:
            descricao_completa = descricao

        # ✅ Cria novo item
        new_item = {
            "id": folder_id,
            "titulo": titulo,
            "tipo": meta.get("tipo", "Formação"),
            "instituicao": instituicao,
            "categoria": categoria,
            "duracao": duracao,
            "destaque": bool(meta.get("destaque", False)),
            "thumbnail": thumbnail,
            "competencias": meta.get("competencias", []) or [],
            "descricao": descricao,
            "descricaoCompleta": descricao_completa,
            "certificados": certificados,
            "totalCertificados": len(certificados),
            "githubFolder": f"https://github.com/{OWNER}/{REPO}/tree/{BRANCH}/{quote(folder_path)}",
            "status": "Concluído",
            "ano": ano or "",
        }

        # ✅ Merge com dados existentes
        if existing_item:
            result_by_id[folder_id] = merge_certificate_data(existing_item, new_item)
            updated_count += 1
            print(f"  🔄 Atualizado: {folder_name}")
        else:
            result_by_id[folder_id] = new_item
            new_count += 1
            print(f"  ✅ Novo: {folder_name}")

    # Preserva itens antigos que não foram processados agora
    for old_id, old_item in existing_by_id.items():
        if old_id not in result_by_id:
            result_by_id[old_id] = old_item
            skipped_count += 1

    final_list = list(result_by_id.values())
    
    # Ordena por destaque e depois por título
    final_list.sort(key=lambda x: (not x.get("destaque", False), x.get("titulo", "").lower()))
    
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(final_list, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"✅ certificados.json atualizado!")
    print(f"📊 Estatísticas:")
    print(f"   • Total: {len(final_list)} certificados")
    print(f"   • Novos: {new_count}")
    print(f"   • Atualizados: {updated_count}")
    print(f"   • Mantidos: {skipped_count}")
    print(f"📁 Previews em: {ASSETS_PREVIEW_ROOT}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
