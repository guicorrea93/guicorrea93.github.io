#!/usr/bin/env python3
"""
Script para criar thumbnails dos diplomas automaticamente
Converte PDFs e imagens para o tamanho correto (800x600px)

Requisitos:
- pip install Pillow pdf2image
- No Linux/Mac: sudo apt install poppler-utils (ou brew install poppler)
- No Windows: baixe poppler-windows e adicione ao PATH
"""

import os
from pathlib import Path
from PIL import Image
from pdf2image import convert_from_path

# Configurações
INPUT_DIR = "diplomas_originais"  # Pasta com os diplomas originais
OUTPUT_DIR = "assets/img/diplomas"  # Pasta de saída
THUMB_SIZE = (800, 600)
QUALITY = 90

# Mapeamento de arquivos
DIPLOMAS = {
    "mba-thumb.jpg": "MBA.pdf",
    "pos-gestao-thumb.jpg": "Pós-Graduação - Gestão Estratégica de Negócios.pdf",
    "graduacao-thumb.jpg": "Graduação.jpg"
}


def criar_pasta_saida():
    """Cria a pasta de saída se não existir"""
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    print(f"✅ Pasta de saída criada: {OUTPUT_DIR}")


def converter_pdf_para_imagem(pdf_path):
    """Converte a primeira página de um PDF para imagem"""
    print(f"📄 Convertendo PDF: {pdf_path}")
    try:
        # Converte apenas a primeira página (índice 0)
        images = convert_from_path(
            pdf_path,
            first_page=1,
            last_page=1,
            dpi=300  # Alta qualidade
        )
        return images[0]
    except Exception as e:
        print(f"❌ Erro ao converter PDF: {e}")
        return None


def processar_imagem(img, output_path):
    """Processa e salva a imagem no tamanho correto"""
    try:
        # Calcula o crop centralizado
        width, height = img.size
        target_ratio = THUMB_SIZE[0] / THUMB_SIZE[1]  # 4:3
        current_ratio = width / height

        if current_ratio > target_ratio:
            # Imagem muito larga - crop nas laterais
            new_width = int(height * target_ratio)
            left = (width - new_width) // 2
            img = img.crop((left, 0, left + new_width, height))
        else:
            # Imagem muito alta - crop no topo/base
            new_height = int(width / target_ratio)
            top = 0  # Mantém o topo (cabeçalho do diploma)
            img = img.crop((0, top, width, top + new_height))

        # Redimensiona para o tamanho final
        img = img.resize(THUMB_SIZE, Image.Resampling.LANCZOS)

        # Converte para RGB se necessário (remove alpha)
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background

        # Salva com qualidade alta
        img.save(output_path, 'JPEG', quality=QUALITY, optimize=True)
        print(f"✅ Thumbnail criado: {output_path}")
        return True

    except Exception as e:
        print(f"❌ Erro ao processar imagem: {e}")
        return False


def criar_thumbnails():
    """Processa todos os diplomas e cria os thumbnails"""
    criar_pasta_saida()
    
    sucesso = 0
    erros = 0

    for output_name, input_name in DIPLOMAS.items():
        input_path = Path(INPUT_DIR) / input_name
        output_path = Path(OUTPUT_DIR) / output_name

        print(f"\n{'='*60}")
        print(f"Processando: {input_name} → {output_name}")
        print(f"{'='*60}")

        # Verifica se o arquivo de entrada existe
        if not input_path.exists():
            print(f"⚠️  Arquivo não encontrado: {input_path}")
            erros += 1
            continue

        # Processa baseado no tipo
        if input_path.suffix.lower() == '.pdf':
            img = converter_pdf_para_imagem(input_path)
        else:
            try:
                img = Image.open(input_path)
            except Exception as e:
                print(f"❌ Erro ao abrir imagem: {e}")
                img = None

        if img:
            if processar_imagem(img, output_path):
                sucesso += 1
            else:
                erros += 1
        else:
            erros += 1

    # Resumo
    print(f"\n{'='*60}")
    print(f"🎉 RESUMO")
    print(f"{'='*60}")
    print(f"✅ Sucesso: {sucesso}/{len(DIPLOMAS)}")
    print(f"❌ Erros: {erros}/{len(DIPLOMAS)}")

    if sucesso > 0:
        print(f"\n📂 Thumbnails salvos em: {OUTPUT_DIR}")


def criar_placeholder():
    """Cria uma imagem placeholder simples"""
    placeholder_path = Path(OUTPUT_DIR) / "placeholder-diploma.png"
    
    try:
        # Cria uma imagem simples com gradiente
        img = Image.new('RGB', THUMB_SIZE, color='#1F2937')
        
        # Adiciona um texto simples (requer PIL com suporte a fontes)
        from PIL import ImageDraw, ImageFont
        
        draw = ImageDraw.Draw(img)
        
        # Texto centralizado
        text = "DIPLOMA"
        
        try:
            # Tenta usar uma fonte do sistema
            font = ImageFont.truetype("arial.ttf", 60)
        except:
            # Fallback para fonte padrão
            font = ImageFont.load_default()
        
        # Centraliza o texto
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        x = (THUMB_SIZE[0] - text_width) // 2
        y = (THUMB_SIZE[1] - text_height) // 2
        
        draw.text((x, y), text, fill='#D4AF37', font=font)
        
        img.save(placeholder_path, 'PNG', optimize=True)
        print(f"✅ Placeholder criado: {placeholder_path}")
        
    except Exception as e:
        print(f"⚠️  Não foi possível criar placeholder: {e}")
        print("💡 Você pode baixar um ícone de diploma manualmente")


def main():
    """Função principal"""
    print("""
╔═══════════════════════════════════════════════════════════╗
║           🎓 CRIADOR DE THUMBNAILS DE DIPLOMAS            ║
╚═══════════════════════════════════════════════════════════╝
    """)

    # Verifica se a pasta de entrada existe
    if not Path(INPUT_DIR).exists():
        print(f"⚠️  Pasta '{INPUT_DIR}' não encontrada!")
        print(f"💡 Crie a pasta e coloque os diplomas originais nela:")
        print(f"   - MBA.pdf")
        print(f"   - Pós-Graduação - Gestão Estratégica de Negócios.pdf")
        print(f"   - Graduação.jpg")
        return

    # Cria os thumbnails
    criar_thumbnails()

    # Cria o placeholder
    print(f"\n{'='*60}")
    print("🖼️  Criando placeholder...")
    print(f"{'='*60}")
    criar_placeholder()

    print("""
╔═══════════════════════════════════════════════════════════╗
║                         ✨ CONCLUÍDO!                      ║
╚═══════════════════════════════════════════════════════════╝

Próximos passos:
1. Verifique as imagens em: assets/img/diplomas/
2. Copie os diplomas originais do GitHub para 'diplomas_originais/'
3. Execute este script novamente se necessário
    """)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Operação cancelada pelo usuário")
    except Exception as e:
        print(f"\n❌ Erro inesperado: {e}")
        import traceback
        traceback.print_exc()