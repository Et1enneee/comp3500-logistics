#!/usr/bin/env python3
"""Render the submission Markdown, preserving external links and repository SVG figures.

Run at repository root with Python/reportlab and ImageMagick installed. Figure PNGs
are built in a temporary directory from the checked-in main-branch SVG files.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from xml.sax.saxutils import escape
import re, subprocess
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfdoc
from reportlab.pdfbase.pdfutils import asciiBase85Encode
import zlib
# Preserve bilevel PNG pixels as one-bit PDF images instead of expanding to RGB.
_original_image_loader = pdfdoc.PDFImageXObject.loadImageFromSRC
def _load_bilevel(self, image):
    if image._image.mode != '1':
        return _original_image_loader(self, image)
    self.width, self.height = image.getSize()
    self.streamContent = asciiBase85Encode(zlib.compress(image._image.tobytes(), 9))
    self._filters = ('ASCII85Decode', 'FlateDecode')
    self.colorSpace = 'DeviceGray'
    self.bitsPerComponent = 1
    self.mask = None
pdfdoc.PDFImageXObject.loadImageFromSRC = _load_bilevel
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether

root=Path(__file__).resolve().parents[2]
src=root/'docs/submission/report.md'
out=root/'docs/submission/report.pdf'
styles={
 'url':ParagraphStyle('url',fontName='Helvetica',fontSize=9,leading=12,textColor=colors.HexColor('#1764a5'),spaceAfter=9),
 'title':ParagraphStyle('title',fontName='Helvetica-Bold',fontSize=18,leading=21,textColor=colors.HexColor('#1d2935'),spaceAfter=7),
 'h2':ParagraphStyle('h2',fontName='Helvetica-Bold',fontSize=12,leading=15,textColor=colors.HexColor('#175989'),spaceBefore=9,spaceAfter=5,keepWithNext=True),
 'body':ParagraphStyle('body',fontName='Helvetica',fontSize=10.3,leading=13.2,textColor=colors.HexColor('#262c30'),spaceAfter=6),
 'cell':ParagraphStyle('cell',fontName='Helvetica',fontSize=9.1,leading=11,textColor=colors.HexColor('#262c30')),
 'head':ParagraphStyle('head',fontName='Helvetica-Bold',fontSize=9.1,leading=11,textColor=colors.HexColor('#234357')),
 'caption':ParagraphStyle('caption',fontName='Helvetica',fontSize=9,leading=11,textColor=colors.HexColor('#555f67'),spaceAfter=7),
}

def inline(s):
    s=escape(s)
    s=re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)',r'<link href="\2" color="#1764a5">\1</link>',s)
    s=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',s)
    s=re.sub(r'(?<![\w.*])\*([^*]+)\*',r'<i>\1</i>',s)
    s=re.sub(r'`([^`]+)`',r'<font name="Courier">\1</font>',s)
    return s.replace('  \n','<br/>').replace('\n',' ')

def table(lines):
    rows=[[c.strip() for c in line.strip().strip('|').split('|')] for line in lines]
    rows=[rows[0]]+rows[2:]
    n=len(rows[0]); weights=[.30,.33,.37] if n==3 else [1/n]*n
    if rows[0][0]=='Risk': weights=[.18,.51,.31]
    if rows[0][0]=='Feedback': weights=[.26,.48,.26]
    data=[[Paragraph(inline(c),styles['head' if i==0 else 'cell']) for c in row] for i,row in enumerate(rows)]
    t=Table(data,colWidths=[w*(A4[0]-80) for w in weights],hAlign='LEFT',repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#edf4f8')),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),.5,colors.HexColor('#b9cbd6')),('LINEBELOW',(0,1),(-1,-1),.25,colors.HexColor('#e0e5e8')),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3)]))
    return t

text=src.read_text(encoding='utf-8')
lines=text.splitlines(); story=[]; i=0
with TemporaryDirectory() as td:
  while i<len(lines):
    line=lines[i]
    if not line.strip(): i+=1; continue
    if line=='<!-- pagebreak -->': story.append(PageBreak()); i+=1; continue
    if i==0:
      story.append(Paragraph('<link href="%s">%s</link>'%(escape(line),escape(line)),styles['url'])); i+=1; continue
    if line.startswith('# '): story.append(Paragraph(inline(line[2:]),styles['title'])); i+=1; continue
    if line.startswith('## '): story.append(Paragraph(inline(line[3:]),styles['h2'])); i+=1; continue
    if line.startswith('|'):
      j=i
      while j<len(lines) and lines[j].startswith('|'): j+=1
      story.extend([table(lines[i:j]),Spacer(1,5)]); i=j; continue
    if line.startswith('!['):
      url=re.search(r'\]\(([^)]+)\)',line).group(1)
      suffix=url.split('/main/',1)[1]
      svg=root/suffix; png=Path(td)/(svg.stem+'.png')
      raw=Path(td)/(svg.stem+'-raw.png')
      subprocess.run(['node',str(root/'docs/submission/render-svg.cjs'),str(svg),str(raw)],check=True)
      subprocess.run(['magick',str(raw),'-background','white','-alpha','remove','-colorspace','gray','-threshold','80%','-type','bilevel',str(png)],check=True)
      im=Image(str(png)); maxw=A4[0]-90; maxh=570 if 'state-machine' in suffix else (635 if 'usecase' in suffix else 205)
      scale=min(maxw/im.imageWidth,maxh/im.imageHeight)
      im.drawWidth=im.imageWidth*scale;im.drawHeight=im.imageHeight*scale; im.hAlign='CENTER';story.append(im);i+=1;continue
    j=i
    while j<len(lines) and lines[j].strip() and not lines[j].startswith(('#','|','![','<!--')): j+=1
    para='\n'.join(lines[i:j]); style=styles['caption'] if para.startswith('*Figure') else styles['body']
    story.append(Paragraph(inline(para),style)); i=j
  doc=SimpleDocTemplate(str(out),pagesize=A4,leftMargin=40,rightMargin=40,topMargin=38,bottomMargin=36,title='COMP 3500SEF Final Report — Group 42',author='Group 42',pageCompression=1)
  doc.build(story)
# ReportLab uses four binary marker bytes in the PDF comment. An ASCII marker is
# valid and lets the GitHub text-only transport preserve the PDF bytes exactly.
b=out.read_bytes().replace(b'%\x93\x8c\x8b\x9e ReportLab',b'%---- ReportLab',1)
assert all(x<128 for x in b), 'unexpected binary PDF byte'
out.write_bytes(b)
print('PDF:',out.relative_to(root),'bytes:',len(b))
