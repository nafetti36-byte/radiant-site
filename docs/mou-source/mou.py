import sys
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT = sys.argv[1]
NAVY = RGBColor(0x1F,0x3A,0x5F)
doc = Document()
for s in doc.sections:
    s.left_margin = s.right_margin = Cm(1.8); s.top_margin = s.bottom_margin = Cm(1.6)
st = doc.styles['Normal']; st.font.name='Arial'; st.font.size=Pt(10)
st.element.rPr.rFonts.set(qn('w:cs'),'Arial')

def rtl_par(p):
    pPr = p._p.get_or_add_pPr(); b = OxmlElement('w:bidi'); pPr.append(b)
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
def run(p, text, bold=False, ar=False, size=None, color=None):
    r = p.add_run(text); r.bold = bold
    if size: r.font.size = Pt(size)
    if color: r.font.color.rgb = color
    rPr = r._r.get_or_add_rPr()
    f = rPr.find(qn('w:rFonts'))
    if f is None: f = OxmlElement('w:rFonts'); rPr.append(f)
    f.set(qn('w:cs'),'Arial'); f.set(qn('w:ascii'),'Arial'); f.set(qn('w:hAnsi'),'Arial')
    if ar:
        rtl = OxmlElement('w:rtl'); rPr.append(rtl)
        if bold: bcs = OxmlElement('w:bCs'); rPr.append(bcs)
        if size:
            sz = OxmlElement('w:szCs'); sz.set(qn('w:val'), str(int(size*2))); rPr.append(sz)
    return r
def shade(cell, hexcol):
    tcPr = cell._tc.get_or_add_tcPr(); sh = OxmlElement('w:shd')
    sh.set(qn('w:val'),'clear'); sh.set(qn('w:color'),'auto'); sh.set(qn('w:fill'),hexcol); tcPr.append(sh)
def center(text, ar=False, size=12, bold=True, color=NAVY):
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if ar: pPr=p._p.get_or_add_pPr(); pPr.append(OxmlElement('w:bidi'))
    run(p, text, bold=bold, ar=ar, size=size, color=color); return p

def clause(en_title, en_body, ar_title, ar_body):
    t = doc.add_table(rows=2, cols=2); t.style='Table Grid'; t.alignment=WD_TABLE_ALIGNMENT.CENTER
    for c in t.columns: 
        for cell in c.cells: cell.width = Cm(8.7)
    h0, h1 = t.rows[0].cells
    shade(h0,'E8EEF5'); shade(h1,'E8EEF5')
    run(h0.paragraphs[0], en_title, bold=True, color=NAVY)
    p=h1.paragraphs[0]; rtl_par(p); run(p, ar_title, bold=True, ar=True, color=NAVY)
    b0, b1 = t.rows[1].cells
    for i,line in enumerate(en_body):
        p = b0.paragraphs[0] if i==0 else b0.add_paragraph(); run(p, line)
    for i,line in enumerate(ar_body):
        p = b1.paragraphs[0] if i==0 else b1.add_paragraph(); rtl_par(p); run(p, line, ar=True)
    doc.add_paragraph()

center("MEMORANDUM OF UNDERSTANDING", size=16)
center("FOR STRATEGIC COMMERCIAL COLLABORATION", size=12)
center("مذكرة تفاهم للتعاون التجاري الاستراتيجي", ar=True, size=16)
center("Radiant Advising Services  ×  Export Growth (نمو الصادرات)", size=11, bold=False, color=RGBColor(0x44,0x44,0x44))
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
run(p,"DRAFT FOR DISCUSSION — subject to legal review before signature  |  ", size=8, color=RGBColor(0xA0,0x30,0x30))
run(p,"مسودة للنقاش — تخضع للمراجعة القانونية قبل التوقيع", ar=True, size=8, color=RGBColor(0xA0,0x30,0x30))

clause("Parties",
 ["This Memorandum of Understanding (\"MoU\") is made on ____ / ____ / 2026 in Riyadh between:",
  "(1) Radiant Advising Services, registered under no. ____________, address ____________________, represented by Mr. Ahmed Nafetti, Co-Founder (\"Radiant\"); and",
  "(2) Export Growth, Commercial Registration no. ____________, Laysen Valley, Riyadh, Kingdom of Saudi Arabia, represented by Mr. Abdullah Almuharib, Co-Founder (\"Export Growth\").",
  "Each a \"Party\", together the \"Parties\"."],
 "الأطراف",
 ["حُرِّرت مذكرة التفاهم هذه («المذكرة») بتاريخ ____ / ____ / 2026 في مدينة الرياض بين كلٍّ من:",
  "(1) رادينت للخدمات الاستشارية، المسجلة برقم ____________، وعنوانها ____________________، ويمثلها السيد أحمد نفاتي، الشريك المؤسس («رادينت»)؛",
  "(2) نمو الصادرات، سجل تجاري رقم ____________، وادي ليسن، الرياض، المملكة العربية السعودية، ويمثلها الأستاذ عبدالله المحارب، الشريك المؤسس («نمو الصادرات»).",
  "ويُشار إلى كلٍّ منهما بـ«الطرف» وإليهما معاً بـ«الطرفين»."])

clause("1. Purpose",
 ["The Parties wish to cooperate to develop trade between the Kingdom of Saudi Arabia and the Republic of Tunisia (and, by written agreement, Libya and Algeria), by connecting Saudi manufacturers with qualified buyers in the Maghreb, and Tunisian exporters with buyers in the Kingdom."],
 "1. الغرض",
 ["يرغب الطرفان في التعاون لتنمية التجارة بين المملكة العربية السعودية والجمهورية التونسية (وليبيا والجزائر باتفاق كتابي)، وذلك بربط المصانع السعودية بمشترين مؤهلين في المغرب العربي، وربط المصدّرين التونسيين بمشترين في المملكة."])

clause("2. Scope and Product Lines",
 ["Initial priority lines:",
  "(a) Saudi plastics and packaging (film, sheet, PET preforms, specialty resins) to Tunisian converters and distributors;",
  "(b) Saudi building materials and paints to Tunisian distributors and contractors;",
  "(c) Tunisian olive oil, dates and seafood to Saudi retail and HORECA;",
  "(d) Pharmaceuticals, subject to regulatory approvals.",
  "Further lines may be added by written agreement."],
 "2. النطاق وخطوط المنتجات",
 ["خطوط الأولوية المبدئية:",
  "(أ) البلاستيك ومواد التغليف السعودية (أفلام، ألواح، قوالب PET، راتنجات متخصصة) إلى مصانع التحويل والموزعين في تونس؛",
  "(ب) مواد البناء والدهانات السعودية إلى الموزعين والمقاولين في تونس؛",
  "(ج) زيت الزيتون والتمور والمأكولات البحرية التونسية إلى قطاع التجزئة والضيافة في المملكة؛",
  "(د) الأدوية، رهناً بالحصول على الموافقات التنظيمية.",
  "ويجوز إضافة خطوط أخرى باتفاق كتابي."])

clause("3. Roles and Responsibilities",
 ["Export Growth: secure mandates from Saudi factories; verify export readiness, capacity and certifications; provide FOB pricing and certificates of origin; liaise with Saudi Exports and Saudi EXIM; introduce Saudi distributors and retailers for Tunisian products.",
  "Radiant: identify and qualify buyers in Tunisia and the Maghreb; arrange meetings and visits; support negotiation in Arabic and French; provide Tunisian import-regulation checklists; follow up shipments and collections; secure mandates from Tunisian exporters.",
  "Both: maintain a shared deal register, issue a joint monthly report, and participate jointly in relevant trade fairs and missions."],
 "3. الأدوار والمسؤوليات",
 ["نمو الصادرات: الحصول على تفويضات من المصانع السعودية؛ التحقق من جاهزيتها للتصدير وطاقتها الإنتاجية وشهاداتها؛ تقديم أسعار FOB وشهادات المنشأ؛ التنسيق مع هيئة تنمية الصادرات السعودية وبنك التصدير والاستيراد السعودي؛ تقديم الموزعين وتجار التجزئة السعوديين للمنتجات التونسية.",
  "رادينت: تحديد المشترين في تونس والمغرب العربي وتأهيلهم؛ ترتيب الاجتماعات والزيارات؛ دعم التفاوض بالعربية والفرنسية؛ تقديم قوائم متطلبات الاستيراد التونسية؛ متابعة الشحنات والتحصيل؛ الحصول على تفويضات من المصدّرين التونسيين.",
  "الطرفان: الاحتفاظ بسجل مشترك للصفقات، وإصدار تقرير شهري مشترك، والمشاركة المشتركة في المعارض والبعثات التجارية ذات الصلة."])

clause("4. Commission and Fees",
 ["4.1 A success fee of 2.5%–3.5% of the invoice value of each executed transaction shall be agreed with the seller in writing; on repeat orders after the first 12 months it may be reduced to 1.5%–2%.",
  "4.2 Split: 50/50 where each Party introduces one side of the transaction; 70/30 in favour of the originating Party where one Party introduces both sides and the other provides execution support.",
  "4.3 Market-entry services to Saudi factories may be invoiced jointly at a fee agreed per client (indicatively SAR 15,000–30,000) and shared 50/50 unless agreed otherwise.",
  "4.4 Rates are detailed in Annex A."],
 "4. العمولات والأتعاب",
 ["4.1 يُتفق كتابياً مع البائع على عمولة نجاح بنسبة 2.5%–3.5% من قيمة فاتورة كل صفقة منفّذة، ويجوز تخفيضها إلى 1.5%–2% على الطلبات المتكررة بعد أول 12 شهراً.",
  "4.2 التقسيم: 50/50 إذا قدّم كل طرف أحد جانبي الصفقة؛ و70/30 لصالح الطرف المُنشئ إذا قدّم أحد الطرفين جانبي الصفقة وقدّم الآخر دعم التنفيذ.",
  "4.3 يجوز إصدار فواتير مشتركة لخدمات دخول السوق للمصانع السعودية بأتعاب يُتفق عليها لكل عميل (تقديرياً 15,000–30,000 ريال سعودي) وتُقسّم 50/50 ما لم يُتفق على خلاف ذلك.",
  "4.4 تفاصيل النسب في الملحق (أ)."])

clause("5. Payment of Commission",
 ["Commission becomes due only after the seller has received payment for the relevant shipment. The Party collecting the commission shall transfer the other Party's share within fifteen (15) days of receipt, against invoice. Neither Party shall receive or hold buyer funds on behalf of any principal."],
 "5. سداد العمولة",
 ["لا تُستحق العمولة إلا بعد استلام البائع قيمة الشحنة المعنية. ويلتزم الطرف المحصِّل للعمولة بتحويل حصة الطرف الآخر خلال خمسة عشر (15) يوماً من استلامها مقابل فاتورة. ولا يجوز لأي طرف استلام أو حيازة أموال المشترين نيابةً عن أي من الأطراف الأصيلة."])

clause("6. Non-Circumvention",
 ["For twenty-four (24) months from the date of introduction, neither Party shall, directly or indirectly, deal with any counterparty introduced by the other Party, for any product, without the other Party's written consent and without paying the agreed share of commission."],
 "6. عدم التجاوز",
 ["لمدة أربعة وعشرين (24) شهراً من تاريخ التقديم، لا يجوز لأي طرف التعامل بشكل مباشر أو غير مباشر مع أي جهة قدّمها الطرف الآخر، في أي منتج، دون موافقة كتابية من الطرف الآخر ودون سداد حصته المتفق عليها من العمولة."])

clause("7. Confidentiality",
 ["Each Party shall keep confidential all non-public information received from the other Party (including client identities, prices, volumes and contracts) and use it only for the purposes of this MoU. This obligation survives for three (3) years after expiry or termination."],
 "7. السرية",
 ["يلتزم كل طرف بالحفاظ على سرية جميع المعلومات غير العامة التي يتلقاها من الطرف الآخر (بما في ذلك هويات العملاء والأسعار والكميات والعقود)، وعدم استخدامها إلا لأغراض هذه المذكرة. ويستمر هذا الالتزام لمدة ثلاث (3) سنوات بعد انتهاء المذكرة أو إنهائها."])

clause("8. Pilot Period and Exclusivity",
 ["The first ninety (90) days constitute a pilot period per Annex B, on a preferred, non-exclusive basis. If the pilot KPIs are met, the Parties will negotiate in good faith an exclusive arrangement for Tunisia (and optionally Libya and Algeria)."],
 "8. الفترة التجريبية والحصرية",
 ["تُعدّ الأيام التسعون (90) الأولى فترة تجريبية وفق الملحق (ب)، على أساس الشريك المفضّل وغير الحصري. وفي حال تحقيق مؤشرات الأداء، يتفاوض الطرفان بحسن نية على ترتيب حصري لتونس (وليبيا والجزائر اختيارياً)."])

clause("9. Deal Registration",
 ["Each introduction shall be recorded in the shared deal register (Annex C) with date and time. The first registration of a counterparty establishes the originating Party for the purposes of Clauses 4 and 6."],
 "9. تسجيل الصفقات",
 ["يُسجَّل كل تقديم في سجل الصفقات المشترك (الملحق ج) مع التاريخ والوقت. ويُعدّ أول تسجيل لأي جهة مُثبِتاً للطرف المُنشئ لأغراض البندين 4 و6."])

clause("10. Compliance",
 ["Each Party shall: conduct KYC on all counterparties (commercial registry, beneficial owners, sanctions screening); comply with applicable anti-money-laundering, anti-bribery, export-control and sanctions laws; and process personal data in line with the Saudi Personal Data Protection Law and Tunisian Law No. 2004-63."],
 "10. الامتثال",
 ["يلتزم كل طرف بما يلي: إجراء التحقق من هوية جميع الجهات (السجل التجاري، المستفيدون الحقيقيون، الفحص مقابل قوائم العقوبات)؛ والالتزام بالأنظمة المعمول بها في مكافحة غسل الأموال والرشوة وضوابط التصدير والعقوبات؛ ومعالجة البيانات الشخصية وفقاً لنظام حماية البيانات الشخصية السعودي والقانون التونسي عدد 63 لسنة 2004."])

clause("11. Independent Parties",
 ["The Parties are independent contractors. This MoU does not create a partnership, joint venture, employment or commercial agency relationship, and neither Party may bind the other."],
 "11. استقلالية الطرفين",
 ["الطرفان مستقلان. ولا تُنشئ هذه المذكرة شراكة أو مشروعاً مشتركاً أو علاقة عمل أو وكالة تجارية، ولا يحق لأي طرف إلزام الطرف الآخر."])

clause("12. Term and Termination",
 ["This MoU is valid for twelve (12) months from signature and renews automatically for equal periods unless either Party gives thirty (30) days' written notice. Commissions on transactions introduced before termination remain payable, and Clauses 5, 6, 7 and 13 survive termination."],
 "12. المدة والإنهاء",
 ["تسري هذه المذكرة لمدة اثني عشر (12) شهراً من تاريخ التوقيع، وتتجدد تلقائياً لمدد مماثلة ما لم يُخطر أحد الطرفين الآخر كتابياً قبل ثلاثين (30) يوماً. وتظل العمولات المستحقة عن الصفقات المقدَّمة قبل الإنهاء واجبة السداد، وتبقى البنود 5 و6 و7 و13 سارية بعد الإنهاء."])

clause("13. Governing Law and Disputes",
 ["This MoU is governed by the laws of the Kingdom of Saudi Arabia. The Parties shall first seek to resolve any dispute amicably within thirty (30) days; failing that, the dispute shall be referred to arbitration under the rules of the Saudi Center for Commercial Arbitration (SCCA), seated in Riyadh."],
 "13. القانون الواجب التطبيق وتسوية النزاعات",
 ["تخضع هذه المذكرة لأنظمة المملكة العربية السعودية. ويسعى الطرفان أولاً إلى تسوية أي نزاع ودياً خلال ثلاثين (30) يوماً، وإلا يُحال النزاع إلى التحكيم وفق قواعد المركز السعودي للتحكيم التجاري، ويكون مقر التحكيم مدينة الرياض."])

clause("14. Nature of this MoU and Language",
 ["This MoU records the Parties' intentions and is not binding, except Clauses 4, 5, 6, 7, 10, 11, 12 and 13, which are binding. It is executed in Arabic and English, both equally authentic; in case of conflict, the Arabic text prevails."],
 "14. طبيعة المذكرة واللغة",
 ["تُثبت هذه المذكرة نوايا الطرفين وهي غير ملزمة، باستثناء البنود 4 و5 و6 و7 و10 و11 و12 و13 فهي ملزمة. وحُرِّرت باللغتين العربية والإنجليزية ولكل منهما الحجية ذاتها، وعند التعارض يُعتمد النص العربي."])

doc.add_page_break()
center("ANNEX A — COMMISSION SCHEDULE  |  الملحق (أ) — جدول العمولات", size=12)
t = doc.add_table(rows=1, cols=3); t.style='Table Grid'
hdr = ["Item / البند","Rate / النسبة","Split / التقسيم"]
for i,h in enumerate(hdr): run(t.rows[0].cells[i].paragraphs[0], h, bold=True); shade(t.rows[0].cells[i],'E8EEF5')
for r in [("New transaction / صفقة جديدة","2.5% – 3.5%","50/50 or 70/30 originator / أو 70/30 للمُنشئ"),
          ("Repeat orders after 12 months / طلبات متكررة بعد 12 شهراً","1.5% – 2%","Same / كما سبق"),
          ("Market-entry package / باقة دخول السوق","SAR 15,000 – 30,000 / ريال","50/50"),
          ("Payment of share / سداد الحصة","Within 15 days of receipt / خلال 15 يوماً من الاستلام","—")]:
    c = t.add_row().cells
    for i,v in enumerate(r): run(c[i].paragraphs[0], v)

doc.add_paragraph()
center("ANNEX B — 90-DAY PILOT PLAN  |  الملحق (ب) — خطة البرنامج التجريبي (90 يوماً)", size=12)
t = doc.add_table(rows=1, cols=3); t.style='Table Grid'
for i,h in enumerate(["Days / الأيام","Milestone / المرحلة","KPI / مؤشر الأداء"]): run(t.rows[0].cells[i].paragraphs[0], h, bold=True); shade(t.rows[0].cells[i],'E8EEF5')
for r in [("0–15","Signature; 5–8 Saudi factory profiles; 5 Tunisian exporter profiles / التوقيع؛ 5–8 ملفات مصانع سعودية؛ 5 ملفات مصدّرين تونسيين","10+ profiles registered / تسجيل 10 ملفات فأكثر"),
          ("15–45","Buyer qualification; freight quotes Jeddah/Dammam → Radès / تأهيل المشترين؛ عروض الشحن جدة/الدمام ← رادس","15 qualified buyers; 3 quotes / 15 مشترياً مؤهلاً؛ 3 عروض"),
          ("45–75","Samples, offers, joint visit to Tunis / العينات والعروض وزيارة مشتركة إلى تونس","5 offers; 2 sample approvals / 5 عروض؛ اعتماد عينتين"),
          ("75–90","First purchase order and shipment / أول أمر شراء وأول شحنة","1 PO; 1 container / أمر شراء واحد؛ حاوية واحدة"),
          ("Day 90 / اليوم 90","Joint review; exclusivity decision / مراجعة مشتركة؛ قرار الحصرية","Decision memo / مذكرة قرار")]:
    c = t.add_row().cells
    for i,v in enumerate(r): run(c[i].paragraphs[0], v)

doc.add_paragraph()
center("ANNEX C — DEAL REGISTRATION FORM  |  الملحق (ج) — نموذج تسجيل الصفقات", size=12)
t = doc.add_table(rows=1, cols=8); t.style='Table Grid'
for i,h in enumerate(["Date & time / التاريخ والوقت","Registered by / المسجِّل","Counterparty / الجهة","Country / الدولة","Product (HS) / المنتج","Est. volume / الكمية","Stage / المرحلة","Acknowledged / الإقرار"]):
    run(t.rows[0].cells[i].paragraphs[0], h, bold=True, size=8); shade(t.rows[0].cells[i],'E8EEF5')
for _ in range(8): t.add_row()
doc.add_page_break()
# signatures
doc.add_paragraph()
center("SIGNATURES  |  التوقيعات", size=12)
t = doc.add_table(rows=6, cols=2); t.style='Table Grid'
rows = [("For Radiant Advising Services / عن رادينت للخدمات الاستشارية","For Export Growth / عن نمو الصادرات"),
        ("Name / الاسم: Ahmed Nafetti","Name / الاسم: Abdullah Almuharib / عبدالله المحارب"),
        ("Title / الصفة: Co-Founder / الشريك المؤسس","Title / الصفة: Co-Founder / الشريك المؤسس"),
        ("Signature / التوقيع: ________________","Signature / التوقيع: ________________"),
        ("Date / التاريخ: ____ / ____ / 2026","Date / التاريخ: ____ / ____ / 2026"),
        ("Stamp / الختم:\n\n","Stamp / الختم:\n\n")]
for i,(a,b) in enumerate(rows):
    run(t.cell(i,0).paragraphs[0], a, bold=(i==0)); run(t.cell(i,1).paragraphs[0], b, bold=(i==0))
    if i==0: shade(t.cell(i,0),'E8EEF5'); shade(t.cell(i,1),'E8EEF5')

doc.save(OUT)
print("saved", OUT)
