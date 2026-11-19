"""Miniatura de certificado: 1a pagina do PDF -> recorte do bloco principal
(sem margens brancas nem cabecalho/rodape de impressao) -> WebP 900px."""
import io

import numpy as np
from PIL import Image


def _maior_trecho(perfil, limiar, folga):
    """Maior trecho continuo onde perfil > limiar, tolerando buracos de ate `folga`."""
    trechos, atual, vazio = [], None, 0
    for i, ativo in enumerate(perfil > limiar):
        if ativo:
            if atual is None:
                atual = [i, i]
            atual[1] = i
            vazio = 0
        elif atual is not None:
            vazio += 1
            if vazio > folga:
                trechos.append(tuple(atual))
                atual, vazio = None, 0
    if atual is not None:
        trechos.append(tuple(atual))
    if not trechos:
        return 0, len(perfil)
    ini, fim = max(trechos, key=lambda t: t[1] - t[0])
    return ini, fim + 1


def recortar(img, margem=4):
    rgb = img.convert("RGB")
    g = np.asarray(rgb.convert("L"), dtype=np.int16)
    h, w = g.shape
    conteudo = g < 235
    y0, y1 = _maior_trecho(conteudo.mean(axis=1), 0.02, folga=max(6, h // 60))
    x0, x1 = _maior_trecho(conteudo[y0:y1].mean(axis=0), 0.02, folga=max(6, w // 60))
    if (y1 - y0) < h * 0.5 or (x1 - x0) < w * 0.5:
        return rgb
    # so recorta se o que sai for quase todo branco (protege artes que vao ate a borda)
    fora = conteudo.copy()
    fora[y0:y1, x0:x1] = False
    area_fora = conteudo.size - (y1 - y0) * (x1 - x0)
    if area_fora and fora.sum() / area_fora > 0.03:
        return rgb
    return rgb.crop((max(0, x0 - margem), max(0, y0 - margem), min(w, x1 + margem), min(h, y1 + margem)))


def pdf_para_webp(pdf, destino, largura=900, qualidade=80):
    import pymupdf
    pagina = pymupdf.open(pdf)[0]
    img = Image.open(io.BytesIO(pagina.get_pixmap(matrix=pymupdf.Matrix(2, 2)).tobytes("png")))
    img = recortar(img)
    if img.width > largura:
        img = img.resize((largura, round(img.height * largura / img.width)), Image.LANCZOS)
    img.save(destino, "WEBP", quality=qualidade, method=6)
    return img.size
