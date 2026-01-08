"""
Processador Simples de Certificados
====================================

O QUE FAZ:
1. Varre pastas do repo certificados
2. Lê README.md (se existir)
3. Gera certificados.json
4. Cria previews PNG dos PDFs (nomes curtos)
5. Pula pastas já processadas

NÃO FAZ:
- Não cria/modifica READMEs
- Não cria .meta.json
- Não faz scraping de sites
- Não pede input interativo
"""

import os
import re
import json
import yaml
import requests
from urllib.parse import quote
from pypdf import PdfReader
from io import BytesIO
from pathlib import Path
import fitz  # pymupdf


# =========================
# CONFIG
# =========================
OWNER = "guicorrea93"
REPO = "certificados"
BRANCH = "main"

API_BASE = "https://api.github.com"
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

HEADERS = {"Accept": "application/vnd.github+json"}
if GITHUB_TOKEN:
    HEADERS["Authorization"] = f"Bearer {GITHUB_TOKEN}"

SCRIPT_DIR = Path(__file__).parent
OUTPUT_JSON = SCRIPT_DIR / "certificados.json"
SITE_ROOT = SCRIPT_DIR.parent
ASSETS_PREVIEW_ROOT = SITE_ROOT / "assets" / "img" / "certificados"


# =========================
# HELPERS
# =========================

def gh_contents(path: str):
    """Lista conteúdo via GitHub API."""
    url = f"{API_BASE}/repos/{OWNER}/{REPO}/contents/{quote(path)}"
    r = requests.get(url, headers=HEADERS, params={"ref": BRANCH}, timeout=60)
    r.raise_for_status()
    return r.json()


def download_bytes(url: str, timeout=120) -> bytes:
    """Baixa arquivo como bytes."""
    r = requests.get(url, timeout=timeout)
    r.raise_for_status()
    return r.content


def slugify(s: str) -> str:
    """Gera slug limpo e CURTO (máx 50 chars)."""
    s = s.lower().strip()
    s = re.sub(r"\.pdf$", "", s, flags=re.I)
    
    # Remove acentos
    replacements = {
        'ã': 'a', 'á': 'a', 'â': 'a', 'à': 'a',
        'é': 'e', 'ê': 'e', 'è': 'e',
        'í': 'i', 'î': 'i', 'ì': 'i',
        'ó': 'o', 'ô': 'o', 'õ': 'o', 'ò': 'o',
        'ú': 'u', 'û': 'u', 'ù': 'u',
        'ç': 'c'
    }
    
    for old, new in replacements.items():
        s = s.replace(old, new)
    
    # Remove caracteres especiais
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    
    # Limita tamanho (evita erros de path muito longo)
    if len(s) > 50:
        s = s[:50].rstrip('-')
    
    return s


def parse_readme_frontmatter(readme_text: str) -> tuple:
    """Extrai YAML front matter do README."""
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
        print(f"    ⚠️ Erro no YAML: {e}")
        return {}, readme_text


def extract_section(markdown: str, heading: str) -> str:
    """Extrai seção do markdown por heading."""
    pattern = rf"##\s+{re.escape(heading)}\s*\n(.*?)(\n##\s+|\Z)"
    m = re.search(pattern, markdown, flags=re.S)
    return m.group(1).strip() if m else ""


def extract_year_from_pdf(pdf_bytes: bytes) -> str | None:
    """Extrai ano do PDF."""
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
        text = " ".join((page.extract_text() or "") for page in reader.pages)
        m = re.search(r"\b(20\d{2})\b", text)
        return m.group(1) if m else None
    except:
        return None


def render_pdf_to_png(pdf_bytes: bytes, out_path: Path, zoom: float = 2.0) -> bool:
    """
    Renderiza primeira página do PDF como PNG.
    Retorna True se criou, False se já existia.
    """
    if out_path.exists():
        return False  # Já existe, não refaz
    
    out_path.parent.mkdir(parents=True, exist_ok=True)
    
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page = doc.load_page(0)
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    pix.save(str(out_path))
    doc.close()
    
    return True


def normalize_preview_path(folder_id: str, pdf_filename: str) -> str:
    """Path do preview para usar no JSON (relativo ao site)."""
    return f"assets/img/certificados/{folder_id}/{slugify(pdf_filename)}.png"


def preview_file_path(folder_id: str, pdf_filename: str) -> Path:
    """Path físico onde salvar o PNG."""
    return ASSETS_PREVIEW_ROOT / folder_id / f"{slugify(pdf_filename)}.png"


def infer_categoria(folder_name: str) -> str:
    """Infere categoria baseado no nome da pasta."""
    fn = folder_name.lower()
    
    if any(x in fn for x in ["python", "sql", "java", "javascript", "r-"]):
        return "Programação"
    elif any(x in fn for x in ["power bi", "tableau", "visualizacao"]):
        return "Business Intelligence"
    elif any(x in fn for x in ["machine learning", "deep learning", "ai", "ia"]):
        return "Machine Learning"
    elif any(x in fn for x in ["data science", "analytics"]):
        return "Data Science"
    elif any(x in fn for x in ["excel", "office"]):
        return "Produtividade"
    elif any(x in fn for x in ["aws", "azure", "cloud", "gcp"]):
        return "Cloud Computing"
    else:
        return "Diversos"


# =========================
# PROCESSAMENTO
# =========================

def is_folder_processed(folder_id: str, existing_data: dict) -> bool:
    """
    Verifica se pasta já foi processada.
    Critério: existe no JSON E tem pelo menos 1 preview gerado.
    """
    if folder_id not in existing_data:
        return False
    
    # Verifica se tem pelo menos 1 preview
    folder_preview_dir = ASSETS_PREVIEW_ROOT / folder_id
    if not folder_preview_dir.exists():
        return False
    
    png_files = list(folder_preview_dir.glob("*.png"))
    return len(png_files) > 0


def process_folder(folder_name: str, folder_path: str, existing_data: dict) -> dict | None:
    """Processa uma pasta de certificados."""
    
    folder_id = slugify(folder_name)
    
    # ✅ PULA SE JÁ FOI PROCESSADA
    if is_folder_processed(folder_id, existing_data):
        print(f"  ⏭️  Já processada, pulando")
        return existing_data[folder_id]
    
    print(f"\n📂 {folder_name}")
    
    try:
        items = gh_contents(folder_path)
    except Exception as e:
        print(f"  ❌ Erro ao acessar: {e}")
        return None
    
    # Busca README e PDFs
    readme_file = next((x for x in items if x.get("type") == "file" and x["name"].lower() == "readme.md"), None)
    pdf_files = [x for x in items if x.get("type") == "file" and x["name"].lower().endswith(".pdf")]
    
    if not pdf_files:
        print(f"  ⚠️ Sem PDFs")
        return None
    
    print(f"  ✓ {len(pdf_files)} PDF(s)")
    
    # === LÊ README (SE EXISTIR) ===
    meta = {}
    descricao = ""
    descricao_completa = ""
    
    if readme_file:
        try:
            readme_text = requests.get(readme_file["download_url"], timeout=60).text
            meta, markdown = parse_readme_frontmatter(readme_text)
            descricao = extract_section(markdown, "📌 Descrição curta")
            descricao_completa = extract_section(markdown, "📖 Descrição completa")
            print(f"  ✓ README processado")
        except Exception as e:
            print(f"  ⚠️ Erro ao ler README: {e}")
    else:
        print(f"  ⚠️ Sem README")
    
    # === BUSCA ANO NO PDF DE FORMAÇÃO ===
    formacao_pdf = next((p for p in pdf_files if "formação" in p["name"].lower() or "formacao" in p["name"].lower()), None)
    ano = meta.get("ano")
    
    if not ano and formacao_pdf:
        try:
            pdf_bytes = download_bytes(formacao_pdf["download_url"], timeout=120)
            ano = extract_year_from_pdf(pdf_bytes)
        except:
            pass
    
    # === PROCESSA CERTIFICADOS ===
    certificados = []
    
    for pdf in sorted(pdf_files, key=lambda x: x["name"].lower()):
        pdf_name = pdf["name"]
        is_formacao = "formação" in pdf_name.lower() or "formacao" in pdf_name.lower()
        
        # Gera preview
        try:
            pdf_bytes = download_bytes(pdf["download_url"], timeout=120)
            out_png = preview_file_path(folder_id, pdf_name)
            
            was_created = render_pdf_to_png(pdf_bytes, out_png, zoom=2.0)
            
            if was_created:
                print(f"  🖼️  {pdf_name[:40]}...")
        except Exception as e:
            print(f"  ⚠️ Erro preview {pdf_name}: {e}")
        
        certificados.append({
            "nome": pdf_name,
            "url": f"https://github.com/{OWNER}/{REPO}/blob/{BRANCH}/{quote(folder_path)}/{quote(pdf_name)}",
            "preview": normalize_preview_path(folder_id, pdf_name),
            "isFormacao": is_formacao
        })
    
    # === MONTA ITEM ===
    titulo = meta.get("titulo") or folder_name.replace("-", " ").title()
    instituicao = meta.get("instituicao", "")
    duracao = meta.get("duracao", "")
    categoria = meta.get("categoria") or infer_categoria(folder_name)
    
    if not descricao:
        descricao = f"Certificação em {titulo}"
        if instituicao:
            descricao += f" pela {instituicao}"
    
    if not descricao_completa:
        descricao_completa = descricao
    
    # Thumbnail
    thumbnail = meta.get("thumbnail")
    if not thumbnail and formacao_pdf:
        thumbnail = normalize_preview_path(folder_id, formacao_pdf["name"])
    elif not thumbnail and certificados:
        thumbnail = certificados[0]["preview"]
    
    if not thumbnail:
        thumbnail = f"assets/img/certificados/{folder_id}-thumb.png"
    
    item = {
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
    
    print(f"  ✅ Processado")
    return item


# =========================
# MAIN
# =========================

def main():
    print(f"\n{'='*70}")
    print(f"📋 PROCESSADOR SIMPLES DE CERTIFICADOS")
    print(f"{'='*70}\n")
    
    # Carrega JSON existente
    existing_data = {}
    if OUTPUT_JSON.exists():
        with open(OUTPUT_JSON, 'r', encoding='utf-8') as f:
            data = json.load(f)
            existing_data = {item["id"]: item for item in data if isinstance(item, dict)}
        print(f"📊 {len(existing_data)} certificados já existentes\n")
    
    # Busca pastas no GitHub
    root = gh_contents("")
    folders = [x for x in root if x.get("type") == "dir"]
    
    print(f"📁 {len(folders)} pasta(s) encontrada(s)\n")
    
    # Processa cada pasta
    result = {}
    for folder in sorted(folders, key=lambda x: x["name"].lower()):
        try:
            data = process_folder(folder["name"], folder["path"], existing_data)
            if data:
                result[data["id"]] = data
        except Exception as e:
            print(f"  ❌ Erro: {e}")
    
    # Preserva dados antigos não reprocessados
    for old_id, old_data in existing_data.items():
        if old_id not in result:
            result[old_id] = old_data
    
    # Ordena e salva
    final_list = sorted(
        result.values(),
        key=lambda x: (not x.get("destaque", False), x.get("titulo", "").lower())
    )
    
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(final_list, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*70}")
    print(f"✅ PROCESSAMENTO CONCLUÍDO!")
    print(f"📊 Total: {len(final_list)} certificados")
    print(f"📄 JSON: {OUTPUT_JSON}")
    print(f"🖼️  Previews: {ASSETS_PREVIEW_ROOT}")
    print(f"{'='*70}\n")


if __name__ == "__main__":
    main()
