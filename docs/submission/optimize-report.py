#!/usr/bin/env python3
"""Losslessly encode the generated PDF's bilevel figures; requires Pillow and PyMuPDF.

Usage (after render-report.py): python3 docs/submission/optimize-report.py
The original raster dimensions and pixels, page text, and links are preserved.
"""
import base64
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import pymupdf
from PIL import Image, ImageChops

root = Path(__file__).resolve().parents[2]
pdf = root / 'docs/submission/report.pdf'
source = pymupdf.open(pdf)
with TemporaryDirectory() as temp:
    output = Path(temp) / 'optimized.pdf'
    for page in source:
        for x, _, width, height, *_ in page.get_images(full=True):
            bitmap = Image.frombytes('1', (width, height), source.xref_stream(x))
            buffer = BytesIO()
            bitmap.save(buffer, format='TIFF', compression='group4', strip_size=10000000)
            raw = buffer.getvalue()
            buffer.seek(0)
            tiff = Image.open(buffer)
            offsets, sizes = tiff.tag_v2[273], tiff.tag_v2[279]
            offsets = offsets if isinstance(offsets, tuple) else (offsets,)
            sizes = sizes if isinstance(sizes, tuple) else (sizes,)
            assert len(offsets) == len(sizes) == 1
            encoded = base64.a85encode(raw[offsets[0]:offsets[0] + sizes[0]]) + b'~>'
            source.update_stream(x, encoded, compress=0)
            source.xref_set_key(x, 'Filter', '[/ASCII85Decode /CCITTFaxDecode]')
            source.xref_set_key(x, 'DecodeParms', f'[null <</K -1 /Columns {width} /Rows {height} /BlackIs1 true>>]')
    source.save(output, garbage=4, deflate=True, ascii=True, use_objstms=1)
    source.close()
    data = output.read_bytes().replace(b'%\xc2\xb5\xc2\xb6', b'%----', 1)
    assert all(byte < 128 for byte in data), 'PDF must use ASCII transport'
    output.write_bytes(data)
    old, new = pymupdf.open(pdf), pymupdf.open(output)
    assert len(old) == len(new)
    for a, b in zip(old, new):
        assert a.get_text() == b.get_text()
        assert [(v.get('uri'), v['from']) for v in a.get_links()] == [(v.get('uri'), v['from']) for v in b.get_links()]
        pa, pb = a.get_pixmap(), b.get_pixmap()
        ia = Image.frombytes('RGB', (pa.width, pa.height), pa.samples)
        ib = Image.frombytes('RGB', (pb.width, pb.height), pb.samples)
        assert ImageChops.difference(ia, ib).getbbox() is None, 'image pixels differ'
    old.close(); new.close()
    pdf.write_bytes(data)
print(f'Lossless PDF: {len(data)} bytes; page pixels, text and links match.')
