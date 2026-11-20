import os,re
S=os.path.dirname(os.path.abspath(__file__))
exec(open(S+"/deck.py").read())   # brings slide(), bi(), kpi(), css, logo, old slides list
old=slides
N[0]=0
def s(en,ar,body): return slide(en,ar,body)
def q(en,ar,who_en,who_ar): return f'<div class="quote"><p>“{en}”</p><p class="arf" dir="rtl">«{ar}»</p><span>— {who_en} · <span class="arf">{who_ar}</span></span></div>'
def score(v,label): return f'<div class="score"><b>{v}</b><span>{label}</span></div>'
X=[]
# cover
X.append(f'''<section class="slide cover"><div class="frame"></div>
<div class="cv-top">{logo}<div><b>Radiant Advising Services</b><span>Trade Development &amp; Brokerage · Tunisia · GCC · Europe · Africa</span></div></div>
<div class="cv-mid"><div class="kick">Collaboration Strategy · Advisory Committee Report</div>
<h1>Saudi–Maghreb Trade Bridge</h1><h1 class="ar" dir="rtl">جسر التجارة السعودي – المغاربي</h1>
<div class="rule"></div>
<div class="pp"><div>Radiant Advising Services<small dir="rtl">رادينت للخدمات الاستشارية</small></div><em>×</em><div>Export Growth<small dir="rtl">نمو الصادرات</small></div></div>
<p class="cv-note">Prepared with a 10-expert AI advisory committee: economics · finance · law · risk · trade · logistics<br><span class="arf" dir="rtl">أُعدّت بمشاركة لجنة استشارية من 10 خبراء بالذكاء الاصطناعي: الاقتصاد · المالية · القانون · المخاطر · التجارة · اللوجستيات</span></p></div>
<div class="cv-bot"><div>Presented by Ahmed Nafetti, Co-Founder, Radiant · to Abdullah Almuharib, Co-Founder, Export Growth<br><span dir="rtl" class="arf">يقدّمها أحمد نفاتي، الشريك المؤسس لرادينت · إلى عبدالله المحارب، الشريك المؤسس لنمو الصادرات</span></div><div>Riyadh · November 2026<br><span class="arf">الرياض · نوفمبر 2026</span></div></div></section>''')
# committee
team=[("01","Project Director","مدير المشروع","Strategy &amp; delivery"),("02","Chief Economist","كبير الاقتصاديين","Corridor economics · 7/10"),("03","Financial Expert","الخبير المالي","Deal economics · 7/10"),("04","Legal Committee","اللجنة القانونية","Contracts &amp; compliance · 6/10"),("05","Risk Expert","خبير المخاطر","Risk control · 6/10"),
("06","Trade Intelligence","الاستخبارات التجارية","Customs &amp; trade data"),("07","Saudi Export Analyst","محلل الصادرات السعودية","Saudi suppliers"),("08","Tunisia Import Analyst","محلل الاستيراد التونسي","Tunisian buyers"),("09","Logistics Expert","خبير اللوجستيات","Ports, freight, Incoterms"),("10","Sales &amp; Digital Director","مدير المبيعات والمنصة الرقمية","Pipeline, CRM, reporting")]
X.append(s("The 10-expert advisory committee","اللجنة الاستشارية من 10 خبراء",'<div class="team">'+"".join(f'<div class="tm{" core" if n in ("02","03","04","05") else ""}"><b>{n}</b><h4>{e}</h4><p class="arf" dir="rtl">{a}</p><em>{d}</em></div>' for n,e,a,d in team)+'</div><p class="src">Highlighted: the four core reviewers who scored the partnership independently. · المُبرزون: المراجعون الأربعة الأساسيون الذين قيّموا الشراكة بشكل مستقل.</p>'))
# verdict
X.append(s("Committee verdict","حكم اللجنة",'''<div class="verdict"><div class="go"><span>Decision · القرار</span><b>GO</b><p>Launch a 90-day pilot under a signed MoU, NDA and payment cover</p><p class="arf" dir="rtl">إطلاق برنامج تجريبي لمدة 90 يوماً بعد توقيع مذكرة التفاهم واتفاقية السرية وتأمين غطاء الدفع</p></div>
<div class="scores">'''+score("7/10","Economics · الاقتصاد")+score("7/10","Finance · المالية")+score("6/10","Legal readiness · الجاهزية القانونية")+score("6/10","Risk control · ضبط المخاطر")+'''</div></div>
<div class="bi" style="margin-top:34px">'''+'<ul class="en"><li><b>Economist:</b> small but fast-growing corridor; policy has opened it</li><li><b>Finance:</b> viable on repeat accounts; break-even ≈ 7 containers/month</li><li><b>Legal:</b> sign as a brokerage MoU, not an agency; close the blanks first</li><li><b>Risk:</b> medium; reaches 8/10 with MoU, payment cover and freight quotes</li></ul><ul class="ar" dir="rtl"><li><b>الاقتصادي:</b> ممر صغير سريع النمو فتحته السياسات الحكومية</li><li><b>المالي:</b> مجدٍ مع العملاء المتكررين؛ التعادل عند 7 حاويات شهرياً تقريباً</li><li><b>القانوني:</b> اتفاقية وساطة لا وكالة، مع استكمال الفراغات أولاً</li><li><b>المخاطر:</b> متوسطة، وتصل إلى 8/10 بالتوقيع وغطاء الدفع وعروض الشحن</li></ul></div>'))
# strategy on a page
X.append(s("The strategy on one page","الاستراتيجية في صفحة واحدة",'''<div class="sop">
<div class="vis"><span>Vision · الرؤية</span><p>Become the reference execution channel for Saudi factories in Tunisia and the Maghreb, and for Tunisian exporters in the Kingdom.</p><p class="arf" dir="rtl">أن نكون القناة التنفيذية المرجعية للمصانع السعودية في تونس والمغرب العربي، وللمصدّرين التونسيين في المملكة.</p></div>
<div class="pillars">
<div class="pl"><b>1</b><h4>Focus<span class="arf" dir="rtl">التركيز</span></h4><p>3 product lines with proven flows: plastics &amp; packaging, building materials, Tunisian food.</p><p class="arf" dir="rtl">3 خطوط بتدفقات مثبتة: البلاستيك ومواد التغليف، مواد البناء، الأغذية التونسية.</p></div>
<div class="pl"><b>2</b><h4>Repeat accounts<span class="arf" dir="rtl">العملاء المتكررون</span></h4><p>Revenue from recurring containers, not one-off deals. Target 8 repeat accounts in year 1.</p><p class="arf" dir="rtl">الإيراد من الحاويات المتكررة لا الصفقات المنفردة. الهدف 8 حسابات متكررة.</p></div>
<div class="pl"><b>3</b><h4>Secured execution<span class="arf" dir="rtl">تنفيذ مؤمَّن</span></h4><p>Every deal with KYC, L/C or Saudi EXIM / COTUNACE cover, and a registered origin.</p><p class="arf" dir="rtl">كل صفقة مع التحقق من العميل واعتماد مستندي أو تغطية تأمينية وتسجيل الطرف المُنشئ.</p></div>
<div class="pl"><b>4</b><h4>Two-way flow<span class="arf" dir="rtl">تدفق في الاتجاهين</span></h4><p>Saudi goods to Tunisia and Tunisian food &amp; pharma to the Kingdom: both partners win.</p><p class="arf" dir="rtl">السلع السعودية إلى تونس والأغذية والأدوية التونسية إلى المملكة: مكسب للطرفين.</p></div></div>
<div class="goal"><span>Year-1 goal · هدف السنة الأولى</span><b>270 containers · US$9 m traded · US$270k commission</b><span class="arf" dir="rtl">270 حاوية · 9 ملايين دولار · 270 ألف دولار عمولات (السيناريو الأساسي)</span></div></div>'''))
# economist
X.append(s("Chief Economist: the corridor","كبير الاقتصاديين: الممر التجاري",'<div class="kpis">'+
 kpi("TND 1.14 bn","Bilateral trade 2025 (+18.6%)","التبادل التجاري 2025","CEPEX")+kpi("65%","Plastics share of Tunisia's imports from KSA","حصة البلاستيك من الواردات","UN Comtrade 2024")+kpi("3.1 : 1","Trade imbalance in KSA's favour","اختلال الميزان لصالح المملكة","Estimate from CEPEX")+'</div>'+
 '<div class="two r" style="margin-top:28px"><div class="card"><h4>Tailwinds<span class="arf" dir="rtl">المحفّزات</span></h4><ul><li>GAFTA: duty-free Saudi-origin goods</li><li>Mutual recognition of conformity: +38% trade</li><li>Saudi EXIM × COTUNACE lower payment risk</li><li>Vision 2030 pushes non-oil exports</li></ul></div><div class="card"><h4>Headwinds<span class="arf" dir="rtl">المعوّقات</span></h4><ul><li>No direct Jeddah–Radès line; freight costs rising</li><li>EU is the incumbent resin supplier</li><li>SABIC already sells directly in Tunisia</li></ul></div></div>'+
 q("Governments have opened the corridor. The value now goes to whoever turns one container into a recurring flow.","الحكومات فتحت الممر. والقيمة الآن لمن يحوّل حاوية واحدة إلى تدفق متكرر.","Chief Economist","كبير الاقتصاديين")))
# finance 1
X.append(s("Financial Expert: unit economics","الخبير المالي: اقتصاديات الحاوية",'''<table class="tb"><thead><tr><th>Line · الخط</th><th>Volume · الحجم</th><th>Price* · السعر</th><th>Goods value · القيمة</th><th>Pool 3% · العمولة</th><th>Each partner 50% · حصة كل طرف</th></tr></thead><tbody>
<tr><td><b>PE film / sheet</b> · أغشية البولي إيثيلين</td><td>22 t</td><td>US$1,300/t</td><td>US$28,600</td><td>US$858</td><td><b>US$429</b></td></tr>
<tr><td><b>Paints / building chemicals</b> · الدهانات</td><td>18 t</td><td>US$1,800/t</td><td>US$32,400</td><td>US$972</td><td><b>US$486</b></td></tr>
<tr><td><b>Packaged olive oil</b> (TN→KSA) · زيت الزيتون</td><td>18 t</td><td>US$6,500/t</td><td>US$117,000</td><td>US$3,510</td><td><b>US$1,755</b></td></tr></tbody></table>
<p class="src">* Price assumptions per 40' container, to be replaced with real quotes. · أسعار افتراضية تُستبدل بعروض فعلية.</p>
<div class="callout">One olive-oil container earns about the same as four containers of PE film. <span class="arf" dir="rtl">حاوية زيت زيتون واحدة تعادل تقريباً عمولة أربع حاويات من أغشية البولي إيثيلين.</span></div>'''))
# finance 2
X.append(s("Financial Expert: scenarios &amp; break-even","الخبير المالي: السيناريوهات ونقطة التعادل",'''<div class="scen">
<div class="sc"><span>Conservative · متحفظ</span><b>80</b><em>containers / year · حاوية سنوياً</em><p>US$2.8 m traded · US$85k pool</p><p class="hl">Radiant share ≈ US$43k</p></div>
<div class="sc base"><span>Base · أساسي</span><b>270</b><em>containers / year · حاوية سنوياً</em><p>US$9.0 m traded · US$270k pool</p><p class="hl">Radiant share ≈ US$135k</p></div>
<div class="sc"><span>Ambitious · طموح</span><b>430</b><em>containers / year · حاوية سنوياً</em><p>US$15.5 m traded · US$465k pool</p><p class="hl">Radiant share ≈ US$233k</p></div></div>
<div class="two r" style="margin-top:18px"><div class="card gold"><h4>Break-even<span class="arf" dir="rtl">نقطة التعادل</span></h4><ul><li>Running cost ≈ US$3,000/month (assumption)</li><li>≈ <b>7 industrial containers/month</b> or 2 olive-oil containers</li><li>90-day pilot cost ≈ US$9k, funded by market-entry packages</li></ul></div>
<div class="card"><h4>CFO recommendations<span class="arf" dir="rtl">توصيات المدير المالي</span></h4><ul><li>3% floor in year 1; repeat discount only above 24 containers/account</li><li>Market-entry packages (SAR 15–30k) invoiced upfront</li><li>Commission 15 days after seller is paid; L/C or EXIM / COTUNACE only</li></ul></div></div>'''+q("Single containers don't pay; repeat accounts do. Seven containers a month covers us. Everything above is profit.","الحاوية المنفردة لا تغطي التكلفة؛ الحسابات المتكررة هي التي تفعل. سبع حاويات شهرياً تغطي تكاليفنا، وما زاد فهو ربح.","Financial Expert","الخبير المالي")))
# legal 1
docs=[("Mutual NDA + non-circumvention","اتفاقية سرية متبادلة وعدم تجاوز","Protection before any names are shared"),("Pilot MoU + Annexes A, B, C","مذكرة التفاهم التجريبية والملاحق","Rates, KPIs, deal register"),("CRM data-sharing agreement","اتفاقية مشاركة البيانات","PDPL &amp; Tunisian Law 2004-63"),("Seller fee / mandate letters","خطابات أتعاب وتفويض البائعين","Each factory confirms its rate in writing"),("Deal registration &amp; commission note","إشعار تسجيل الصفقة والعمولة","One per transaction"),("Definitive cooperation agreement","اتفاقية التعاون النهائية","After the pilot; exclusivity terms")]
X.append(s("Legal Committee: structure &amp; documents","اللجنة القانونية: الهيكل والمستندات",'''<div class="two r"><div class="card gold"><h4>Recommended structure<span class="arf" dir="rtl">الهيكل الموصى به</span></h4><ul><li>Non-exclusive <b>brokerage / introduction</b> agreement between independent contractors</li><li><b>Not</b> a commercial agency or distribution</li><li>Saudi law · SCCA arbitration, Riyadh</li><li>Arabic text prevails</li><li>Neither party binds principals or holds buyer funds</li></ul><ul class="ar" dir="rtl"><li>اتفاقية وساطة وتقديم غير حصرية بين متعاقدَين مستقلَّين، وليست وكالة تجارية</li><li>القانون السعودي والتحكيم في الرياض، ويُعتمد النص العربي</li></ul></div>
<div><h4 class="sub">Document package, in signing order · حزمة المستندات بترتيب التوقيع</h4><ol class="docs">'''+"".join(f'<li><b>{e}</b><span class="arf" dir="rtl">{a}</span><em>{d}</em></li>' for e,a,d in docs)+'</ol></div></div>'))
# legal 2
X.append(s("Legal Committee: compliance checklist","اللجنة القانونية: قائمة الامتثال",'''<div class="checks">
<div class="ck"><h4>GAFTA origin<span class="arf" dir="rtl">شهادة المنشأ العربية</span></h4><p>Certificate of origin per shipment; 40% value-added rule per HS code.</p></div>
<div class="ck"><h4>Tunisian import rules<span class="arf" dir="rtl">قواعد الاستيراد التونسية</span></h4><p>Importer handles bank domiciliation, technical control and FX rules.</p></div>
<div class="ck"><h4>Saudi rules (reverse flow)<span class="arf" dir="rtl">القواعد السعودية</span></h4><p>SFDA registration, Arabic labels and halal; SABER for regulated goods.</p></div>
<div class="ck"><h4>KYC / AML / sanctions<span class="arf" dir="rtl">التحقق ومكافحة غسل الأموال</span></h4><p>Registry extract, beneficial owner, sanctions screening; watch re-exports to Libya.</p></div>
<div class="ck"><h4>Data protection<span class="arf" dir="rtl">حماية البيانات</span></h4><p>Signed CRM data-sharing agreement; PDPL and INPDP rules on transfers.</p></div>
<div class="ck"><h4>Anti-bribery<span class="arf" dir="rtl">مكافحة الرشوة</span></h4><p>No payments to officials; commissions only by invoice and bank transfer.</p></div></div>
<div class="callout"><b>Applied to the MoU:</b> commission clause made binding · Arabic text prevails. <b>Still to add:</b> tax &amp; FX clause · liability cap · termination for cause. <span class="arf" dir="rtl">تم: جعل بند العمولة ملزماً واعتماد النص العربي. يُضاف: بند الضرائب والصرف وسقف المسؤولية والإنهاء لسبب.</span></div>'''+q("Introduce, don't represent: a broker that never binds principals or touches buyer funds stays outside agency law.","نُقدِّم ولا نُمثِّل: الوسيط الذي لا يُلزم الأصيل ولا يحوز أموال المشترين يبقى خارج نطاق أنظمة الوكالة.","Legal Committee","اللجنة القانونية")))
# risk register
R=[("Market","السوق","Price loss to EU/Turkey suppliers","M","H","Value-dense lines; avoid SABIC grades; early CFR benchmark","Both"),
("Logistics","اللوجستيات","No direct Jeddah–Radès service","H","M","3 forwarder quotes by day 30; Sfax alternative","Both"),
("Payment","الدفع","Buyer default or late payment","M","H","Confirmed L/C or EXIM / COTUNACE cover","Both"),
("Legal","القانون","Agency-law or origin rejection","M","M","Brokerage agreement; per-HS checklist","Both"),
("Partnership","الشراكة","Circumvention of introducer","M","H","24-month clause; time-stamped CRM log","Both"),
("Currency","العملة","Tunisian FX delays payment","M","M","Invoice in USD/SAR; importers with bank lines","Radiant"),
("Geopolitical","الجيوسياسي","Red Sea / Suez disruption","M","H","Prefer Jeddah origin; war-risk surcharge clause","Export Growth"),
("Reputation","السمعة","KYC failure or dual-use re-export","L","H","Registry, UBO and sanctions screening","Both")]
lvl=lambda x:f'<i class="lv {x}">{x}</i>'
X.append(s("Risk Expert: risk register","خبير المخاطر: سجل المخاطر",'<table class="tb rk"><thead><tr><th>Category · الفئة</th><th>Risk · الخطر</th><th>Likelihood</th><th>Impact</th><th>Mitigation · المعالجة</th><th>Owner</th></tr></thead><tbody>'+"".join(f'<tr><td><b>{c}</b> · <span class="arf">{ca}</span></td><td>{r}</td><td>{lvl(l)}</td><td>{lvl(i)}</td><td>{m}</td><td>{o}</td></tr>' for c,ca,r,l,i,m,o in R)+'</tbody></table><p class="src">Overall rating: MEDIUM · 6/10 today, 8/10 once MoU, payment cover and freight quotes are in place. · التقييم العام: متوسط.</p>'))
# risk 2
X.append(s("Risk Expert: red lines &amp; early warnings","خبير المخاطر: الخطوط الحمراء والإنذار المبكر",'''<div class="two r"><div class="card red"><h4>Red lines: pause the deal if…<span class="arf" dir="rtl">الخطوط الحمراء: نوقف الصفقة إذا…</span></h4><ol><li>A counterparty fails KYC, beneficial-owner or sanctions screening, or shows signs of re-export to Libya</li><li>A first-time buyer offers neither a confirmed L/C nor credit-insurance cover</li><li>Names would be shared before the NDA and non-circumvention agreement are signed</li></ol><ol class="ar" dir="rtl"><li>إخفاق طرف في فحص التحقق أو العقوبات أو مؤشرات إعادة التصدير إلى ليبيا</li><li>مشترٍ جديد بلا اعتماد مستندي مؤكد ولا تغطية تأمينية</li><li>تبادل الأسماء قبل توقيع اتفاقية السرية وعدم التجاوز</li></ol></div>
<div class="card"><h4>Monthly early-warning KPIs<span class="arf" dir="rtl">مؤشرات الإنذار المبكر الشهرية</span></h4><div class="ew"><b>1</b><p>Payment health: % paid on time, value overdue &gt; 30 days<span class="arf" dir="rtl">سلامة التحصيل</span></p></div><div class="ew"><b>2</b><p>Landed-cost gap: CFR Radès vs EU/Turkey benchmark<span class="arf" dir="rtl">فجوة التكلفة الواصلة</span></p></div><div class="ew"><b>3</b><p>Pipeline integrity: buyer → quote → PO conversion<span class="arf" dir="rtl">سلامة خط الصفقات</span></p></div></div></div>'''+q("Growth is welcome; unsecured growth is not. No signed paper, no payment cover, no KYC: no container.","النمو مرحَّب به، أما النمو غير المؤمَّن فلا. لا عقد موقّع، ولا غطاء دفع، ولا تحقق من العميل: لا حاوية.","Risk Expert","خبير المخاطر")))
# reuse: model(6), how(7), lines(8), targets(9), logistics(10), pilot(12)
X += [old[6],old[7],old[8],old[9],old[10],old[12]]
# next steps (old 14) with updated contact
X.append(old[14])
# renumber
out=[]
for i,sl in enumerate(X):
    out.append(re.sub(r'Radiant × Export Growth · \d\d',f'Radiant × Export Growth · {i:02d}',sl))
css2=css+'''
.cv-note{color:#c9b67a;font-size:22px;margin-top:30px;line-height:1.6}
.team{display:grid;grid-template-columns:repeat(5,1fr);gap:20px}
.tm{background:#15151d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:24px 22px;min-height:220px}
.tm.core{border:2px solid #d4af37;background:linear-gradient(180deg,rgba(212,175,55,.14),#15151d 70%)}
.tm b{color:#d4af37;font-size:30px} .tm h4{margin:10px 0 4px;font-size:24px} .tm p{margin:0;color:#f1d77a;font-size:20px} .tm em{display:block;margin-top:14px;font-style:normal;color:#a9abb6;font-size:18px}
.verdict{display:grid;grid-template-columns:1fr 1.5fr;gap:30px}
.go{background:linear-gradient(160deg,rgba(212,175,55,.25),#15151d);border:2px solid #d4af37;border-radius:18px;padding:30px 34px}
.go span{color:#c9b67a;letter-spacing:3px;text-transform:uppercase;font-size:18px} .go b{display:block;font-size:110px;color:#f1d77a;line-height:1.1} .go p{margin:6px 0;font-size:22px}
.scores{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.score{background:#15151d;border:1px solid rgba(255,255,255,.08);border-left:6px solid #d4af37;border-radius:14px;padding:22px 26px;display:flex;flex-direction:column;justify-content:center}
.score b{font-size:64px;color:#f1d77a} .score span{font-size:21px;color:#d9d8d2}
.sop{display:flex;flex-direction:column;gap:22px}
.vis{background:rgba(212,175,55,.08);border:1px solid rgba(212,175,55,.45);border-radius:16px;padding:20px 28px} .vis span,.goal span{color:#d4af37;letter-spacing:2px;text-transform:uppercase;font-size:16px;font-weight:600} .vis p{margin:6px 0;font-size:23px}
.pillars{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.pl{background:#15151d;border-radius:16px;padding:22px 24px;border:1px solid rgba(255,255,255,.08);border-top:4px solid #d4af37}
.pl b{color:#d4af37;font-size:34px} .pl h4{margin:6px 0 8px;font-size:25px;display:flex;flex-direction:column} .pl h4 span{color:#f1d77a;font-size:22px} .pl p{margin:4px 0;font-size:19px;color:#d9d8d2} .pl p.arf{color:#b9b7ad}
.goal{display:flex;align-items:center;gap:30px;background:#15151d;border-radius:14px;padding:20px 28px;border:1px solid rgba(255,255,255,.08)} .goal b{font-size:30px;color:#f1d77a} .goal .arf{color:#c9c7bd;font-size:20px;letter-spacing:0;text-transform:none;font-weight:400}
.quote{margin-top:14px;border-left:5px solid #d4af37;padding:6px 0 6px 26px} .quote p{margin:2px 0;font-size:23px;font-style:italic;color:#f2f1ec} .quote p.arf{font-style:normal;color:#f1d77a;font-size:24px} .quote>span{color:#a9abb6;font-size:18px}
.callout{margin-top:22px;background:rgba(212,175,55,.08);border:1px dashed rgba(212,175,55,.5);border-radius:14px;padding:18px 26px;font-size:22px;display:flex;flex-wrap:wrap;gap:8px 18px} .callout .arf{color:#c9c7bd}
.scen{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.sc{background:#15151d;border-radius:16px;padding:16px 26px;border:1px solid rgba(255,255,255,.08)} .sc.base{border:2px solid #d4af37;background:linear-gradient(180deg,rgba(212,175,55,.14),#15151d)}
.sc span{color:#c9b67a;font-size:19px;letter-spacing:1px} .sc b{display:block;font-size:48px;color:#f1d77a;line-height:1.1} .sc em{font-style:normal;color:#a9abb6;font-size:17px} .sc p{margin:8px 0 0;font-size:21px} .sc p.hl{color:#f1d77a;font-weight:700}
h4.sub{font-size:24px;margin:0 0 12px;color:#f1d77a}
.docs{margin:0;padding:0;list-style:none;counter-reset:d} .docs li{counter-increment:d;display:grid;grid-template-columns:50px 1fr;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.1);font-size:21px}
.docs li:before{content:counter(d);grid-row:span 3;width:38px;height:38px;border-radius:50%;background:#d4af37;color:#16130a;display:flex;align-items:center;justify-content:center;font-weight:700}
.docs li span{color:#f1d77a;font-size:19px} .docs li em{font-style:normal;color:#a9abb6;font-size:17px}
.checks{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.ck{background:#15151d;border-radius:14px;padding:20px 24px;border:1px solid rgba(255,255,255,.08)} .ck h4{margin:0 0 6px;font-size:23px;display:flex;flex-direction:column} .ck h4:before{content:"✓";color:#16130a;background:#d4af37;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:8px} .ck h4 span{color:#f1d77a;font-size:20px} .ck p{margin:0;font-size:19px;color:#d9d8d2}
.rk td{font-size:18px;padding:11px 14px} .lv{font-style:normal;font-weight:700;padding:3px 12px;border-radius:999px;font-size:16px} .lv.H{background:#5a1f1f;color:#ffb4a8} .lv.M{background:#4a3d12;color:#f1d77a} .lv.L{background:#1d3a26;color:#9fe0b1}
.card.red{border-color:rgba(255,140,120,.45);background:linear-gradient(180deg,rgba(160,48,48,.18),#15151d 60%)} .card ol{font-size:21px;padding-left:28px;margin:0 0 12px} .card ol.ar{padding-left:0;padding-right:28px;color:#c9c7bd}
.ew{display:grid;grid-template-columns:50px 1fr;gap:14px;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.1)} .ew b{width:42px;height:42px;border-radius:50%;background:#d4af37;color:#16130a;display:flex;align-items:center;justify-content:center} .ew p{margin:0;font-size:21px} .ew p span{display:block;color:#f1d77a;font-size:19px}
'''
open(S+"/deck2.html","w").write(f'<!doctype html><html><head><meta charset="utf-8"><title>Saudi–Maghreb Trade Bridge — Committee Strategy</title><style>{css2}</style></head><body>{"".join(out)}</body></html>')
print(len(out))
