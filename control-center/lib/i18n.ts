export const LANGS = ["en", "ar", "fr"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_NAMES: Record<Lang, string> = { en: "English", ar: "العربية", fr: "Français" };
export const isRtl = (l: Lang) => l === "ar";

const en = {
  dashboard: "CEO Dashboard", agents: "AI Marketing Team", campaigns: "Campaign Manager", approvals: "Approvals",
  content: "Content Studio", calendar: "Marketing Calendar", intelligence: "Market Intelligence", metrics: "Data & Metrics",
  integrations: "Integrations", workflows: "Automations", reports: "Executive Report", audit: "Audit Log",
  brands: "Brands", notifications: "Notifications", logout: "Log out", login: "Sign in", email: "Email", password: "Password",
  totalSales: "Total sales", attributedRevenue: "Marketing-attributed revenue", spend: "Marketing expenditure",
  netProfit: "Net operating profit (marketing view)", activeCampaigns: "Active campaigns", newLeads: "New leads",
  newCustomers: "New customers", traffic: "Website sessions", convRate: "Conversion rate", cac: "Customer acquisition cost",
  roas: "Return on ad spend", agentActivity: "AI agent activity", tasksDone: "Tasks completed", noData: "No data recorded",
  noDataHint: "Connect an integration or record verified figures in Data & Metrics.", pendingApprovals: "Pending approvals",
  approve: "APPROVE", reject: "REJECT", reason: "Reason", save: "Save", create: "Create", run: "Run", status: "Status",
  last30: "Last 30 days", verified: "Verified", estimate: "Estimate", assumption: "Assumption",
};
type Dict = typeof en;

const ar: Dict = {
  dashboard: "لوحة الرئيس التنفيذي", agents: "فريق التسويق الذكي", campaigns: "إدارة الحملات", approvals: "الموافقات",
  content: "استوديو المحتوى", calendar: "التقويم التسويقي", intelligence: "ذكاء السوق", metrics: "البيانات والمؤشرات",
  integrations: "التكاملات", workflows: "الأتمتة", reports: "التقرير التنفيذي", audit: "سجل التدقيق",
  brands: "العلامات التجارية", notifications: "الإشعارات", logout: "تسجيل الخروج", login: "تسجيل الدخول", email: "البريد الإلكتروني", password: "كلمة المرور",
  totalSales: "إجمالي المبيعات", attributedRevenue: "الإيرادات المنسوبة للتسويق", spend: "الإنفاق التسويقي",
  netProfit: "صافي الربح التشغيلي (منظور التسويق)", activeCampaigns: "الحملات النشطة", newLeads: "العملاء المحتملون الجدد",
  newCustomers: "العملاء الجدد", traffic: "زيارات الموقع", convRate: "معدل التحويل", cac: "تكلفة اكتساب العميل",
  roas: "العائد على الإنفاق الإعلاني", agentActivity: "نشاط الوكلاء", tasksDone: "المهام المنجزة", noData: "لا توجد بيانات مسجلة",
  noDataHint: "اربط تكاملاً أو سجّل أرقاماً موثقة في البيانات والمؤشرات.", pendingApprovals: "موافقات معلقة",
  approve: "موافقة", reject: "رفض", reason: "السبب", save: "حفظ", create: "إنشاء", run: "تشغيل", status: "الحالة",
  last30: "آخر 30 يوماً", verified: "موثّق", estimate: "تقدير", assumption: "افتراض",
};

const fr: Dict = {
  dashboard: "Tableau de bord PDG", agents: "Équipe marketing IA", campaigns: "Gestion des campagnes", approvals: "Approbations",
  content: "Studio de contenu", calendar: "Calendrier marketing", intelligence: "Veille marché", metrics: "Données & indicateurs",
  integrations: "Intégrations", workflows: "Automatisations", reports: "Rapport exécutif", audit: "Journal d'audit",
  brands: "Marques", notifications: "Notifications", logout: "Déconnexion", login: "Se connecter", email: "E-mail", password: "Mot de passe",
  totalSales: "Ventes totales", attributedRevenue: "Revenu attribué au marketing", spend: "Dépenses marketing",
  netProfit: "Résultat opérationnel net (vue marketing)", activeCampaigns: "Campagnes actives", newLeads: "Nouveaux prospects",
  newCustomers: "Nouveaux clients", traffic: "Sessions du site", convRate: "Taux de conversion", cac: "Coût d'acquisition client",
  roas: "Retour sur dépenses publicitaires", agentActivity: "Activité des agents IA", tasksDone: "Tâches terminées", noData: "Aucune donnée enregistrée",
  noDataHint: "Connectez une intégration ou saisissez des chiffres vérifiés dans Données & indicateurs.", pendingApprovals: "Approbations en attente",
  approve: "APPROUVER", reject: "REJETER", reason: "Motif", save: "Enregistrer", create: "Créer", run: "Lancer", status: "Statut",
  last30: "30 derniers jours", verified: "Vérifié", estimate: "Estimation", assumption: "Hypothèse",
};

export const DICTS: Record<Lang, Dict> = { en, ar, fr };
export type TKey = keyof Dict;
