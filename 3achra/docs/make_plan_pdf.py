# Builds 3achra-business-plan.pdf: strategy, costs, packaging, exact profit maths.
# Every number is computed below from the ASSUMPTIONS block; change them and re-run.
import json, math, pathlib, subprocess, html
HERE = pathlib.Path(__file__).parent
A = dict(PRICE=9.9, PACK_PRICE=49.5, DELIV_FEE=7.0, FREE_FROM=5, COURIER=7.0, RETURN_FEE=4.0,
         PACKAGING=0.5, LANDED=3.0, ADS=8.0, REFUSAL=0.20, FIXED=300.0, SMALL_AVG=2.5,
         FX=3.0, MAX_LANDED=3.3, COVER=1.2, DAYS=30)
P = json.loads((HERE.parent/"products.json").read_text(encoding="utf-8"))
f3 = lambda x: f"{x:,.3f}".replace(",", " ").replace(".", ",")
f0 = lambda x: f"{x:,.0f}".replace(",", " ")
e = html.escape

# ---------- 1. landed cost of one item (worked example) ----------
def landed_chain(usd, freight=0.20, duty=0.20, broker=0.15):
    goods = usd*A["FX"]; cif = goods+freight; d = cif*duty; fee = d*0.03
    vat = (cif+d+fee)*0.19; total = cif+d+fee+vat+broker
    return [("Prix Chine (1688)", f"{usd:.2f} USD × {A['FX']:.1f}", goods),
            ("Fret maritime groupage (part par article)", "≈ 177 USD/m³ réparti", freight),
            ("= Valeur CIF", "", cif),
            (f"Droits de douane (exemple {duty*100:.0f} %)", "dépend du code SH : 0–36 %", d),
            ("Redevance douanière 3 % des droits", "", fee),
            ("TVA 19 %", "sur CIF + droits", vat),
            ("Transitaire + agent (part par article)", "estimation", broker),
            ("= Coût rendu Tunisie (landed)", f"≈ {total/goods:.2f} × prix Chine", total)]

# ---------- 2. packaging ----------
PACKAGING = [("Sachet d'expédition plastique (poly mailer)", 0.25),
             ("Papier bulle / papier de calage", 0.10),
             ("Carte merci + autocollant 3achra", 0.10),
             ("Ruban adhésif / étiquette", 0.05)]
assert abs(sum(x for _, x in PACKAGING)-A["PACKAGING"]) < 1e-9

# ---------- 3. profit of one order ----------
def order(k, c=A["LANDED"], ads=A["ADS"], r=A["REFUSAL"]):
    ship = 0 if k >= A["FREE_FROM"] else A["DELIV_FEE"]
    price = A["PACK_PRICE"] if k == 5 else A["PRICE"]*k
    rev = price+ship
    cost_goods = k*c
    delivered = rev-cost_goods-A["COURIER"]-A["PACKAGING"]-ads
    refused = -ads-A["RETURN_FEE"]-A["PACKAGING"]
    expected = (1-r)*delivered+r*refused
    return dict(k=k, ship=ship, price=price, rev=rev, goods=cost_goods, delivered=delivered,
                refused=refused, expected=expected)
EX = [order(1), order(3), order(5)]

# ---------- 4. monthly plan (same model as the finance agent) ----------
def p5(k): return min(1, max(0, (k-A["SMALL_AVG"])/(5-A["SMALL_AVG"])))
def contrib(k=4.0, r=A["REFUSAL"], ads=A["ADS"]):
    p = p5(k); d = 1-r
    deliv = A["PRICE"]*k+A["DELIV_FEE"]*(1-p)-A["LANDED"]*k-A["COURIER"]-A["PACKAGING"]
    refus = -A["RETURN_FEE"]-A["PACKAGING"]
    return d*deliv+r*refus-ads, p, deliv
def plan(target, kind, k=4.0, r=A["REFUSAL"], ads=A["ADS"]):
    c, p, deliv = contrib(k, r, ads)
    if kind == "sales": placed = math.ceil(target/((1-r)*A["PRICE"]*k))
    else: placed = math.ceil((target+A["FIXED"])/c)
    d = placed*(1-r)
    return dict(placed=placed, day=placed/A["DAYS"], delivered=d, items=placed*k, sold=d*k,
                sales=d*k*A["PRICE"], profit=placed*c-A["FIXED"], ads=placed*ads,
                stock_units=math.ceil(A["COVER"]*placed*k), stock_dt=A["COVER"]*placed*k*A["LANDED"],
                c=c, p=p)
PA, PB = plan(5000, "sales"), plan(5000, "profit")
SENS = [[plan(5000, "profit", k, r)["placed"] for k in (3, 4, 5)] for r in (0.10, 0.20, 0.30)]
RAMP = []
for m, (share, ads) in enumerate([(0.4, 10), (0.7, 9), (1.0, 8)], 1):
    o = math.ceil(PB["placed"]*share); c, _, _ = contrib(4.0, A["REFUSAL"], ads)
    RAMP.append((m, o, o/A["DAYS"], o*ads, o*c-A["FIXED"]))

# ---------- 5. products ----------
rows = []
for i, p in enumerate(P, 1):
    lo, hi = [float(x) for x in str(p[3]).replace("–", "-").split("-")]
    mid = (lo+hi)/2; land = mid*A["FX"]*1.65
    rows.append((i, p[0], p[1], f"{lo:.2f}–{hi:.2f}", land, A["PRICE"]-land))

def table(head, body, cls=""):
    h = "".join(f"<th>{e(x)}</th>" for x in head)
    b = "".join("<tr>"+"".join(f"<td>{x}</td>" for x in r)+"</tr>" for r in body)
    return f'<table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>'

chain = landed_chain(0.50)
html_doc = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
@page{{size:A4;margin:16mm 15mm}}
body{{font:10.5pt/1.5 "IBM Plex Sans",Arial,sans-serif;color:#17181c}}
h1{{font:400 30pt "Archivo Black",Arial Black,sans-serif;margin:0}}
h2{{font:400 15pt "Archivo Black",Arial Black,sans-serif;margin:22px 0 8px;break-after:avoid}}
h2 .n{{color:#e8361f;font-family:"IBM Plex Mono",monospace;font-size:11pt;margin-right:8px}}
h3{{font-size:11pt;margin:14px 0 4px}}
p{{margin:4px 0}}
.tag{{display:inline-block;background:#e8361f;color:#fff;font:600 10pt "IBM Plex Mono",monospace;padding:3px 10px;margin:6px 0}}
.sub{{color:#62656d}}
.box{{background:#fde9e5;padding:10px 14px;margin:10px 0;break-inside:avoid}}
.formula{{font-family:"IBM Plex Mono",monospace;background:#f2f1ec;padding:8px 12px;margin:6px 0;white-space:pre-wrap;font-size:9.5pt;break-inside:avoid}}
table{{border-collapse:collapse;width:100%;margin:6px 0 10px;font-size:9.5pt;break-inside:auto}}
tr{{break-inside:avoid}}
th{{text-align:left;font:500 8pt "IBM Plex Mono",monospace;text-transform:uppercase;color:#62656d;border-bottom:1.5px solid #17181c;padding:5px 6px}}
td{{border-bottom:1px solid #e2e0da;padding:4px 6px;vertical-align:top}}
td:not(:nth-child(1)):not(:nth-child(2)):not(:nth-child(3)){{font-variant-numeric:tabular-nums}}
.small td,.small th{{font-size:8.3pt;padding:3px 5px}}
.neg{{color:#b42512;font-weight:600}} .pos{{color:#1f7a4d;font-weight:600}}
.pb{{break-before:page}}
ul{{margin:4px 0;padding-left:18px}}
</style></head><body>

<h1>3achra</h1>
<div class="tag">TOUT À 9,900 DT · عشرة</div>
<p class="sub">Business plan : stratégie, coûts, emballage et calcul exact du bénéfice. Tunisie, novembre 2026.<br>
Tous les chiffres sont calculés par un script à partir des hypothèses de la section 1. Les prix fournisseurs sont des <b>estimations</b> à confirmer chez les grossistes.</p>

<h2><span class="n">01</span>Hypothèses utilisées</h2>
{table(["Paramètre","Valeur","D'où vient le chiffre"],[
 ["Prix de vente par article", f3(A['PRICE'])+" DT", "Concept : prix unique"],
 ["Pack 5 articles", f3(A['PACK_PRICE'])+" DT", "5 × 9,900 ; livraison offerte"],
 ["Livraison payée par le client (moins de 5 articles)", f3(A['DELIV_FEE'])+" DT", "Gratuite dès 5 articles"],
 ["Frais transporteur par colis livré", f3(A['COURIER'])+" DT", "Marché tunisien : 7–10 DT (agent sourcing)"],
 ["Frais de retour par colis refusé", f3(A['RETURN_FEE'])+" DT", "Estimation, à négocier"],
 ["Emballage par commande", f3(A['PACKAGING'])+" DT", "Détail section 4"],
 ["Coût rendu moyen par article", f3(A['LANDED'])+" DT", f"Maximum autorisé : {f3(A['MAX_LANDED'])} DT"],
 ["Publicité par commande passée", f3(A['ADS'])+" DT", "À mesurer avec un test de 3 jours"],
 ["Taux de colis refusés", f"{A['REFUSAL']*100:.0f} %", "Tunisie : 20–30 % en paiement à la livraison"],
 ["Frais fixes par mois", f3(A['FIXED'])+" DT", "Téléphone, internet, outils, nom de domaine"],
 ["Taux de change", f"1 USD = {A['FX']:.1f} DT", "Arrondi"],
])}

<h2><span class="n">02</span>La stratégie</h2>
<ul>
<li><b>Un seul prix, 9,900 DT.</b> Aucun calcul pour le client, message clair dans chaque pub. Les concurrents tunisiens vendent des gadgets similaires 12–35 DT.</li>
<li><b>Livraison gratuite dès 5 articles.</b> C'est le moteur du modèle : une commande d'1 article perd de l'argent (section 5). Tout le site pousse vers 5 articles : barre de progression dans le panier, 6 packs de 5.</li>
<li><b>Produits « consommables »</b> que les gens rachètent : éponges, sacs zip, filets d'évier, épingles hijab, verres trempés, chaussettes. Vendus <b>en lots</b>, car à l'unité ils coûtent ~1 DT en magasin.</li>
<li><b>Saisons :</b> hiver maintenant (Pack Hiver), Ramadan à partir de mi-janvier (Pack Ramadan, Pack Cuisine), révisions du 2e trimestre (Pack Révision).</li>
<li><b>Vente sur les réseaux :</b> Facebook + Instagram et TikTok (6 millions d'adultes tunisiens). Vidéos « haul » de 5 articles, posts prêts dans <i>3achra-posts.zip</i>.</li>
<li><b>Confiance :</b> paiement à la livraison, numéro WhatsApp visible, confirmation de <b>chaque</b> commande sur WhatsApp avant envoi (réduit les refus).</li>
<li><b>Approvisionnement en 2 étapes :</b> (1) grossistes de produits chinois en Tunisie (Souk Sidi Boumendil, Moncef Bey) en petites quantités ; (2) après 2–3 mois, import direct 1688 en groupage pour les meilleures ventes.</li>
</ul>

<h2 class="pb"><span class="n">03</span>Coût d'un article : de la Chine à la Tunisie</h2>
<p>Exemple pour un article acheté <b>0,50 USD</b> sur 1688 (import direct, étape 2) :</p>
{table(["Étape","Détail","Montant"],[[e(a),e(b),f3(c)+" DT"] for a,b,c in chain])}
<div class="formula">Coût rendu ≈ prix Chine × {A['FX']:.1f} × 1,6 à 1,7
Règle 3achra : coût rendu ≤ {f3(A['MAX_LANDED'])} DT  →  prix Chine ≤ ~{A['MAX_LANDED']/A['FX']/1.65:.2f} USD (≈ 4 CNY)</div>
<p>À l'étape 1 (grossiste tunisien), le coût rendu = prix grossiste + transport jusqu'à chez vous. Même règle : <b>≤ 3,300 DT</b> par lot vendu.</p>

<h2><span class="n">04</span>Emballage d'une commande</h2>
{table(["Élément","Coût (estimation)"],[[e(a),f3(b)+" DT"] for a,b in PACKAGING]+[["<b>Total par commande</b>","<b>"+f3(A['PACKAGING'])+" DT</b>"]])}
<p class="sub">Le coût est par <b>commande</b> (un colis), pas par article. Acheter les sachets par 500–1 000 pour atteindre ce prix.</p>

<h2><span class="n">05</span>Calcul exact du bénéfice d'une commande</h2>
<div class="formula">Commande livrée :
  Bénéfice = (prix des articles + livraison payée par le client)
           − (nb articles × coût rendu) − transporteur − emballage − pub

Commande refusée (le client ne prend pas le colis, l'article revient en stock) :
  Perte = − pub − frais de retour − emballage

Bénéfice moyen par commande passée :
  = (1 − taux de refus) × bénéfice livré + taux de refus × perte refusée</div>
{table(["","1 article","3 articles","Pack 5 articles"],[
 ["Client paie (articles)"]+[f3(x['price']) for x in EX],
 ["Client paie (livraison)"]+[f3(x['ship']) for x in EX],
 ["<b>Encaissé si livré</b>"]+[f"<b>{f3(x['rev'])}</b>" for x in EX],
 ["− Coût des articles (× 3,000)"]+[f3(x['goods']) for x in EX],
 ["− Transporteur"]+[f3(A['COURIER'])]*3,
 ["− Emballage"]+[f3(A['PACKAGING'])]*3,
 ["− Publicité"]+[f3(A['ADS'])]*3,
 ["<b>= Bénéfice si livré</b>"]+[f"<b class='{'pos' if x['delivered']>=0 else 'neg'}'>{f3(x['delivered'])}</b>" for x in EX],
 ["Perte si refusé"]+[f"<span class='neg'>{f3(x['refused'])}</span>" for x in EX],
 [f"<b>= Moyen par commande ({A['REFUSAL']*100:.0f} % refus)</b>"]+[f"<b class='{'pos' if x['expected']>=0 else 'neg'}'>{f3(x['expected'])}</b>" for x in EX],
])}
<div class="box"><b>Conclusion :</b> 1 article = perte ({f3(EX[0]['expected'])} DT). 3 articles = {f3(EX[1]['expected'])} DT. Pack de 5 = {f3(EX[2]['expected'])} DT. Le panier moyen doit être de <b>4 à 5 articles</b>.</div>

<h2 class="pb"><span class="n">06</span>Objectif 5 000 DT par mois</h2>
<p>Mélange de commandes supposé : panier moyen 4 articles = {PB['p']*100:.0f} % de packs de 5 et {100-PB['p']*100:.0f} % de petites commandes de 2,5 articles (qui paient la livraison). Bénéfice moyen par commande passée : <b>{f3(PB['c'])} DT</b>.</p>
<div class="formula">(A) 5 000 DT de ventes :     commandes = 5 000 ÷ (0,8 × 9,9 × 4)
(B) 5 000 DT de bénéfice net : commandes = (5 000 + {f0(A['FIXED'])} frais fixes) ÷ {f3(PB['c'])}</div>
{table(["","(A) 5 000 DT de ventes","(B) 5 000 DT de bénéfice"],[
 ["Commandes passées / mois", f0(PA['placed']), f0(PB['placed'])],
 ["Commandes par jour", f"{PA['day']:.1f}", f"{PB['day']:.1f}"],
 ["Commandes livrées / mois", f0(PA['delivered']), f0(PB['delivered'])],
 ["Articles vendus / mois", f0(PA['sold']), f0(PB['sold'])],
 ["Ventes (articles livrés)", f0(PA['sales'])+" DT", f0(PB['sales'])+" DT"],
 ["<b>Bénéfice net</b>", f"<b>{f0(PA['profit'])} DT</b>", f"<b>{f0(PB['profit'])} DT</b>"],
 ["Budget pub / mois (par jour)", f"{f0(PA['ads'])} DT ({f0(PA['ads']/30)}/j)", f"{f0(PB['ads'])} DT ({f0(PB['ads']/30)}/j)"],
 ["Stock à avoir (1,2 mois)", f"{f0(PA['stock_units'])} articles = {f0(PA['stock_dt'])} DT", f"{f0(PB['stock_units'])} articles = {f0(PB['stock_dt'])} DT"],
])}
<h3>Montée en charge vers (B), sur 3 mois</h3>
{table(["Mois","Commandes / mois","Par jour","Pub / mois","Bénéfice net"],[[str(m),f0(o),f"{d:.1f}",f0(a)+" DT",f"<span class='{'pos' if pr>=0 else 'neg'}'>{f0(pr)} DT</span>"] for m,o,d,a,pr in RAMP])}
<p class="sub">Coût de pub par commande : 10 DT au mois 1, 9 au mois 2, 8 au mois 3 (on apprend à mieux cibler).</p>
<h3>Commandes nécessaires par mois pour 5 000 DT de bénéfice</h3>
{table(["Taux de refus","Panier 3 articles","Panier 4 articles","Panier 5 articles"],[[f"{int(r*100)} %"]+[f0(x) for x in row] for r,row in zip((0.1,0.2,0.3),SENS)])}
<div class="box">Les deux leviers les plus forts : <b>un article de plus par commande</b> et <b>moins de refus</b> (confirmer chaque commande sur WhatsApp). Ne pas dépasser <b>10 DT de pub par commande</b>.</div>

<h2><span class="n">07</span>Points bloquants à régler avant le lancement</h2>
<ul>
<li><b>Paiement de la pub en devises :</b> la carte technologique internationale des particuliers serait limitée à ~1 000 DT/an (à vérifier avec votre banque) : pas assez pour la pub (B). Voir avec un comptable : société / startup = plafonds plus élevés.</li>
<li><b>Statut légal :</b> inscription au RNE avant la 1re vente ; auto-entrepreneur possible jusqu'à 75 000 DT de CA/an.</li>
<li><b>Pas de faux prix barrés</b> (loi 98-40) : 9,900 DT est le prix normal.</li>
<li><b>Éviter au début :</b> jouets, électrique, chargeurs, batteries, cosmétiques (contrôle technique à l'import).</li>
<li><b>Transporteur :</b> demander des devis écrits à 3 sociétés (First Delivery, Intigo, Navex, Aramex…) et négocier le frais de retour.</li>
</ul>

<h2 class="pb"><span class="n">08</span>Les 44 produits : coût et marge estimés</h2>
<p class="sub">Coût rendu estimé = prix Chine moyen × {A['FX']:.1f} × 1,65. <span class="neg">Rouge</span> = au-dessus de {f3(A['MAX_LANDED'])} DT : vérifier le prix chez le grossiste avant d'acheter.</p>
{table(["#","Catégorie","Produit","Chine USD","Coût rendu DT","Marge brute DT"],[[str(i),e(c),e(n),u,f"<span class='{'neg' if l>A['MAX_LANDED'] else ''}'>{f3(l)}</span>",f3(m)] for i,c,n,u,l,m in rows],"small")}
<p class="sub">Marge brute = 9,900 − coût rendu, avant transporteur, emballage et pub (voir section 5).</p>
</body></html>"""
(HERE/"plan.html").write_text(html_doc, encoding="utf-8")
subprocess.run(["node", "-e", f"""
const {{chromium}}=require('playwright');(async()=>{{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://{HERE/'plan.html'}',{{waitUntil:'networkidle'}});await p.evaluate(()=>document.fonts.ready);
await p.pdf({{path:'{HERE/'3achra-business-plan.pdf'}',format:'A4',printBackground:true,margin:{{top:'16mm',bottom:'16mm',left:'15mm',right:'15mm'}}}});await b.close()}})()"""], check=True)
print("examples", [(x['k'], round(x['delivered'],3), round(x['expected'],3)) for x in EX])
print("A", PA['placed'], "B", PB['placed'], round(PB['c'],3), PB['profit'])
print("over limit:", [r[2] for r in rows if r[4] > A["MAX_LANDED"]])
