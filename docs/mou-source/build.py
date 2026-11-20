import json, html
S="/tmp/claude-0/-home-user-radiant-site/84625d15-c216-5b53-b5f8-03fb4e3c2c9b/scratchpad"; F="/home/user/radiant-site/website/static/assets/fonts"
cl=json.load(open(S+"/clauses.json"))
logo=open("/home/user/radiant-site/website/static/assets/logo.svg").read()
e=html.escape
def paras(lines): return "".join(f"<p>{e(l)}</p>" for l in lines)
def ch(sub): return "".join(f'''
<section class="clause">
  <div class="col en"><h3>{e(c["en_t"])}</h3>{paras(c["en"])}</div>
  <div class="col ar" dir="rtl" lang="ar"><h3>{e(c["ar_t"])}</h3>{paras(c["ar"])}</div>
</section>''' for c in sub)
def table(head, rows, cls=""):
    h="".join(f"<th>{x}</th>" for x in head)
    r="".join("<tr>"+"".join(f"<td>{x}</td>" for x in row)+"</tr>" for row in rows)
    return f'<table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{r}</tbody></table>'
A=lambda en,ar: f'{en}<br><span class="arx" dir="rtl">{ar}</span>'
annexA=table([A("Item","البند"),A("Rate","النسبة"),A("Split","التقسيم")],[
 [A("New transaction","صفقة جديدة"),"2.5% – 3.5%",A("50/50, or 70/30 to originator","50/50، أو 70/30 للطرف المُنشئ")],
 [A("Repeat orders after 12 months","الطلبات المتكررة بعد 12 شهراً"),"1.5% – 2%",A("Same as above","كما سبق")],
 [A("Market-entry package (per factory)","باقة دخول السوق (لكل مصنع)"),A("SAR 15,000 – 30,000","15,000 – 30,000 ريال"),"50/50"],
 [A("Transfer of partner share","تحويل حصة الشريك"),A("Within 15 days of receipt","خلال 15 يوماً من الاستلام"),"—"]])
annexB=table([A("Days","الأيام"),A("Milestone","المرحلة"),A("KPI","مؤشر الأداء")],[
 ["0 – 15",A("Signature; 5–8 Saudi factory profiles; 5 Tunisian exporter profiles","التوقيع؛ 5–8 ملفات مصانع سعودية؛ 5 ملفات مصدّرين تونسيين"),A("10+ profiles registered","تسجيل 10 ملفات فأكثر")],
 ["15 – 45",A("Buyer qualification; freight quotes Jeddah/Dammam → Radès","تأهيل المشترين؛ عروض الشحن جدة/الدمام ← رادس"),A("15 qualified buyers; 3 quotes","15 مشترياً مؤهلاً؛ 3 عروض")],
 ["45 – 75",A("Samples, offers, joint visit to Tunis","العينات والعروض وزيارة مشتركة إلى تونس"),A("5 offers; 2 sample approvals","5 عروض؛ اعتماد عينتين")],
 ["75 – 90",A("First purchase order and shipment","أول أمر شراء وأول شحنة"),A("1 PO; 1 container","أمر شراء واحد؛ حاوية واحدة")],
 [A("Day 90","اليوم 90"),A("Joint review; exclusivity decision","مراجعة مشتركة؛ قرار الحصرية"),A("Decision memo","مذكرة قرار")]])
annexC=table([A("Date &amp; time","التاريخ والوقت"),A("Registered by","المسجِّل"),A("Counterparty","الجهة"),A("Country","الدولة"),A("Product (HS)","المنتج"),A("Est. volume","الكمية"),A("Stage","المرحلة"),A("Acknowledged","الإقرار")],[[""]*8 for _ in range(9)],"reg")

HDR=f'<div class="hdr"><div class="l">{logo}Radiant Advising Services</div><div class="r">MoU · Radiant × Export Growth<br><span style="font-family:PlexAr">مذكرة تفاهم · رادينت × نمو الصادرات</span></div></div>'
FTR='<div class="ftr"><span>Radiant Advising Services · contact@radiantadvisingservicetn.com · +216 27 986 056 · radiantadvisingservicetn.com</span><span class="ref">Confidential · سري</span></div>'
groups=[cl[0:3],cl[3:6],cl[6:11],cl[11:]]
clause_pages=""
for i,g in enumerate(groups):
    title='<div class="secbar"><h2><span>Terms of Collaboration</span><span class="ar" dir="rtl">بنود التعاون</span></h2></div>' if i==0 else ''
    clause_pages+=f'<div class="page">{HDR}{title}{ch(g)}{FTR}</div>'
doc=f'''<!doctype html><html><head><meta charset="utf-8"><title>Radiant × Export Growth — MoU</title>
<style>
@font-face{{font-family:Inter;src:url(file://{F}/inter-400.woff2);font-weight:400}}
@font-face{{font-family:Inter;src:url(file://{F}/inter-600.woff2);font-weight:600}}
@font-face{{font-family:Inter;src:url(file://{F}/inter-700.woff2);font-weight:700}}
@font-face{{font-family:PlexAr;src:url(file://{F}/plex-arabic-400.woff2);font-weight:400}}
@font-face{{font-family:PlexAr;src:url(file://{F}/plex-arabic-600.woff2);font-weight:600}}
@font-face{{font-family:PlexAr;src:url(file://{F}/plex-arabic-700.woff2);font-weight:700}}
:root{{--ink:#15151d;--gold:#b8922a;--gold2:#d4af37;--soft:#f7f3e6;--line:#e4dcc3;--muted:#6b6b76}}
@page{{size:A4;margin:0}}
*{{box-sizing:border-box}}
body{{margin:0;font-family:Inter,PlexAr,sans-serif;color:var(--ink);font-size:9.6pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
[dir=rtl],.ar,.arx{{font-family:PlexAr,Inter,sans-serif}}
.page{{width:210mm;height:297mm;overflow:hidden;position:relative;page-break-after:always;padding:30mm 16mm 22mm}}
.page:last-child{{page-break-after:auto}}
/* cover */
.cover{{background:#0e0e14;color:#f2f1ec;padding:0;display:flex;flex-direction:column;justify-content:space-between;height:297mm;overflow:hidden}}
.cover .frame{{position:absolute;inset:10mm;border:1px solid rgba(212,175,55,.45);border-radius:4mm}}
.cover .top{{padding:26mm 22mm 0;display:flex;align-items:center;gap:6mm}}
.cover .top svg{{width:22mm;height:22mm}}
.cover .brand b{{display:block;font-size:17pt;letter-spacing:.5px}}
.cover .brand span{{color:#c9b67a;font-size:10pt;letter-spacing:3px;text-transform:uppercase}}
.cover .mid{{padding:0 22mm}}
.cover .kicker{{color:var(--gold2);letter-spacing:4px;font-size:9pt;font-weight:600;text-transform:uppercase}}
.cover h1{{font-size:30pt;line-height:1.15;margin:4mm 0 2mm;font-weight:700}}
.cover h1.ar{{font-size:26pt;margin-top:3mm;color:#f1d77a}}
.cover .rule{{width:40mm;height:1.2mm;background:linear-gradient(90deg,#f1d77a,#b8922a);margin:8mm 0}}
.cover .parties{{display:flex;align-items:center;gap:6mm;font-size:13pt;font-weight:600}}
.cover .parties .x{{color:var(--gold2);font-size:18pt}}
.cover .parties small{{display:block;font-weight:400;color:#a9abb6;font-size:9pt}}
.cover .bottom{{padding:0 22mm 24mm;display:flex;justify-content:space-between;align-items:flex-end;font-size:9pt;color:#a9abb6}}
.cover .stamp{{border:1px solid rgba(212,175,55,.6);color:#f1d77a;padding:3mm 5mm;border-radius:2mm;font-weight:600;letter-spacing:1px;text-align:center}}
/* running header/footer */
.hdr{{position:absolute;top:10mm;left:16mm;right:16mm;display:flex;justify-content:space-between;align-items:center;border-bottom:.6mm solid var(--gold2);padding-bottom:3mm}}
.hdr .l{{display:flex;align-items:center;gap:3mm;font-weight:700;font-size:10pt}}
.hdr svg{{width:9mm;height:9mm}}
.hdr .r{{font-size:8pt;color:var(--muted);text-align:right}}
.ftr{{position:absolute;bottom:9mm;left:16mm;right:16mm;display:flex;justify-content:space-between;font-size:7.5pt;color:var(--muted);border-top:1px solid var(--line);padding-top:2.5mm}}
.ftr .ref{{color:var(--gold);font-weight:600}}
h2{{font-size:13pt;margin:0 0 4mm;display:flex;justify-content:space-between;color:var(--ink)}}
h2 .ar{{font-weight:700}}
h2:after{{content:none}}
.secbar{{border-left:1.2mm solid var(--gold2);background:var(--soft);padding:3mm 4mm;margin:0 0 5mm}}
.clause{{display:grid;grid-template-columns:1fr 1fr;gap:6mm;padding:3.2mm 0;border-bottom:1px solid var(--line);break-inside:avoid}}
.clause h3{{font-size:10.2pt;margin:0 0 1.5mm;color:var(--gold)}}
.clause p{{margin:0 0 1.3mm;text-align:justify}}
.clause .ar p{{text-align:justify;font-size:10pt;line-height:1.7}}
.clause .ar h3{{font-size:11pt}}
table{{width:100%;border-collapse:collapse;margin:2mm 0 7mm;font-size:8.8pt}}
th{{background:var(--ink);color:#f1d77a;text-align:left;padding:2.2mm 2.5mm;font-weight:600;vertical-align:top}}
td{{border:1px solid var(--line);padding:2.2mm 2.5mm;vertical-align:top}}
tbody tr:nth-child(even) td{{background:#fbf9f2}}
.arx{{display:block;color:#555;font-size:9pt}}
th .arx{{color:#d8c58a}}
table.reg td{{height:9mm}} table.reg th{{font-size:7.4pt}}
.sig{{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-top:6mm}}
.sig .box{{border:1px solid var(--line);border-top:1.2mm solid var(--gold2);padding:5mm;border-radius:1.5mm}}
.sig .box h4{{margin:0 0 5mm;font-size:10.5pt}}
.sig .box h4 span{{display:block;font-family:PlexAr;color:var(--gold);font-weight:600}}
.sig .ln{{display:flex;justify-content:space-between;align-items:flex-end;margin:6mm 0 0;border-bottom:1px dotted #999;padding-bottom:1mm;font-size:8.6pt;color:var(--muted)}}
.sig .ln b{{color:var(--ink);font-weight:600}}
.sig .seal{{height:28mm;border:1px dashed #ccc;border-radius:50%;width:28mm;margin:6mm auto 0;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:8pt;text-align:center}}
.note{{font-size:8pt;color:#8a2c2c;background:#fbf0ef;border:1px solid #ecc9c6;padding:2.5mm 3.5mm;border-radius:1.5mm;margin-top:6mm;display:flex;justify-content:space-between;gap:5mm}}
</style></head><body>

<div class="page cover">
 <div class="frame"></div>
 <div class="top">{logo}<div class="brand"><b>Radiant Advising Services</b><span>Trade Development &amp; Brokerage</span></div></div>
 <div class="mid">
  <div class="kicker">Memorandum of Understanding</div>
  <h1>Strategic Commercial<br>Collaboration</h1>
  <h1 class="ar" dir="rtl">مذكرة تفاهم للتعاون التجاري الاستراتيجي</h1>
  <div class="rule"></div>
  <div class="parties"><div>Radiant Advising Services<small dir="rtl">رادينت للخدمات الاستشارية</small></div><div class="x">×</div><div>Export Growth<small dir="rtl">نمو الصادرات</small></div></div>
  <p style="color:#a9abb6;margin-top:8mm;max-width:150mm">Kingdom of Saudi Arabia ⇄ Republic of Tunisia &amp; the Maghreb<br><span dir="rtl" style="font-family:PlexAr">المملكة العربية السعودية ⇄ الجمهورية التونسية والمغرب العربي</span></p>
 </div>
 <div class="bottom">
  <div>Riyadh · ____ / ____ / 2026<br>Ref: RAS-EG-MOU-2026-01</div>
  <div class="stamp">DRAFT FOR DISCUSSION<br><span style="font-family:PlexAr">مسودة للنقاش</span></div>
 </div>
</div>

{clause_pages}

<div class="page">
 <div class="hdr"><div class="l">{logo}Radiant Advising Services</div><div class="r">Annexes · <span style="font-family:PlexAr">الملاحق</span></div></div>
 <div class="secbar"><h2><span>Annex A — Commission Schedule</span><span class="ar" dir="rtl">الملحق (أ) — جدول العمولات</span></h2></div>
 {annexA}
 <div class="secbar"><h2><span>Annex B — 90-Day Pilot Plan</span><span class="ar" dir="rtl">الملحق (ب) — خطة البرنامج التجريبي</span></h2></div>
 {annexB}
 <div class="ftr"><span>Radiant Advising Services · contact@radiantadvisingservicetn.com · +216 27 986 056 · radiantadvisingservicetn.com</span><span class="ref">Confidential · سري</span></div>
</div>

<div class="page">
 <div class="hdr"><div class="l">{logo}Radiant Advising Services</div><div class="r">Annexes · <span style="font-family:PlexAr">الملاحق</span></div></div>
 <div class="secbar"><h2><span>Annex C — Deal Registration Form</span><span class="ar" dir="rtl">الملحق (ج) — نموذج تسجيل الصفقات</span></h2></div>
 {annexC}
 <p style="font-size:8.5pt;color:var(--muted)">The first registration of a counterparty establishes the originating Party (Clause 9). <span dir="rtl" style="font-family:PlexAr">يُعدّ أول تسجيل لأي جهة مُثبِتاً للطرف المُنشئ (البند 9).</span></p>
 <div class="ftr"><span>Radiant Advising Services · contact@radiantadvisingservicetn.com · +216 27 986 056 · radiantadvisingservicetn.com</span><span class="ref">Confidential · سري</span></div>
</div>
<div class="page">
 <div class="hdr"><div class="l">{logo}Radiant Advising Services</div><div class="r">Signatures · <span style="font-family:PlexAr">التوقيعات</span></div></div>
 <div class="secbar"><h2><span>Signatures</span><span class="ar" dir="rtl">التوقيعات</span></h2></div>
 <p>IN WITNESS WHEREOF, the Parties have signed this Memorandum of Understanding in two original copies, in Arabic and English, each Party retaining one copy.</p>
 <p dir="rtl" style="font-family:PlexAr;font-size:10pt">وإثباتاً لما تقدّم، وقّع الطرفان على مذكرة التفاهم هذه من نسختين أصليتين باللغتين العربية والإنجليزية، واستلم كل طرف نسخة للعمل بموجبها.</p>
 <div class="sig">
  <div class="box"><h4>For Radiant Advising Services<span dir="rtl">عن رادينت للخدمات الاستشارية</span></h4>
   <div class="ln">Name / الاسم<b>Ahmed Nafetti</b></div>
   <div class="ln">Title / الصفة<b>Co-Founder · الشريك المؤسس</b></div>
   <div class="ln">Signature / التوقيع<b>&nbsp;</b></div>
   <div class="ln">Date / التاريخ<b>____ / ____ / 2026</b></div>
   <div class="seal">Company stamp<br>ختم الشركة</div></div>
  <div class="box"><h4>For Export Growth<span dir="rtl">عن نمو الصادرات</span></h4>
   <div class="ln">Name / الاسم<b>Abdullah Almuharib · عبدالله المحارب</b></div>
   <div class="ln">Title / الصفة<b>Co-Founder · الشريك المؤسس</b></div>
   <div class="ln">Signature / التوقيع<b>&nbsp;</b></div>
   <div class="ln">Date / التاريخ<b>____ / ____ / 2026</b></div>
   <div class="seal">Company stamp<br>ختم الشركة</div></div>
 </div>
 <div class="note"><span>Draft for discussion — subject to legal review before signature.</span><span dir="rtl" style="font-family:PlexAr">مسودة للنقاش — تخضع للمراجعة القانونية قبل التوقيع.</span></div>
 <div class="ftr"><span>Radiant Advising Services · contact@radiantadvisingservicetn.com · +216 27 986 056 · radiantadvisingservicetn.com</span><span class="ref">Confidential · سري</span></div>
</div>

</body></html>'''
open(S+"/mou.html","w").write(doc)
