from pathlib import Path
import re
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / '学伴小N-产品需求文档-v1.1.md'
OUTPUT = ROOT / '学伴小N-产品需求文档-v1.1.docx'
doc = Document()
section = doc.sections[0]
section.page_width, section.page_height = Cm(21), Cm(29.7)
section.top_margin, section.bottom_margin = Cm(1.9), Cm(1.8)
section.left_margin, section.right_margin = Cm(2), Cm(2)
section.header_distance, section.footer_distance = Cm(.8), Cm(.8)

def set_font(style, size, bold=False):
    style.font.name = 'Hiragino Sans GB'
    style.font.size = Pt(size)
    style.font.bold = bold
    style.font.color.rgb = RGBColor(0, 0, 0)
    rpr = style.element.get_or_add_rPr()
    fonts = rpr.find(qn('w:rFonts'))
    if fonts is None:
        fonts = OxmlElement('w:rFonts'); rpr.append(fonts)
    for key, val in [('ascii','Hiragino Sans GB'),('hAnsi','Hiragino Sans GB'),('eastAsia','Hiragino Sans GB')]:
        fonts.set(qn('w:'+key), val)
    for attr in list(fonts.attrib):
        if attr.endswith('Theme'):del fonts.attrib[attr]
    ppr=style.element.find(qn('w:pPr'))
    if ppr is not None:
        for border in list(ppr.findall(qn('w:pBdr'))):ppr.remove(border)

for name, size, bold in [('Normal',10.5,False),('Title',23,True),('Subtitle',10,False),('Heading 1',16,True),('Heading 2',12,True),('Header',8,False),('Footer',8,False)]:
    set_font(doc.styles[name],size,bold)
normal = doc.styles['Normal'].paragraph_format
normal.space_after = Pt(6)
normal.line_spacing = 1.2
for name in ['Heading 1','Heading 2']:
    pf=doc.styles[name].paragraph_format
    pf.keep_with_next=True
    pf.space_before=Pt(14 if name=='Heading 1' else 10)
    pf.space_after=Pt(7)
doc.styles['Title'].paragraph_format.space_after=Pt(10)
doc.styles['Title'].paragraph_format.keep_with_next=True

header=section.header.paragraphs[0]
header.text='学伴小N  产品需求文档'
footer=section.footer.paragraphs[0]
footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT
footer.add_run('v1.1  ·  2026年10月21日  ·  ')
field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');footer._p.append(field)

def add_text(p,text):
    # Material is plain text; protect CJK line breaking for long source paths.
    text=re.sub(r'`([^`]+)`',r'\1',text)
    chunks=re.split(r'(\*\*.*?\*\*)',text)
    for chunk in chunks:
        if not chunk: continue
        r=p.add_run(chunk[2:-2] if chunk.startswith('**') else chunk)
        if chunk.startswith('**'):r.bold=True

def add_table(rows):
    cols=len(rows[0]); table=doc.add_table(rows=0, cols=cols)
    table.alignment=WD_TABLE_ALIGNMENT.CENTER
    table.autofit=False
    if cols==3:
        # Source/evidence and comparison tables need a compact left label.
        widths=[3.3,6.4,7.3]
        if rows[0][0]=='编号':widths=[1.6,8.1,7.3]
    else: widths=[17/cols]*cols
    for c,w in zip(table.columns,widths):c.width=Cm(w)
    pr=table._tbl.tblPr
    borders=OxmlElement('w:tblBorders')
    for edge in ['top','left','bottom','right','insideH','insideV']:
        el=OxmlElement('w:'+edge);el.set(qn('w:val'),'single');el.set(qn('w:sz'),'4');el.set(qn('w:color'),'D9D9D9');borders.append(el)
    pr.append(borders)
    for i,row in enumerate(rows):
        cells=table.add_row().cells
        trpr=table.rows[-1]._tr.get_or_add_trPr()
        no_split=OxmlElement('w:cantSplit');trpr.append(no_split)
        if i==0:
            repeat=OxmlElement('w:tblHeader');trpr.append(repeat)
        for j,(cell,val) in enumerate(zip(cells,row)):
            cell.width=Cm(widths[j]);cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            tcpr=cell._tc.get_or_add_tcPr()
            margins=OxmlElement('w:tcMar')
            for side,size in [('top','65'),('bottom','65'),('left','90'),('right','90')]:
                el=OxmlElement('w:'+side);el.set(qn('w:w'),size);el.set(qn('w:type'),'dxa');margins.append(el)
            tcpr.append(margins)
            if i==0:
                shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'DCE6F1');tcpr.append(shade)
            p=cell.paragraphs[0]
            p.paragraph_format.space_after=Pt(1)
            p.paragraph_format.line_spacing=1.13
            p.paragraph_format.keep_with_next=False
            if j==0 and (val.startswith('AC') or val.startswith('S0') or val.startswith('S1')):
                p.alignment=WD_ALIGN_PARAGRAPH.CENTER
            val=re.sub(r'([/\-_.])',lambda m:m.group(1)+'\u200b',val) if '/' in val or '.log' in val else val
            add_text(p,val)
            for run in p.runs:
                run.font.size=Pt(9)
                if i==0:run.bold=True
    gap=doc.add_paragraph()
    gap.paragraph_format.space_after=Pt(1)
    gap.paragraph_format.space_before=Pt(1)
    gap.paragraph_format.line_spacing=Pt(2)
    gap.add_run().font.size=Pt(2)

lines=SOURCE.read_text().splitlines();i=0
while i<len(lines):
    line=lines[i].strip()
    if not line:i+=1;continue
    if line.startswith('|'):
        rows=[]
        while i<len(lines) and lines[i].strip().startswith('|'):
            row=[x.strip() for x in lines[i].strip().strip('|').split('|')]
            if not all(re.fullmatch(r':?-+:?',x) for x in row):rows.append(row)
            i+=1
        add_table(rows);continue
    if line.startswith('# '):p=doc.add_paragraph(style='Title');add_text(p,line[2:])
    elif line.startswith('## '):p=doc.add_paragraph(style='Heading 1');add_text(p,line[3:])
    elif line.startswith('### '):p=doc.add_paragraph(style='Heading 2');add_text(p,line[4:])
    elif line.startswith('版本 '):p=doc.add_paragraph(style='Subtitle');add_text(p,line)
    elif line.startswith('- '):
        p=doc.add_paragraph();p.paragraph_format.left_indent=Cm(.35);p.paragraph_format.first_line_indent=Cm(-.35);add_text(p,'• '+line[2:])
    else:p=doc.add_paragraph();add_text(p,line)
    i+=1

doc.core_properties.title='学伴小N产品需求文档'
doc.core_properties.subject='七年级数学学习支持产品需求基线'
doc.core_properties.author='学伴小N项目组'
doc.core_properties.keywords='PRD,学伴小N,需求,七年级数学'
doc.save(OUTPUT)
print(OUTPUT)
print(f'{len(doc.paragraphs)} paragraphs, {len(doc.tables)} tables')
