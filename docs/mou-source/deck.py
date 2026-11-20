S="/tmp/claude-0/-home-user-radiant-site/84625d15-c216-5b53-b5f8-03fb4e3c2c9b/scratchpad"; F="/home/user/radiant-site/website/static/assets/fonts"
logo=open("/home/user/radiant-site/website/static/assets/logo.svg").read()
N=[0]
def slide(en, ar, body, cls=""):
    N[0]+=1
    return f'''<section class="slide {cls}">
<header><div class="brand">{logo}<span>Radiant Advising Services</span></div><div class="pg">Radiant × Export Growth · {N[0]:02d}</div></header>
<div class="ttl"><h2>{en}</h2><h2 class="ar" dir="rtl">{ar}</h2></div>
<div class="body">{body}</div>
<footer><span>Strategy &amp; Collaboration · Riyadh · November 2026</span><span class="ar" dir="rtl">الاستراتيجية والتعاون · الرياض · نوفمبر 2026</span></footer></section>'''
def bi(en_list, ar_list):
    e="".join(f"<li>{x}</li>" for x in en_list); a="".join(f"<li>{x}</li>" for x in ar_list)
    return f'<div class="bi"><ul class="en">{e}</ul><ul class="ar" dir="rtl">{a}</ul></div>'
def kpi(v,en,ar,src=""): return f'<div class="kpi"><b>{v}</b><span>{en}</span><span class="ar" dir="rtl">{ar}</span><i>{src}</i></div>'

slides=[]
# 1 cover
slides.append(f'''<section class="slide cover"><div class="frame"></div>
<div class="cv-top">{logo}<div><b>Radiant Advising Services</b><span>Trade Development &amp; Brokerage · Tunisia · GCC · Europe · Africa</span></div></div>
<div class="cv-mid"><div class="kick">Strategy &amp; Collaboration Proposal</div>
<h1>Saudi–Maghreb Trade Bridge</h1><h1 class="ar" dir="rtl">جسر التجارة السعودي – المغاربي</h1>
<div class="rule"></div>
<div class="pp"><div>Radiant Advising Services<small dir="rtl">رادينت للخدمات الاستشارية</small></div><em>×</em><div>Export Growth<small dir="rtl">نمو الصادرات</small></div></div></div>
<div class="cv-bot"><div>Prepared for Mr. Abdullah Almuharib, Co-Founder, Export Growth<br><span dir="rtl" class="arf">مُعدّ للأستاذ عبدالله المحارب، الشريك المؤسس – نمو الصادرات</span></div><div>Riyadh · November 2026<br><span class="arf">الرياض · نوفمبر 2026</span></div></div></section>''')
# 2 agenda
ag=[("The opportunity","الفرصة"),("The market gap","الفجوة في السوق"),("Partnership model","نموذج الشراكة"),("How it works, step by step","آلية العمل خطوة بخطوة"),("Priority product lines &amp; targets","خطوط المنتجات والمشترون المستهدفون"),("Logistics &amp; payment security","الخدمات اللوجستية وضمان الدفع"),("Commercial model","النموذج التجاري"),("90-day pilot &amp; year-1 goals","البرنامج التجريبي وأهداف السنة الأولى"),("Next steps","الخطوات التالية")]
slides.append(slide("Agenda","جدول الأعمال",'<ol class="agenda">'+"".join(f'<li><span>{e}</span><span class="ar" dir="rtl">{a}</span></li>' for e,a in ag)+'</ol>'))
# 3 who
slides.append(slide("Two complementary partners","شريكان متكاملان",f'''<div class="two">
<div class="card"><h3>Export Growth <span dir="rtl" class="arf">نمو الصادرات</span></h3><p class="tag">Saudi supply side · جانب العرض السعودي</p>
<ul><li>Riyadh-based export brokerage &amp; consultancy</li><li>Helps Saudi factories reach global markets</li><li>Founders: Abdullah Almuharib &amp; Nayef Alkhrigi</li></ul>
<ul class="ar" dir="rtl"><li>شركة سعودية للوساطة والاستشارات في التصدير</li><li>تمكين المصانع السعودية من الوصول للأسواق العالمية</li></ul></div>
<div class="plus">+</div>
<div class="card gold"><h3>Radiant Advising Services <span dir="rtl" class="arf">رادينت</span></h3><p class="tag">Maghreb demand side · جانب الطلب المغاربي</p>
<ul><li>Trade development &amp; brokerage, Tunisia ⇄ GCC</li><li>Buyer networks in Tunis, Sfax, Sousse</li><li>Arabic · French · English negotiation</li><li>Import regulations, follow-up &amp; collections</li></ul>
<ul class="ar" dir="rtl"><li>شبكة مشترين في تونس وصفاقس وسوسة</li><li>التفاوض بالعربية والفرنسية والإنجليزية</li><li>متطلبات الاستيراد والمتابعة والتحصيل</li></ul></div></div>
<p class="punch">Export Growth brings the factories. Radiant brings the buyers. Together we close the deal. <span dir="rtl" class="arf">نمو الصادرات تجلب المصانع، ورادينت تجلب المشترين، ومعاً نُتمّ الصفقة.</span></p>'''))
# 4 opportunity
slides.append(slide("The opportunity in numbers","الفرصة بالأرقام",'<div class="kpis">'+
 kpi("TND 1.14 bn","Saudi–Tunisian trade 2025 (≈ US$370 m)","حجم التبادل التجاري 2025","CEPEX")+
 kpi("+18.6%","Growth in total trade vs 2024","نمو التبادل مقارنة بـ 2024","CEPEX")+
 kpi("+136%","Tunisian exports to KSA, 2025","نمو الصادرات التونسية للمملكة","CEPEX")+
 kpi("65%","Plastics share of Tunisia's imports from KSA","حصة البلاستيك من واردات تونس من المملكة","UN Comtrade 2024")+
 kpi("+38%","Trade growth to Sept 2025 after mutual recognition of conformity certificates","نمو التجارة بعد الاعتراف المتبادل بشهادات المطابقة","Joint Committee")+
 kpi("34","Saudi companies on the Saudi Exports mission to Tunis (July 2025)","شركة سعودية في بعثة تونس التجارية","Saudi Exports")+'</div>'))
# 5 what tunisia buys - bars
bars=[("Plastics · البلاستيك",176.29),("Mineral fuels · الوقود",47.04),("Dyes &amp; paints · الأصباغ والدهانات",8.76),("Aluminium · الألمنيوم",6.58),("Organic chemicals · الكيماويات العضوية",6.36)]
bh="".join(f'<div class="bar"><span class="lb">{l}</span><div class="tr"><div class="fl" style="width:{v/176.29*100:.1f}%"></div></div><span class="v">US${v:.1f} m</span></div>' for l,v in bars)
slides.append(slide("What Tunisia buys from Saudi Arabia","ماذا تستورد تونس من المملكة",f'''<div class="two r"><div class="bars">{bh}<p class="src">Tunisia's imports from KSA, 2024, total US$272.4 m · Source: UN Comtrade via Trading Economics</p></div>
<div class="note">{bi(["Plastics dominate: film, sheet, resins, PET","Tunisia imports almost all its plastic raw materials (PE 46%, PVC 25%, PP 14%), historically from the EU","Saudi supply is taking share from Europe"],["البلاستيك هو التدفق الرئيسي: أفلام وألواح وراتنجات","تستورد تونس جل موادها البلاستيكية الأولية، تاريخياً من أوروبا","المنتج السعودي يكسب حصة من المورد الأوروبي"])}</div></div>'''))
# 6 gap
slides.append(slide("The market gap we will fill","الفجوة التي سنسدّها",'''<div class="gaps">
<div class="g"><b>1</b><h4>Big players are covered<span class="arf" dir="rtl">الكبار لديهم قنواتهم</span></h4><p>SABIC has its own subsidiary in Tunis and a distributor (F2M). Mid-size Saudi factories have no channel.</p><p class="arf" dir="rtl">لسابك شركة تابعة في تونس وموزع معتمد، أما المصانع السعودية المتوسطة فلا قناة لها.</p></div>
<div class="g"><b>2</b><h4>Missions end, follow-up stops<span class="arf" dir="rtl">البعثات تنتهي والمتابعة تتوقف</span></h4><p>Trade missions create contacts. Turning them into containers takes months of work on the ground.</p><p class="arf" dir="rtl">البعثات تصنع علاقات، لكن تحويلها إلى حاويات يحتاج متابعة ميدانية لأشهر.</p></div>
<div class="g"><b>3</b><h4>No direct shipping line<span class="arf" dir="rtl">لا يوجد خط شحن مباشر</span></h4><p>No direct Jeddah–Radès service. Freight and routing need expert handling to stay competitive.</p><p class="arf" dir="rtl">لا خط مباشر بين جدة ورادس، والشحن يحتاج إدارة خبيرة لتبقى الأسعار تنافسية.</p></div>
<div class="g"><b>4</b><h4>Rules, language, payment<span class="arf" dir="rtl">الأنظمة واللغة والدفع</span></h4><p>French-language import rules, bank domiciliation, FX controls and collections slow Saudi exporters down.</p><p class="arf" dir="rtl">أنظمة الاستيراد بالفرنسية والتوطين البنكي وضوابط الصرف والتحصيل تُبطئ المصدّر السعودي.</p></div></div>'''))
# 7 model
slides.append(slide("Partnership model","نموذج الشراكة",'''<div class="flow3">
<div class="node"><h4>Saudi factories<span class="arf" dir="rtl">المصانع السعودية</span></h4></div>
<div class="arr">→</div>
<div class="node eg"><h4>Export Growth</h4><p>Mandates · export readiness · FOB prices · certificates of origin · Saudi EXIM</p><p class="arf" dir="rtl">التفويضات · الجاهزية · أسعار FOB · شهادات المنشأ</p></div>
<div class="arr">⇄<small>shared deal register<br><span class="arf">سجل صفقات مشترك</span></small></div>
<div class="node ra"><h4>Radiant</h4><p>Buyer search &amp; qualification · meetings · negotiation · import rules · collections</p><p class="arf" dir="rtl">البحث عن المشترين وتأهيلهم · التفاوض · الاستيراد · التحصيل</p></div>
<div class="arr">→</div>
<div class="node"><h4>Tunisian &amp; Maghreb buyers<span class="arf" dir="rtl">المشترون في تونس والمغرب العربي</span></h4></div></div>
<div class="rev"><b>Reverse flow · التدفق العكسي</b> Radiant brings Tunisian exporters (olive oil, dates, seafood, pharma) → Export Growth opens Saudi distributors &amp; retail. <span class="arf" dir="rtl">رادينت تجلب المصدّرين التونسيين ← نمو الصادرات تفتح أبواب الموزعين في المملكة.</span></div>'''))
# 8 how it works
steps=[("Mandate","التفويض","Export Growth signs the factory; profile, capacity, MOQ, certificates and FOB price go into the shared register.","توقّع نمو الصادرات مع المصنع وتُسجَّل بياناته وأسعاره في السجل المشترك."),
("Match","المطابقة","Radiant matches the product (HS code, volume, price band) with qualified Tunisian buyers.","تطابق رادينت المنتج مع المشترين التونسيين المؤهلين حسب الكود والكمية والسعر."),
("Qualify &amp; meet","التأهيل والاجتماع","KYC checks, then meetings or video calls in Tunis/Sfax; samples are sent.","التحقق من الجهات ثم الاجتماعات وإرسال العينات."),
("Offer &amp; contract","العرض والعقد","CFR Radès offer, negotiation, sales contract; payment by L/C or Saudi EXIM / COTUNACE cover.","عرض سعر CFR رادس، التفاوض، العقد؛ الدفع باعتماد مستندي أو تغطية تأمينية."),
("Ship &amp; clear","الشحن والتخليص","Factory ships from Jeddah/Dammam; GAFTA certificate of origin; buyer clears in Radès.","الشحن من جدة أو الدمام بشهادة منشأ عربية؛ التخليص في رادس."),
("Paid &amp; repeat","الدفع والتكرار","Seller is paid, commission is shared within 15 days, account is grown into repeat orders.","يُسدَّد للبائع وتُقسَّم العمولة خلال 15 يوماً، ويتحول العميل إلى طلبات متكررة.")]
st="".join(f'<div class="st"><b>{i+1}</b><h4>{e}<span class="arf" dir="rtl">{a}</span></h4><p>{de}</p><p class="arf" dir="rtl">{da}</p></div>' for i,(e,a,de,da) in enumerate(steps))
slides.append(slide("How it works: one deal, step by step","آلية العمل: صفقة واحدة خطوة بخطوة",f'<div class="steps">{st}</div>'))
# 9 product lines
pl=[("01","Plastics &amp; packaging","البلاستيك ومواد التغليف","Film, sheet, PET preforms, specialty resins (non-SABIC grades) → Tunisian converters &amp; distributors","أفلام وألواح وقوالب PET وراتنجات متخصصة ← مصانع التحويل والموزعون","US$176 m flow"),
("02","Building materials &amp; paints","مواد البناء والدهانات","Paints, chemicals, aluminium profiles → distributors &amp; contractors","دهانات وكيماويات وألمنيوم ← الموزعون والمقاولون","In 2025 mission sectors"),
("03","Tunisian food → KSA","الأغذية التونسية ← المملكة","Packaged olive oil, dates, seafood → Saudi retail &amp; HORECA","زيت الزيتون المعبأ والتمور والمأكولات البحرية ← التجزئة والضيافة","Exports +136%"),
("04","Pharmaceuticals","الأدوية","Tunisian generics → KSA; Saudi–Tunisian co-manufacturing (MoU in place)","الأدوية الجنيسة التونسية ← المملكة؛ التصنيع المشترك","US$12 m flow")]
slides.append(slide("Priority product lines","خطوط المنتجات ذات الأولوية",'<div class="lines">'+"".join(f'<div class="ln"><b>{n}</b><h4>{e}<span class="arf" dir="rtl">{a}</span></h4><p>{de}</p><p class="arf" dir="rtl">{da}</p><em>{t}</em></div>' for n,e,a,de,da,t in pl)+'</div><p class="src">Pilot focus: lines 01, 02 and 03 · التركيز في البرنامج التجريبي: الخطوط 01 و02 و03</p>'))
# 10 targets
rows=[("Maisa Chimie (S.M.C.)","Sfax","PP / HDPE / LDPE granules supplier","Resin, film"),("IGT – Industrie Generali Tunisia","Tunis","Raw materials &amp; chemicals distributor","Resin, PU, solvents"),("Super Plast Plus","Tunisia","HDPE granules &amp; bags","Resin"),("Delta Service","Ariana","Chemicals &amp; polycarbonate film distributor","Specialty plastics, paints"),("Inoplast","Tunisia","PE pipes for water &amp; gas","PE resin"),("Inpackt","Tunisia","PET preforms, HDPE caps","PET, HDPE"),("SIMAP · Plastic Sfax","Sfax","Sfax plastics cluster converters","Film, resin"),("Tunisie Ouate · SIPP","Tunisia","Tissue production &amp; converting","Pulp, jumbo rolls")]
tr="".join(f"<tr><td><b>{a}</b></td><td>{b}</td><td>{c}</td><td>{d}</td></tr>" for a,b,c,d in rows)
slides.append(slide("Tunisian buyer targets (first wave)","المشترون التونسيون المستهدفون (الموجة الأولى)",f'''<table class="tb"><thead><tr><th>Company · الشركة</th><th>Location · الموقع</th><th>Activity · النشاط</th><th>Saudi products to offer · المنتجات السعودية المقترحة</th></tr></thead><tbody>{tr}</tbody></table>
<p class="src">Verified operating companies in each sector; current Saudi-origin purchases to be confirmed in qualification. APII counts 147 plastics extrusion companies in Tunisia. · شركات قائمة في القطاع، ويُتحقق من مشترياتها السعودية خلال التأهيل.</p>'''))
# 11 logistics & payment
slides.append(slide("Logistics, compliance &amp; payment security","اللوجستيات والامتثال وضمان الدفع",'''<div class="three">
<div class="card"><h4>Logistics<span class="arf" dir="rtl">الخدمات اللوجستية</span></h4><ul><li>Jeddah (west) or Dammam (east) → Radès / Sfax</li><li>Transshipment via East-Med hubs (e.g. Port Said)</li><li>Quote CFR Radès; FOB for buyers with forwarders</li><li>3 forwarder quotes per line before offers</li></ul><ul class="ar" dir="rtl"><li>جدة أو الدمام ← رادس أو صفاقس</li><li>عرض الأسعار CFR رادس</li></ul></div>
<div class="card"><h4>Compliance<span class="arf" dir="rtl">الامتثال</span></h4><ul><li>GAFTA: duty-free with Arab certificate of origin (40% value-added rule)</li><li>Mutual recognition of conformity certificates</li><li>KYC on every counterparty; sanctions screening</li><li>SFDA / SABER for products going to KSA</li></ul><ul class="ar" dir="rtl"><li>إعفاء جمركي ضمن منطقة التجارة الحرة العربية</li><li>التحقق من الهوية لكل جهة</li></ul></div>
<div class="card gold"><h4>Payment security<span class="arf" dir="rtl">ضمان الدفع</span></h4><ul><li>Confirmed letter of credit for first deals</li><li>Saudi EXIM buyer credit &amp; insurance</li><li>COTUNACE cover (MoU with Saudi EXIM)</li><li>Open account only after 3 clean shipments</li></ul><ul class="ar" dir="rtl"><li>اعتماد مستندي مؤكد للصفقات الأولى</li><li>تمويل وتأمين بنك التصدير والاستيراد السعودي</li></ul></div></div>'''))
# 12 commercial
slides.append(slide("Commercial model","النموذج التجاري",'''<div class="two r"><div><table class="tb"><thead><tr><th>Item · البند</th><th>Terms · الشروط</th></tr></thead><tbody>
<tr><td>Success fee · عمولة النجاح</td><td><b>2.5% – 3.5%</b> of invoice, paid by seller</td></tr>
<tr><td>Repeat orders (after 12 months) · الطلبات المتكررة</td><td><b>1.5% – 2%</b></td></tr>
<tr><td>Split · التقسيم</td><td><b>50/50</b> each brings one side · <b>70/30</b> to originator</td></tr>
<tr><td>Market-entry package · باقة دخول السوق</td><td><b>SAR 15–30k</b> per factory, shared 50/50</td></tr>
<tr><td>Payment of commission · سداد العمولة</td><td>Only after seller is paid; shared within 15 days</td></tr>
<tr><td>Protection · الحماية</td><td>24-month non-circumvention · confidentiality</td></tr></tbody></table></div>
<div class="card gold"><h4>Why repeat accounts matter<span class="arf" dir="rtl">أهمية العملاء المتكررين</span></h4>
<div class="eco"><span>1 converter × 4 containers/month of film</span><b>≈ US$41k / year</b></div>
<div class="eco"><span>1 olive-oil retail account × 2 containers/month</span><b>≈ US$84k / year</b></div>
<p class="src">Commission pool at 3%; prices are assumptions to replace with real quotes. · تقديرات تُستبدل بأسعار فعلية.</p></div></div>'''))
# 13 pilot
ph=[("Days 0–15","الأيام 0–15","Sign MoU · NDA · non-circumvention. Share 5–8 Saudi factory and 5 Tunisian exporter profiles.","التوقيع ومشاركة 5–8 ملفات مصانع و5 ملفات مصدّرين","10+ profiles"),
("Days 15–45","الأيام 15–45","Qualify 15 Tunisian buyers; book meetings; 3 freight quotes Jeddah/Dammam → Radès.","تأهيل 15 مشترياً وحجز الاجتماعات وعروض الشحن","15 buyers"),
("Days 45–75","الأيام 45–75","Samples, 5 formal offers, joint visit to Tunis.","العينات و5 عروض رسمية وزيارة مشتركة لتونس","5 offers"),
("Days 75–90","الأيام 75–90","First purchase order; first container shipped. Joint review &amp; exclusivity decision.","أول أمر شراء وأول حاوية، ثم المراجعة وقرار الحصرية","1st container")]
slides.append(slide("90-day pilot plan","خطة البرنامج التجريبي (90 يوماً)",'<div class="tl">'+"".join(f'<div class="ph"><div class="dot"></div><h4>{e}<span class="arf" dir="rtl">{a}</span></h4><p>{de}</p><p class="arf" dir="rtl">{da}</p><em>KPI: {k}</em></div>' for e,a,de,da,k in ph)+'</div>'))
# 14 year1 + risks
slides.append(slide("Year-1 goals &amp; risk control","أهداف السنة الأولى وإدارة المخاطر",'<div class="two r"><div><div class="kpis k2">'+
 kpi("8","Repeat accounts","حسابات متكررة")+kpi("200–350","Containers / year","حاوية سنوياً")+kpi("US$6–10 m","Goods traded","حجم التداول")+kpi("US$180–300k","Commission pool","إجمالي العمولات")+
 '</div><p class="src">Estimates, conditional on pilot success · تقديرات مشروطة بنجاح البرنامج التجريبي</p></div><table class="tb"><thead><tr><th>Risk · الخطر</th><th>Control · المعالجة</th></tr></thead><tbody>'+
 "<tr><td>Freight cost vs EU/Turkey</td><td>Value-dense lines, cargo consolidation, early CFR quotes</td></tr><tr><td>SABIC channel conflict</td><td>Non-SABIC producers and converted products only</td></tr><tr><td>Payment default</td><td>L/C, Saudi EXIM / COTUNACE cover, KYC</td></tr><tr><td>Circumvention</td><td>24-month clause, time-stamped deal register</td></tr><tr><td>Import admin delays</td><td>Buyers with bank lines; checklist per HS code</td></tr></tbody></table></div>"))
# 15 next steps
slides.append(slide("Next steps","الخطوات التالية",'''<div class="next">
<div class="nx"><b>1</b><p>Sign the MoU &amp; NDA within <strong>2 weeks</strong></p><p class="arf" dir="rtl">توقيع مذكرة التفاهم واتفاقية السرية خلال أسبوعين</p></div>
<div class="nx"><b>2</b><p>Share <strong>5–8 Saudi factory profiles</strong> (plastics, packaging, building materials)</p><p class="arf" dir="rtl">مشاركة 5–8 ملفات لمصانع سعودية</p></div>
<div class="nx"><b>3</b><p>Fix a date for a <strong>joint visit to Tunis</strong></p><p class="arf" dir="rtl">تحديد موعد لزيارة مشتركة إلى تونس</p></div>
<div class="nx"><b>4</b><p>Launch the <strong>shared deal register</strong> and monthly joint report</p><p class="arf" dir="rtl">إطلاق سجل الصفقات المشترك والتقرير الشهري</p></div></div>
<div class="contact"><div>{logo}</div><div><b>Radiant Advising Services</b><br>Ahmed Nafetti, Co-Founder · contact@radiantadvisingservicetn.com · +216 27 986 056 (WhatsApp)<br>www.radiantadvisingservicetn.com</div><div class="thx">Thank you<span class="arf">شكراً لكم</span></div></div>'''.replace("{logo}",logo)))

css=f'''
@font-face{{font-family:Inter;src:url(file://{F}/inter-400.woff2);font-weight:400}}
@font-face{{font-family:Inter;src:url(file://{F}/inter-600.woff2);font-weight:600}}
@font-face{{font-family:Inter;src:url(file://{F}/inter-700.woff2);font-weight:700}}
@font-face{{font-family:PlexAr;src:url(file://{F}/plex-arabic-400.woff2);font-weight:400}}
@font-face{{font-family:PlexAr;src:url(file://{F}/plex-arabic-600.woff2);font-weight:600}}
@font-face{{font-family:PlexAr;src:url(file://{F}/plex-arabic-700.woff2);font-weight:700}}
@page{{size:1920px 1080px;margin:0}}
*{{box-sizing:border-box}}
body{{margin:0;font-family:Inter,PlexAr,sans-serif;color:#f2f1ec;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.ar,.arf,[dir=rtl]{{font-family:PlexAr,Inter,sans-serif}}
.slide{{width:1920px;height:1080px;position:relative;overflow:hidden;page-break-after:always;background:radial-gradient(1200px 700px at 85% -10%,rgba(212,175,55,.10),transparent 60%),#0e0e14;padding:150px 90px 110px}}
header{{position:absolute;top:44px;left:90px;right:90px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(212,175,55,.35);padding-bottom:18px}}
.brand{{display:flex;align-items:center;gap:14px;font-weight:700;font-size:22px}} .brand svg{{width:44px;height:44px}}
.pg{{color:#a9abb6;font-size:18px;letter-spacing:1px}}
footer{{position:absolute;bottom:36px;left:90px;right:90px;display:flex;justify-content:space-between;color:#7d7f8a;font-size:16px}}
.ttl{{display:flex;justify-content:space-between;align-items:baseline;gap:40px;margin:10px 0 34px}}
.ttl h2{{font-size:52px;margin:0;font-weight:700;letter-spacing:-.5px}} .ttl h2.ar{{color:#f1d77a;font-size:44px}}
.body{{font-size:22px;line-height:1.5}}
.gold-t{{color:#f1d77a}}
.card{{background:#15151d;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:30px 34px}}
.card.gold{{border-color:rgba(212,175,55,.55);background:linear-gradient(180deg,rgba(212,175,55,.10),#15151d 60%)}}
.card h3,.card h4{{margin:0 0 10px;font-size:30px;display:flex;justify-content:space-between;gap:20px}} .card h4{{font-size:26px}}
.card h3 span,.card h4 span{{color:#f1d77a;font-weight:600}}
.tag{{color:#d4af37;font-size:18px;margin:0 0 14px;letter-spacing:1px}}
ul{{margin:0 0 10px;padding-left:26px}} li{{margin:6px 0}} ul.ar{{padding-left:0;padding-right:26px;color:#c9c7bd;font-size:21px}}
.two{{display:grid;grid-template-columns:1fr 70px 1fr;gap:20px;align-items:stretch}} .two.r{{grid-template-columns:1.15fr 1fr;gap:50px}}
.plus{{display:flex;align-items:center;justify-content:center;font-size:70px;color:#d4af37}}
.punch{{margin-top:34px;font-size:28px;font-weight:600;color:#f1d77a;display:flex;justify-content:space-between;gap:30px}} .punch span{{color:#f2f1ec;font-weight:400;font-size:26px}}
.bi{{display:grid;grid-template-columns:1fr 1fr;gap:40px}}
.kpis{{display:grid;grid-template-columns:repeat(3,1fr);gap:26px}} .kpis.k2{{grid-template-columns:1fr 1fr;gap:20px}}
.kpi{{background:#15151d;border:1px solid rgba(255,255,255,.08);border-top:4px solid #d4af37;border-radius:14px;padding:26px 28px;display:flex;flex-direction:column;gap:6px}}
.kpi b{{font-size:58px;color:#f1d77a;letter-spacing:-1px;font-variant-numeric:tabular-nums}} .k2 .kpi b{{font-size:46px}}
.kpi span{{font-size:21px}} .kpi span.ar{{color:#c9c7bd;text-align:right}} .kpi i{{font-style:normal;color:#7d7f8a;font-size:15px;margin-top:auto}}
.bars{{display:flex;flex-direction:column;gap:22px;justify-content:center}}
.bar{{display:grid;grid-template-columns:330px 1fr 150px;gap:18px;align-items:center;font-size:20px}}
.tr{{height:34px;background:#1d1d27;border-radius:6px;overflow:hidden}} .fl{{height:100%;background:linear-gradient(90deg,#b8922a,#f1d77a);border-radius:6px}}
.v{{font-weight:700;color:#f1d77a;font-variant-numeric:tabular-nums}}
.src{{color:#7d7f8a;font-size:16px;margin-top:18px}}
.note ul{{font-size:22px}} .note .bi{{grid-template-columns:1fr}}
.gaps{{display:grid;grid-template-columns:1fr 1fr;gap:26px}}
.g{{background:#15151d;border-radius:16px;padding:26px 30px 22px 100px;position:relative;border:1px solid rgba(255,255,255,.08)}}
.g>b{{position:absolute;left:28px;top:24px;width:52px;height:52px;border-radius:50%;background:#d4af37;color:#16130a;display:flex;align-items:center;justify-content:center;font-size:26px}}
.g h4,.st h4,.ln h4,.ph h4{{margin:0 0 8px;font-size:26px;display:flex;justify-content:space-between;gap:16px}} .g h4 span,.st h4 span,.ln h4 span,.ph h4 span{{color:#f1d77a;font-weight:600}}
.g p,.st p,.ln p,.ph p{{margin:4px 0;font-size:20px;color:#d9d8d2}} .g p.arf,.st p.arf,.ln p.arf,.ph p.arf{{color:#b9b7ad}}
.flow3{{display:grid;grid-template-columns:1fr 50px 1.4fr 140px 1.4fr 50px 1fr;align-items:center;gap:10px;margin-top:20px}}
.node{{background:#15151d;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:26px 22px;min-height:250px;display:flex;flex-direction:column;justify-content:center}}
.node h4{{margin:0 0 10px;font-size:26px}} .node h4 span{{display:block;color:#f1d77a;font-size:22px;margin-top:4px}} .node p{{font-size:19px;margin:6px 0;color:#d9d8d2}}
.node.eg{{border-color:rgba(241,215,122,.4)}} .node.ra{{border-color:#d4af37;background:linear-gradient(180deg,rgba(212,175,55,.14),#15151d)}}
.node.eg h4,.node.ra h4{{color:#f1d77a;font-size:32px}}
.arr{{text-align:center;font-size:48px;color:#d4af37}} .arr small{{display:block;font-size:15px;color:#a9abb6;line-height:1.3}}
.rev{{margin-top:44px;background:rgba(212,175,55,.08);border:1px dashed rgba(212,175,55,.5);border-radius:14px;padding:22px 28px;font-size:22px;display:flex;flex-wrap:wrap;gap:12px 20px}} .rev b{{color:#f1d77a}} .rev .arf{{color:#c9c7bd}}
.steps{{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}}
.st{{background:#15151d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:24px 26px;position:relative}}
.st>b{{display:inline-flex;width:46px;height:46px;border-radius:50%;background:#d4af37;color:#16130a;align-items:center;justify-content:center;font-size:22px;margin-bottom:12px}}
.lines{{display:grid;grid-template-columns:repeat(4,1fr);gap:22px}}
.ln{{background:#15151d;border-radius:16px;padding:28px 26px;border:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column}} .ln:nth-child(-n+3){{border-top:4px solid #d4af37}}
.ln>b{{font-size:44px;color:#d4af37;margin-bottom:8px}} .ln h4{{flex-direction:column;gap:4px}} .ln em{{margin-top:auto;padding-top:16px;font-style:normal;color:#f1d77a;font-weight:600;font-size:19px}}
.tb{{width:100%;border-collapse:collapse;font-size:20px}} .tb th{{background:#d4af37;color:#16130a;text-align:left;padding:14px 16px;font-weight:700}} .tb td{{padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.1);color:#d9d8d2}} .tb tr:nth-child(even) td{{background:rgba(255,255,255,.03)}} .tb td b{{color:#f2f1ec}}
.three{{display:grid;grid-template-columns:repeat(3,1fr);gap:26px}} .three .card h4{{flex-direction:column;gap:2px}} .three ul{{font-size:21px}}
.eco{{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.1);padding:18px 0;gap:20px;font-size:21px}} .eco b{{color:#f1d77a;font-size:32px;white-space:nowrap}}
.tl{{display:grid;grid-template-columns:repeat(4,1fr);gap:26px;position:relative;padding-top:40px}}
.tl:before{{content:"";position:absolute;top:14px;left:12px;right:12px;height:3px;background:linear-gradient(90deg,#b8922a,#f1d77a)}}
.ph{{background:#15151d;border-radius:16px;padding:28px 26px;border:1px solid rgba(255,255,255,.08);position:relative}} .ph .dot{{position:absolute;top:-38px;left:22px;width:26px;height:26px;border-radius:50%;background:#f1d77a;border:5px solid #0e0e14}}
.ph h4{{flex-direction:column;gap:2px}} .ph em{{display:block;margin-top:14px;font-style:normal;color:#f1d77a;font-weight:700;font-size:20px}}
.next{{display:grid;grid-template-columns:1fr 1fr;gap:22px}}
.nx{{display:grid;grid-template-columns:70px 1fr;gap:4px 20px;background:#15151d;border-radius:16px;padding:24px 28px;border:1px solid rgba(255,255,255,.08)}}
.nx b{{grid-row:span 2;width:60px;height:60px;border-radius:50%;background:#d4af37;color:#16130a;display:flex;align-items:center;justify-content:center;font-size:28px}}
.nx p{{margin:0;font-size:24px}} .nx p.arf{{color:#c9c7bd;font-size:21px}} .nx strong{{color:#f1d77a}}
.contact{{margin-top:44px;display:grid;grid-template-columns:90px 1fr auto;gap:26px;align-items:center;border-top:1px solid rgba(212,175,55,.35);padding-top:30px;font-size:21px;color:#d9d8d2}} .contact svg{{width:84px;height:84px}} .contact b{{color:#f2f1ec;font-size:26px}}
.thx{{font-size:48px;font-weight:700;color:#f1d77a;text-align:right}} .thx span{{display:block;font-size:36px}}
.agenda{{columns:2;column-gap:60px;list-style:none;padding:0;counter-reset:a;margin-top:10px}}
.agenda li{{counter-increment:a;break-inside:avoid;display:grid;grid-template-columns:70px 1fr;grid-template-rows:auto auto;padding:18px 0;border-bottom:1px solid rgba(255,255,255,.1);font-size:28px}}
.agenda li:before{{content:counter(a,decimal-leading-zero);grid-row:span 2;color:#d4af37;font-weight:700}}
.agenda li span.ar{{color:#b9b7ad;font-size:24px;text-align:left}}
/* cover */
.cover{{padding:0;background:radial-gradient(1000px 800px at 90% 10%,rgba(212,175,55,.16),transparent 60%),#0b0b10}}
.frame{{position:absolute;inset:36px;border:1px solid rgba(212,175,55,.45);border-radius:22px}}
.cv-top{{position:absolute;top:110px;left:140px;display:flex;align-items:center;gap:28px}} .cv-top svg{{width:110px;height:110px}}
.cv-top b{{display:block;font-size:40px}} .cv-top span{{color:#c9b67a;letter-spacing:3px;font-size:18px;text-transform:uppercase}}
.cv-mid{{position:absolute;top:360px;left:140px;right:140px}}
.kick{{color:#d4af37;letter-spacing:6px;text-transform:uppercase;font-weight:600;font-size:22px}}
.cover h1{{font-size:96px;margin:18px 0 6px;letter-spacing:-2px;line-height:1.05}} .cover h1.ar{{font-size:72px;color:#f1d77a;letter-spacing:0}}
.rule{{width:180px;height:6px;background:linear-gradient(90deg,#f1d77a,#b8922a);margin:34px 0}}
.pp{{display:flex;gap:30px;align-items:center;font-size:34px;font-weight:600}} .pp em{{font-style:normal;color:#d4af37;font-size:46px}} .pp small{{display:block;color:#a9abb6;font-size:24px;font-weight:400}}
.cv-bot{{position:absolute;bottom:100px;left:140px;right:140px;display:flex;justify-content:space-between;align-items:flex-end;color:#a9abb6;font-size:22px;line-height:1.6}} .cv-bot div:last-child{{text-align:right}}
'''
open(S+"/deck.html","w").write(f'<!doctype html><html><head><meta charset="utf-8"><title>Saudi–Maghreb Trade Bridge</title><style>{css}</style></head><body>{"".join(slides)}</body></html>')
print(len(slides))
