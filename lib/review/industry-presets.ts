/**
 * Trilingual service + quality chip presets per review_category.
 *
 * One source of truth for the public review page (/r/[slug]):
 * - SERVICES chips: "What did you receive?" (multi-select).
 * - QUALITIES chips: "How would you describe it?" (multi-select).
 *
 * Each list is short (~6–10 chips). Customer can also add a free-text
 * "+ Other" tag on the page itself; we don't try to enumerate every
 * possible niche here.
 */

import type { Language } from "@/lib/i18n/review";

export type ReviewCategory =
  // food_beverage
  | "restaurant"
  | "cafe_bakery"
  | "bar_lounge"
  | "takeout_delivery"
  // medical_health
  | "dental"
  | "acupuncture_tcm"
  | "chiropractic"
  | "optometry"
  | "physical_therapy"
  | "mental_health"
  | "veterinary"
  | "medical_general"
  | "medspa_aesthetic"
  // attorney
  | "attorney_immigration"
  | "attorney_estate_family"
  | "attorney_business_tax"
  | "attorney_personal_injury"
  | "attorney_general"
  // real_estate_insurance
  | "real_estate"
  | "insurance"
  | "mortgage_loan"
  // auto
  | "auto_repair"
  | "auto_sales"
  | "auto_detailing"
  // travel_resort
  | "hotel_lodging"
  | "travel_agency"
  // health_food_products
  | "health_supplements"
  | "specialty_grocery"
  // home_services
  | "home_repair"
  | "cleaning_service"
  | "landscape_pest"
  | "moving_storage"
  // beauty_fitness
  | "hair_salon"
  | "nail_salon"
  | "spa_massage"
  | "gym_fitness"
  // apparel_retail
  | "apparel_clothing"
  | "jewelry_watch"
  | "shoes_accessories"
  // education_tutoring (new BAAM Review parent)
  | "tutoring_test_prep"
  | "language_school"
  | "translation_immigration"
  // professional_services (new BAAM Review parent)
  | "accounting_tax"
  | "financial_advisor"
  | "professional_general"
  // fallback
  | "other";

export const REVIEW_CATEGORIES: ReviewCategory[] = [
  "restaurant","cafe_bakery","bar_lounge","takeout_delivery",
  "dental","acupuncture_tcm","chiropractic","optometry","physical_therapy",
  "mental_health","veterinary","medical_general","medspa_aesthetic",
  "attorney_immigration","attorney_estate_family","attorney_business_tax",
  "attorney_personal_injury","attorney_general",
  "real_estate","insurance","mortgage_loan",
  "auto_repair","auto_sales","auto_detailing",
  "hotel_lodging","travel_agency",
  "health_supplements","specialty_grocery",
  "home_repair","cleaning_service","landscape_pest","moving_storage",
  "hair_salon","nail_salon","spa_massage","gym_fitness",
  "apparel_clothing","jewelry_watch","shoes_accessories",
  "tutoring_test_prep","language_school","translation_immigration",
  "accounting_tax","financial_advisor","professional_general",
  "other",
];

/** Human-readable label used in admin dropdowns + audit alignment. */
export const CATEGORY_LABELS: Record<ReviewCategory, { en: string; zh: string; es: string; parent: string }> = {
  restaurant:            { en: "Restaurant",                       zh: "餐厅",                es: "Restaurante",                   parent: "Food & Beverage" },
  cafe_bakery:           { en: "Cafe / Bakery / Boba",             zh: "咖啡馆 / 烘焙 / 奶茶",  es: "Café / Panadería",              parent: "Food & Beverage" },
  bar_lounge:            { en: "Bar / Lounge / KTV",               zh: "酒吧 / 休闲吧 / KTV",  es: "Bar / Salón",                   parent: "Food & Beverage" },
  takeout_delivery:      { en: "Takeout / Food truck",             zh: "外卖 / 餐车",          es: "Comida para llevar",            parent: "Food & Beverage" },
  dental:                { en: "Dental",                           zh: "牙科",                es: "Dental",                        parent: "Medical & Health" },
  acupuncture_tcm:       { en: "Acupuncture / TCM",                zh: "针灸 / 中医",          es: "Acupuntura / MTC",              parent: "Medical & Health" },
  chiropractic:          { en: "Chiropractic",                     zh: "脊椎调整",            es: "Quiropráctico",                 parent: "Medical & Health" },
  optometry:             { en: "Optometry / Eye care",             zh: "眼科 / 视光",          es: "Optometría",                    parent: "Medical & Health" },
  physical_therapy:      { en: "Physical therapy / Rehab",         zh: "物理治疗 / 复健",      es: "Fisioterapia",                  parent: "Medical & Health" },
  mental_health:         { en: "Mental health / Therapy",          zh: "心理健康 / 咨询",      es: "Salud mental",                  parent: "Medical & Health" },
  veterinary:            { en: "Veterinary",                       zh: "兽医",                es: "Veterinario",                   parent: "Medical & Health" },
  medical_general:       { en: "General medical",                  zh: "全科 / 内科",          es: "Médico general",                parent: "Medical & Health" },
  medspa_aesthetic:      { en: "Medspa / Dermatology / Aesthetic", zh: "医美 / 皮肤科",        es: "Medspa / Dermatología",         parent: "Medical & Health" },
  attorney_immigration:  { en: "Immigration law",                  zh: "移民律师",            es: "Inmigración (abogado)",         parent: "Attorney" },
  attorney_estate_family:{ en: "Estate / Family law",              zh: "遗产 / 家庭法律",      es: "Patrimonio / Familia",          parent: "Attorney" },
  attorney_business_tax: { en: "Business / Tax law",               zh: "商业 / 税务法律",      es: "Negocios / Impuestos",          parent: "Attorney" },
  attorney_personal_injury:{ en: "Personal injury law",            zh: "人身伤害律师",        es: "Lesiones personales",           parent: "Attorney" },
  attorney_general:      { en: "Attorney (general)",               zh: "律师（综合）",        es: "Abogado general",               parent: "Attorney" },
  real_estate:           { en: "Real estate",                      zh: "房地产",              es: "Bienes raíces",                 parent: "Real Estate & Insurance" },
  insurance:             { en: "Insurance",                        zh: "保险",                es: "Seguros",                       parent: "Real Estate & Insurance" },
  mortgage_loan:         { en: "Mortgage / Loan",                  zh: "房贷 / 贷款",          es: "Hipoteca / Préstamo",           parent: "Real Estate & Insurance" },
  auto_repair:           { en: "Auto repair / Body shop",          zh: "汽车修理 / 钣金",      es: "Reparación / Carrocería",       parent: "Auto" },
  auto_sales:            { en: "Auto sales / Dealership",          zh: "汽车销售 / 经销商",    es: "Concesionario",                 parent: "Auto" },
  auto_detailing:        { en: "Auto detailing / Wash",            zh: "汽车美容 / 洗车",      es: "Detallado / Lavado",            parent: "Auto" },
  hotel_lodging:         { en: "Hotel / Lodging",                  zh: "酒店 / 住宿",          es: "Hotel / Alojamiento",           parent: "Travel & Resort" },
  travel_agency:         { en: "Travel agency",                    zh: "旅行社",              es: "Agencia de viajes",             parent: "Travel & Resort" },
  health_supplements:    { en: "Health food / Supplements",        zh: "保健食品 / 营养品",    es: "Suplementos / Nutrición",       parent: "Health Food & Products" },
  specialty_grocery:     { en: "Specialty grocery",                zh: "特色超市",            es: "Supermercado especializado",    parent: "Health Food & Products" },
  home_repair:           { en: "Home repair / HVAC / Plumbing",    zh: "家居维修 / 水电",      es: "Reparación / HVAC / Plomería",  parent: "Home Services" },
  cleaning_service:      { en: "Cleaning service",                 zh: "清洁服务",            es: "Limpieza",                      parent: "Home Services" },
  landscape_pest:        { en: "Landscaping / Pest control",       zh: "园艺 / 害虫防治",      es: "Jardinería / Plagas",           parent: "Home Services" },
  moving_storage:        { en: "Moving / Storage",                 zh: "搬家 / 仓储",          es: "Mudanza / Almacenaje",          parent: "Home Services" },
  hair_salon:            { en: "Hair salon / Barber",              zh: "美发 / 理发店",        es: "Peluquería / Barbería",         parent: "Beauty & Fitness" },
  nail_salon:            { en: "Nail salon",                       zh: "美甲店",              es: "Salón de uñas",                 parent: "Beauty & Fitness" },
  spa_massage:           { en: "Spa / Massage",                    zh: "水疗 / 按摩",          es: "Spa / Masaje",                  parent: "Beauty & Fitness" },
  gym_fitness:           { en: "Gym / Fitness / Yoga",             zh: "健身房 / 瑜伽",        es: "Gimnasio / Yoga",               parent: "Beauty & Fitness" },
  apparel_clothing:      { en: "Apparel / Clothing",               zh: "服装",                es: "Ropa",                          parent: "Apparel & Fashion Retail" },
  jewelry_watch:         { en: "Jewelry / Watch",                  zh: "珠宝 / 钟表",          es: "Joyería / Relojería",           parent: "Apparel & Fashion Retail" },
  shoes_accessories:     { en: "Shoes / Accessories",              zh: "鞋类 / 配饰",          es: "Calzado / Accesorios",          parent: "Apparel & Fashion Retail" },
  tutoring_test_prep:    { en: "Tutoring / Test prep",             zh: "辅导 / 备考",          es: "Tutoría / Preparación",         parent: "Education & Tutoring" },
  language_school:       { en: "Language school",                  zh: "语言学校",            es: "Escuela de idiomas",            parent: "Education & Tutoring" },
  translation_immigration:{ en: "Translation / Immigration services", zh: "翻译 / 移民服务",  es: "Traducción / Inmigración",      parent: "Education & Tutoring" },
  accounting_tax:        { en: "Accounting / Tax",                 zh: "会计 / 报税",          es: "Contabilidad / Impuestos",      parent: "Professional Services" },
  financial_advisor:     { en: "Financial advisor",                zh: "理财顾问",            es: "Asesor financiero",             parent: "Professional Services" },
  professional_general:  { en: "Professional services (other)",    zh: "专业服务（其他）",    es: "Servicios profesionales",       parent: "Professional Services" },
  other:                 { en: "Other",                             zh: "其他",                es: "Otro",                          parent: "Other" },
};

interface ChipSet {
  en: readonly string[];
  zh: readonly string[];
  es: readonly string[];
}

interface CategoryPreset {
  services: ChipSet;
  qualities: ChipSet;
}

/** Quality chips used when a category has no specific override — broad, work for any business. */
const GENERIC_QUALITIES: ChipSet = {
  en: ["Professional", "Friendly", "Knowledgeable", "Patient", "Helpful", "Punctual", "Clear", "Trustworthy"],
  zh: ["专业", "友善", "知识丰富", "有耐心", "乐于助人", "守时", "讲解清楚", "值得信任"],
  es: ["Profesional", "Amable", "Conocedor", "Paciente", "Servicial", "Puntual", "Claro", "Confiable"],
};

export const PRESETS: Record<ReviewCategory, CategoryPreset> = {
  // ===== FOOD & BEVERAGE =====
  restaurant: {
    services: {
      en: ["Lunch", "Dinner", "Brunch", "Takeout", "Delivery", "Private event", "Bar"],
      zh: ["午餐", "晚餐", "早午餐", "外带", "外送", "包场", "酒水"],
      es: ["Almuerzo", "Cena", "Brunch", "Para llevar", "Entrega", "Evento privado", "Bar"],
    },
    qualities: {
      en: ["Delicious", "Authentic", "Friendly", "Clean", "Cozy", "Generous portion", "Fast service", "Good value"],
      zh: ["好吃", "正宗", "友善", "干净", "环境好", "份量足", "上菜快", "性价比高"],
      es: ["Delicioso", "Auténtico", "Amable", "Limpio", "Acogedor", "Buena porción", "Rápido", "Buen precio"],
    },
  },
  cafe_bakery: {
    services: {
      en: ["Coffee", "Tea / Boba", "Pastry", "Cake", "Sandwich", "Brunch", "Takeout"],
      zh: ["咖啡", "茶 / 奶茶", "糕点", "蛋糕", "三明治", "早午餐", "外带"],
      es: ["Café", "Té / Boba", "Pastel", "Tarta", "Sándwich", "Brunch", "Para llevar"],
    },
    qualities: {
      en: ["Tasty", "Fresh", "Cozy atmosphere", "Friendly", "Good Wi-Fi", "Quick", "Worth the price", "Beautifully made"],
      zh: ["好喝", "新鲜", "环境舒适", "友善", "Wi-Fi 好", "快速", "物超所值", "精致漂亮"],
      es: ["Sabroso", "Fresco", "Ambiente acogedor", "Amable", "Buen Wi-Fi", "Rápido", "Buen precio", "Hermosa presentación"],
    },
  },
  bar_lounge: {
    services: {
      en: ["Cocktails", "Beer / Wine", "Happy hour", "Live music", "Karaoke", "Private room", "Snacks"],
      zh: ["调酒", "啤酒 / 葡萄酒", "欢乐时光", "现场音乐", "KTV", "包厢", "小食"],
      es: ["Cócteles", "Cerveza / Vino", "Happy hour", "Música en vivo", "Karaoke", "Sala privada", "Aperitivos"],
    },
    qualities: {
      en: ["Great vibe", "Talented bartender", "Friendly staff", "Clean", "Reasonable price", "Lively", "Comfortable"],
      zh: ["氛围好", "调酒师专业", "服务好", "干净", "价格合理", "热闹", "舒服"],
      es: ["Buen ambiente", "Cantinero talentoso", "Personal amable", "Limpio", "Precio razonable", "Animado", "Cómodo"],
    },
  },
  takeout_delivery: {
    services: {
      en: ["Lunch combo", "Dinner combo", "Catering", "Delivery", "Group order"],
      zh: ["午餐套餐", "晚餐套餐", "宴会外送", "外送", "团购"],
      es: ["Combo almuerzo", "Combo cena", "Catering", "Entrega", "Pedido grupal"],
    },
    qualities: {
      en: ["Fast", "Hot / Fresh", "Accurate order", "Friendly", "Well-packaged", "Good value", "Easy ordering"],
      zh: ["快速", "热乎 / 新鲜", "下单准确", "友善", "包装好", "性价比高", "好下单"],
      es: ["Rápido", "Caliente / Fresco", "Pedido exacto", "Amable", "Bien empaquetado", "Buen precio", "Fácil de pedir"],
    },
  },

  // ===== MEDICAL & HEALTH =====
  dental: {
    services: {
      en: ["Cleaning", "Filling", "Crown", "Whitening", "Extraction", "Implant", "Orthodontics", "Emergency"],
      zh: ["洗牙", "补牙", "牙冠", "美白", "拔牙", "种植牙", "正畸", "急诊"],
      es: ["Limpieza", "Empaste", "Corona", "Blanqueamiento", "Extracción", "Implante", "Ortodoncia", "Urgencia"],
    },
    qualities: {
      en: ["Gentle", "Painless", "Thorough", "Professional", "Patient", "Reassuring", "Modern equipment", "Clean"],
      zh: ["温柔", "无痛", "细致", "专业", "有耐心", "让人安心", "设备先进", "干净"],
      es: ["Suave", "Indoloro", "Minucioso", "Profesional", "Paciente", "Tranquilizador", "Equipo moderno", "Limpio"],
    },
  },
  acupuncture_tcm: {
    services: {
      en: ["Acupuncture", "Cupping", "Herbal consultation", "Tuina massage", "Moxibustion", "Initial consult"],
      zh: ["针灸", "拔罐", "中药咨询", "推拿", "艾灸", "初诊"],
      es: ["Acupuntura", "Ventosas", "Consulta herbal", "Masaje Tuina", "Moxibustión", "Consulta inicial"],
    },
    qualities: {
      en: ["Skilled", "Effective", "Knowledgeable", "Caring", "Traditional", "Holistic", "Patient", "Calming"],
      zh: ["技术好", "见效快", "知识丰富", "关心患者", "传统正宗", "整体调理", "有耐心", "让人放松"],
      es: ["Hábil", "Eficaz", "Conocedor", "Atento", "Tradicional", "Holístico", "Paciente", "Relajante"],
    },
  },
  chiropractic: {
    services: {
      en: ["Spinal adjustment", "Decompression", "Soft tissue therapy", "Posture assessment", "Sports injury", "Initial consult"],
      zh: ["脊椎调整", "牵引", "软组织治疗", "姿势评估", "运动损伤", "初诊"],
      es: ["Ajuste espinal", "Descompresión", "Tejidos blandos", "Postura", "Lesión deportiva", "Consulta inicial"],
    },
    qualities: {
      en: ["Effective", "Gentle", "Skilled hands", "Explains well", "Listened to me", "Pain relief", "Professional"],
      zh: ["有效", "手法温和", "技术好", "讲解清楚", "认真倾听", "缓解疼痛", "专业"],
      es: ["Eficaz", "Suave", "Manos hábiles", "Explica bien", "Escuchó", "Alivia el dolor", "Profesional"],
    },
  },
  optometry: {
    services: {
      en: ["Eye exam", "Contact lens fitting", "Eyewear / Glasses", "Pediatric exam", "Eye disease screening"],
      zh: ["验光", "隐形眼镜配戴", "配镜", "儿童眼检", "眼疾筛查"],
      es: ["Examen ocular", "Lentes de contacto", "Gafas", "Examen pediátrico", "Detección de enfermedades"],
    },
    qualities: {
      en: ["Thorough exam", "Patient", "Clear explanation", "Great frame selection", "Modern equipment", "Friendly"],
      zh: ["检查仔细", "有耐心", "讲解清楚", "镜架选择多", "设备先进", "友善"],
      es: ["Examen minucioso", "Paciente", "Explicación clara", "Buena selección de monturas", "Equipo moderno", "Amable"],
    },
  },
  physical_therapy: {
    services: {
      en: ["Initial evaluation", "Manual therapy", "Exercise therapy", "Post-surgery rehab", "Sports recovery", "Pain management"],
      zh: ["初次评估", "手法治疗", "运动疗法", "术后康复", "运动恢复", "疼痛管理"],
      es: ["Evaluación inicial", "Terapia manual", "Ejercicio terapéutico", "Rehabilitación postoperatoria", "Recuperación deportiva", "Manejo del dolor"],
    },
    qualities: {
      en: ["Effective", "Knowledgeable", "Encouraging", "Patient", "Listens", "Customized plan", "Saw real progress"],
      zh: ["有效", "知识丰富", "鼓励性强", "有耐心", "认真倾听", "个性化计划", "进步明显"],
      es: ["Eficaz", "Conocedor", "Alentador", "Paciente", "Escucha", "Plan personalizado", "Vi progreso real"],
    },
  },
  mental_health: {
    services: {
      en: ["Individual therapy", "Couples therapy", "Family therapy", "Group session", "Medication consult", "Initial consult"],
      zh: ["个人咨询", "伴侣咨询", "家庭咨询", "团体咨询", "药物咨询", "初诊"],
      es: ["Terapia individual", "Terapia de pareja", "Terapia familiar", "Sesión grupal", "Consulta de medicación", "Consulta inicial"],
    },
    qualities: {
      en: ["Compassionate", "Non-judgmental", "Insightful", "Patient", "Confidential", "Made me feel safe", "Helpful"],
      zh: ["富有同情心", "不评判", "有洞察力", "有耐心", "保密性好", "让人安心", "有帮助"],
      es: ["Compasivo", "Sin juicios", "Perspicaz", "Paciente", "Confidencial", "Me sentí seguro", "Útil"],
    },
  },
  veterinary: {
    services: {
      en: ["Wellness exam", "Vaccinations", "Dental cleaning", "Surgery", "Emergency", "Grooming", "Boarding"],
      zh: ["健康体检", "疫苗", "宠物洁牙", "手术", "急诊", "美容", "寄宿"],
      es: ["Examen de bienestar", "Vacunas", "Limpieza dental", "Cirugía", "Urgencia", "Peluquería", "Hospedaje"],
    },
    qualities: {
      en: ["Loves animals", "Gentle with pet", "Thorough", "Clear explanation", "Reasonable price", "Clean facility", "Caring"],
      zh: ["爱护动物", "对宠物温柔", "细致", "讲解清楚", "价格合理", "环境干净", "贴心"],
      es: ["Ama a los animales", "Suave con la mascota", "Minucioso", "Explica claramente", "Precio razonable", "Instalación limpia", "Atento"],
    },
  },
  medical_general: {
    services: {
      en: ["Annual physical", "Sick visit", "Consultation", "Vaccinations", "Lab work", "Follow-up", "Telehealth"],
      zh: ["年度体检", "门诊就诊", "咨询", "疫苗接种", "化验", "复诊", "远程问诊"],
      es: ["Examen anual", "Consulta de enfermedad", "Consulta", "Vacunas", "Análisis", "Seguimiento", "Telesalud"],
    },
    qualities: {
      en: ["Listens carefully", "Thorough", "Clear explanation", "Short wait time", "Professional", "Caring staff", "Modern facility"],
      zh: ["认真倾听", "细致", "讲解清楚", "等候时间短", "专业", "员工贴心", "设施先进"],
      es: ["Escucha", "Minucioso", "Explica claramente", "Poca espera", "Profesional", "Personal atento", "Instalación moderna"],
    },
  },
  medspa_aesthetic: {
    services: {
      en: ["Botox / Filler", "Laser hair removal", "Facial / Peel", "IV therapy", "Weight loss program", "Skin treatment", "Consultation"],
      zh: ["肉毒 / 填充", "激光脱毛", "面部护理 / 焕肤", "静脉点滴", "减重项目", "皮肤治疗", "咨询"],
      es: ["Botox / Relleno", "Depilación láser", "Facial / Peeling", "Terapia IV", "Programa de pérdida de peso", "Tratamiento de piel", "Consulta"],
    },
    qualities: {
      en: ["Natural-looking result", "Skilled", "Knowledgeable", "Listens to goals", "Clean facility", "Honest advice", "Relaxing"],
      zh: ["效果自然", "技术好", "知识丰富", "了解需求", "环境干净", "诚实建议", "放松"],
      es: ["Resultado natural", "Hábil", "Conocedor", "Escucha objetivos", "Instalación limpia", "Consejo honesto", "Relajante"],
    },
  },

  // ===== ATTORNEY =====
  attorney_immigration: {
    services: {
      en: ["Visa application", "Green card", "Citizenship / Naturalization", "Family petition", "Asylum / Refugee", "Consultation"],
      zh: ["签证申请", "绿卡申请", "入籍 / 公民", "家庭团聚", "庇护 / 难民", "咨询"],
      es: ["Solicitud de visa", "Tarjeta verde", "Ciudadanía / Naturalización", "Petición familiar", "Asilo / Refugiado", "Consulta"],
    },
    qualities: {
      en: ["Knowledgeable", "Honest", "Patient", "Responsive", "Clear about process", "Trustworthy", "Strategic", "Bilingual"],
      zh: ["知识丰富", "诚实", "有耐心", "回应快", "流程清晰", "值得信任", "有策略", "双语沟通"],
      es: ["Conocedor", "Honesto", "Paciente", "Responde rápido", "Proceso claro", "Confiable", "Estratégico", "Bilingüe"],
    },
  },
  attorney_estate_family: {
    services: {
      en: ["Will / Trust", "Estate planning", "Probate", "Divorce", "Child custody", "Prenuptial agreement", "Consultation"],
      zh: ["遗嘱 / 信托", "遗产规划", "遗产认证", "离婚", "子女抚养", "婚前协议", "咨询"],
      es: ["Testamento / Fideicomiso", "Planificación patrimonial", "Sucesión", "Divorcio", "Custodia", "Acuerdo prenupcial", "Consulta"],
    },
    qualities: {
      en: ["Compassionate", "Knowledgeable", "Discreet", "Clear", "Patient", "Strategic", "Trustworthy", "Listened"],
      zh: ["富有同情心", "知识丰富", "保密", "讲解清楚", "有耐心", "有策略", "值得信任", "认真倾听"],
      es: ["Compasivo", "Conocedor", "Discreto", "Claro", "Paciente", "Estratégico", "Confiable", "Escuchó"],
    },
  },
  attorney_business_tax: {
    services: {
      en: ["Incorporation / LLC", "Contract review", "Tax planning", "Business dispute", "M&A / Sale", "Compliance", "Consultation"],
      zh: ["公司注册 / LLC", "合同审查", "税务规划", "商业纠纷", "并购 / 出售", "合规", "咨询"],
      es: ["Constitución / LLC", "Revisión de contrato", "Planificación fiscal", "Disputa comercial", "Fusiones / Venta", "Cumplimiento", "Consulta"],
    },
    qualities: {
      en: ["Strategic", "Knowledgeable", "Responsive", "Clear", "Thorough", "Professional", "Cost-effective"],
      zh: ["有策略", "知识丰富", "回应快", "讲解清楚", "细致", "专业", "性价比高"],
      es: ["Estratégico", "Conocedor", "Responde rápido", "Claro", "Minucioso", "Profesional", "Buen precio"],
    },
  },
  attorney_personal_injury: {
    services: {
      en: ["Auto accident", "Slip and fall", "Workers comp", "Medical malpractice", "Wrongful death", "Initial consult"],
      zh: ["车祸赔偿", "跌倒受伤", "工伤赔偿", "医疗事故", "意外死亡", "初次咨询"],
      es: ["Accidente automovilístico", "Caída", "Compensación laboral", "Negligencia médica", "Muerte injusta", "Consulta inicial"],
    },
    qualities: {
      en: ["Fought hard for me", "Knowledgeable", "Got fair settlement", "Responsive", "Honest", "Caring", "Clear communication"],
      zh: ["全力为我争取", "知识丰富", "争取到合理赔偿", "回应快", "诚实", "关心客户", "沟通清楚"],
      es: ["Luchó por mí", "Conocedor", "Logró acuerdo justo", "Responde rápido", "Honesto", "Atento", "Comunicación clara"],
    },
  },
  attorney_general: {
    services: {
      en: ["Consultation", "Document review", "Legal representation", "Mediation", "Court appearance"],
      zh: ["咨询", "文件审查", "法律代理", "调解", "出庭"],
      es: ["Consulta", "Revisión de documento", "Representación legal", "Mediación", "Audiencia"],
    },
    qualities: { ...GENERIC_QUALITIES },
  },

  // ===== REAL ESTATE & INSURANCE =====
  real_estate: {
    services: {
      en: ["Home buying", "Home selling", "Rental", "Investment property", "Commercial", "Consultation"],
      zh: ["购房", "卖房", "租房", "投资物业", "商业地产", "咨询"],
      es: ["Compra de vivienda", "Venta de vivienda", "Alquiler", "Inversión", "Comercial", "Consulta"],
    },
    qualities: {
      en: ["Responsive", "Knowledgeable", "Negotiates well", "Patient", "Honest", "Strong network", "Local expert", "Bilingual"],
      zh: ["回应快", "知识丰富", "谈判能力强", "有耐心", "诚实", "人脉广", "本地专家", "双语沟通"],
      es: ["Responde rápido", "Conocedor", "Buen negociador", "Paciente", "Honesto", "Buena red", "Experto local", "Bilingüe"],
    },
  },
  insurance: {
    services: {
      en: ["Auto insurance", "Home insurance", "Life insurance", "Health insurance", "Business insurance", "Claim assistance"],
      zh: ["车险", "房屋保险", "人寿保险", "健康保险", "商业保险", "理赔协助"],
      es: ["Seguro de auto", "Seguro de hogar", "Seguro de vida", "Seguro de salud", "Seguro comercial", "Asistencia con reclamo"],
    },
    qualities: {
      en: ["Honest pricing", "Explained options clearly", "Responsive", "Helpful with claim", "Patient", "Knowledgeable", "Trustworthy"],
      zh: ["定价透明", "选项讲解清楚", "回应快", "理赔帮助大", "有耐心", "知识丰富", "值得信任"],
      es: ["Precio honesto", "Explicó opciones", "Responde rápido", "Ayudó con reclamo", "Paciente", "Conocedor", "Confiable"],
    },
  },
  mortgage_loan: {
    services: {
      en: ["Home purchase loan", "Refinance", "Investment loan", "Pre-approval", "Loan modification", "Consultation"],
      zh: ["购房贷款", "再融资", "投资贷款", "预批准", "贷款修改", "咨询"],
      es: ["Préstamo para vivienda", "Refinanciamiento", "Préstamo de inversión", "Pre-aprobación", "Modificación", "Consulta"],
    },
    qualities: {
      en: ["Competitive rate", "Fast approval", "Clear about fees", "Patient", "Responsive", "Trustworthy", "Helped me qualify"],
      zh: ["利率有竞争力", "审批快", "费用透明", "有耐心", "回应快", "值得信任", "帮我成功通过"],
      es: ["Tasa competitiva", "Aprobación rápida", "Claro con tarifas", "Paciente", "Responde rápido", "Confiable", "Me ayudó a calificar"],
    },
  },

  // ===== AUTO =====
  auto_repair: {
    services: {
      en: ["Oil change", "Brakes", "Tires", "Transmission", "Engine repair", "Body work", "Diagnostic", "Inspection"],
      zh: ["换机油", "刹车", "轮胎", "变速箱", "发动机维修", "钣金", "故障诊断", "年检"],
      es: ["Cambio de aceite", "Frenos", "Neumáticos", "Transmisión", "Motor", "Carrocería", "Diagnóstico", "Inspección"],
    },
    qualities: {
      en: ["Honest pricing", "Quality work", "Fast turnaround", "Friendly", "Explains the issue", "Trustworthy", "Clean shop"],
      zh: ["价格诚实", "做工好", "速度快", "友善", "讲解问题", "值得信任", "店铺整洁"],
      es: ["Precio honesto", "Buen trabajo", "Rápido", "Amable", "Explica el problema", "Confiable", "Taller limpio"],
    },
  },
  auto_sales: {
    services: {
      en: ["New car", "Used car", "Lease", "Trade-in", "Financing", "Test drive"],
      zh: ["新车", "二手车", "租赁", "置换", "贷款融资", "试驾"],
      es: ["Coche nuevo", "Coche usado", "Arrendamiento", "Intercambio", "Financiamiento", "Prueba de manejo"],
    },
    qualities: {
      en: ["No pressure", "Honest", "Knowledgeable", "Fair price", "Smooth process", "Bilingual", "Helpful financing"],
      zh: ["不强推销售", "诚实", "知识丰富", "价格公道", "流程顺畅", "双语沟通", "贷款协助"],
      es: ["Sin presión", "Honesto", "Conocedor", "Precio justo", "Proceso fluido", "Bilingüe", "Buena financiación"],
    },
  },
  auto_detailing: {
    services: {
      en: ["Exterior wash", "Interior detail", "Full detail", "Paint correction", "Ceramic coating", "Window tint"],
      zh: ["外部洗车", "内饰美容", "全套美容", "漆面修复", "陶瓷镀膜", "贴膜"],
      es: ["Lavado exterior", "Detallado interior", "Detallado completo", "Corrección de pintura", "Recubrimiento cerámico", "Polarizado"],
    },
    qualities: {
      en: ["Like-new finish", "Attention to detail", "Friendly", "Punctual", "Worth the price", "Long-lasting"],
      zh: ["焕然一新", "注重细节", "友善", "守时", "物超所值", "持久效果"],
      es: ["Como nuevo", "Atención al detalle", "Amable", "Puntual", "Buen precio", "Duradero"],
    },
  },

  // ===== TRAVEL =====
  hotel_lodging: {
    services: {
      en: ["Standard room", "Suite", "Extended stay", "Business stay", "Family stay", "Wedding / Event"],
      zh: ["标准间", "套房", "长住", "商务出差", "家庭出游", "婚礼 / 活动"],
      es: ["Habitación estándar", "Suite", "Estancia larga", "Negocios", "Familia", "Boda / Evento"],
    },
    qualities: {
      en: ["Clean rooms", "Comfortable bed", "Friendly staff", "Quiet", "Great location", "Good breakfast", "Worth the price"],
      zh: ["房间干净", "床舒适", "服务好", "安静", "位置便利", "早餐好", "性价比高"],
      es: ["Habitación limpia", "Cama cómoda", "Personal amable", "Tranquilo", "Buena ubicación", "Buen desayuno", "Buen precio"],
    },
  },
  travel_agency: {
    services: {
      en: ["International tour", "Domestic tour", "Cruise", "Flight booking", "Hotel booking", "Custom itinerary", "Visa assistance"],
      zh: ["国际游", "国内游", "邮轮", "机票预订", "酒店预订", "定制行程", "签证协助"],
      es: ["Tour internacional", "Tour nacional", "Crucero", "Vuelos", "Hoteles", "Itinerario personalizado", "Asistencia de visa"],
    },
    qualities: {
      en: ["Great planning", "Knowledgeable", "Saved me money", "Responsive", "Trustworthy", "Bilingual", "Smooth trip"],
      zh: ["规划周到", "知识丰富", "为我省钱", "回应快", "值得信任", "双语沟通", "行程顺畅"],
      es: ["Buena planificación", "Conocedor", "Me ahorró dinero", "Responde rápido", "Confiable", "Bilingüe", "Viaje fluido"],
    },
  },

  // ===== HEALTH FOOD & PRODUCTS =====
  health_supplements: {
    services: {
      en: ["Vitamins", "Protein / Sports", "Herbal supplements", "Beauty / Skin", "Consultation", "Custom formula"],
      zh: ["维生素", "蛋白质 / 运动", "草药保健品", "美容 / 皮肤", "咨询", "定制配方"],
      es: ["Vitaminas", "Proteína / Deporte", "Suplementos herbales", "Belleza / Piel", "Consulta", "Fórmula personalizada"],
    },
    qualities: {
      en: ["Knowledgeable staff", "Quality products", "Honest recommendations", "Fair pricing", "Good selection", "Effective"],
      zh: ["员工专业", "产品优质", "诚实推荐", "价格公道", "选择多样", "有效"],
      es: ["Personal conocedor", "Productos de calidad", "Recomendaciones honestas", "Precio justo", "Buena selección", "Eficaz"],
    },
  },
  specialty_grocery: {
    services: {
      en: ["Asian groceries", "Latin / Hispanic", "Halal / Kosher", "Organic / Natural", "Fresh produce", "Imported goods"],
      zh: ["亚洲食材", "拉丁食材", "清真 / 犹太洁食", "有机 / 天然", "新鲜蔬果", "进口商品"],
      es: ["Comida asiática", "Latina / Hispana", "Halal / Kosher", "Orgánico / Natural", "Productos frescos", "Importados"],
    },
    qualities: {
      en: ["Wide selection", "Fresh", "Authentic", "Friendly staff", "Reasonable price", "Clean store", "Hard-to-find items"],
      zh: ["品种齐全", "新鲜", "正宗", "员工友善", "价格合理", "店内整洁", "稀有商品多"],
      es: ["Amplia selección", "Fresco", "Auténtico", "Personal amable", "Precio razonable", "Limpio", "Artículos difíciles de encontrar"],
    },
  },

  // ===== HOME SERVICES =====
  home_repair: {
    services: {
      en: ["HVAC", "Plumbing", "Electrical", "Handyman", "Appliance repair", "Drywall / Paint", "Emergency"],
      zh: ["暖通空调", "水管", "电路", "家居杂修", "家电维修", "石膏板 / 油漆", "紧急维修"],
      es: ["HVAC", "Plomería", "Electricidad", "Manitas", "Reparación de electrodomésticos", "Drywall / Pintura", "Urgencia"],
    },
    qualities: {
      en: ["Fast response", "Quality work", "Fair pricing", "Honest", "Clean job site", "Punctual", "Stood by their work"],
      zh: ["响应快", "做工好", "价格公道", "诚实", "现场干净", "守时", "保修负责"],
      es: ["Respuesta rápida", "Buen trabajo", "Precio justo", "Honesto", "Sitio limpio", "Puntual", "Respalda su trabajo"],
    },
  },
  cleaning_service: {
    services: {
      en: ["House cleaning", "Deep cleaning", "Move-in / Move-out", "Office cleaning", "Carpet / Upholstery", "Window cleaning"],
      zh: ["家居清洁", "深度清洁", "搬入 / 搬出清洁", "办公室清洁", "地毯 / 家具清洁", "擦窗户"],
      es: ["Limpieza de casa", "Limpieza profunda", "Mudanza", "Oficina", "Alfombra / Tapicería", "Ventanas"],
    },
    qualities: {
      en: ["Thorough", "Trustworthy", "Punctual", "Friendly", "Attention to detail", "Reasonable price", "Reliable"],
      zh: ["细致", "值得信任", "守时", "友善", "注重细节", "价格合理", "可靠"],
      es: ["Minucioso", "Confiable", "Puntual", "Amable", "Atención al detalle", "Precio razonable", "Fiable"],
    },
  },
  landscape_pest: {
    services: {
      en: ["Lawn care", "Tree service", "Mulching / Planting", "Hardscaping", "Pest control", "Termite treatment", "Snow removal"],
      zh: ["草坪维护", "树木修剪", "覆盖物 / 种植", "硬景观", "害虫防治", "白蚁处理", "除雪"],
      es: ["Cuidado del césped", "Servicio de árboles", "Mulch / Plantación", "Paisajismo duro", "Control de plagas", "Termitas", "Remoción de nieve"],
    },
    qualities: {
      en: ["Quality work", "Reliable", "Reasonable price", "Knowledgeable", "Communicative", "Beautiful result", "Eco-friendly"],
      zh: ["做工好", "可靠", "价格合理", "知识丰富", "沟通好", "效果美观", "环保"],
      es: ["Buen trabajo", "Fiable", "Precio razonable", "Conocedor", "Comunicativo", "Resultado hermoso", "Ecológico"],
    },
  },
  moving_storage: {
    services: {
      en: ["Local move", "Long-distance move", "Packing service", "Storage", "Piano / Specialty", "Office move"],
      zh: ["市内搬家", "长途搬家", "打包服务", "仓储", "钢琴 / 特殊物品", "办公室搬迁"],
      es: ["Mudanza local", "Larga distancia", "Empaque", "Almacenaje", "Piano / Especialidad", "Oficina"],
    },
    qualities: {
      en: ["Careful with items", "Fast", "Friendly crew", "Punctual", "Fair price", "Nothing damaged", "Professional"],
      zh: ["搬运小心", "速度快", "工人友善", "守时", "价格公道", "物品完好", "专业"],
      es: ["Cuidadoso con objetos", "Rápido", "Equipo amable", "Puntual", "Precio justo", "Nada dañado", "Profesional"],
    },
  },

  // ===== BEAUTY & FITNESS =====
  hair_salon: {
    services: {
      en: ["Haircut", "Color", "Highlights / Balayage", "Blowout / Style", "Perm", "Treatment", "Bridal", "Men's cut"],
      zh: ["剪发", "染发", "挑染 / 渐变染", "吹造型", "烫发", "护理", "新娘造型", "男士理发"],
      es: ["Corte", "Color", "Mechas / Balayage", "Peinado", "Permanente", "Tratamiento", "Boda", "Corte caballero"],
    },
    qualities: {
      en: ["Listened to what I wanted", "Talented stylist", "Friendly", "Reasonable price", "Clean salon", "Used quality products", "Relaxing"],
      zh: ["听取我的意见", "技术好", "友善", "价格合理", "店内干净", "用料考究", "放松"],
      es: ["Escuchó lo que quería", "Estilista talentoso", "Amable", "Precio razonable", "Salón limpio", "Productos de calidad", "Relajante"],
    },
  },
  nail_salon: {
    services: {
      en: ["Manicure", "Pedicure", "Gel / Dip powder", "Acrylics", "Nail art", "Waxing", "Eyebrow"],
      zh: ["美甲", "足疗", "光疗甲 / 蘸粉", "甲片", "美甲彩绘", "脱毛", "眉毛"],
      es: ["Manicura", "Pedicura", "Gel / Polvo", "Acrílicos", "Arte de uñas", "Depilación", "Cejas"],
    },
    qualities: {
      en: ["Attention to detail", "Friendly", "Clean / Sanitary", "Skilled", "Long-lasting", "Relaxing", "Good price"],
      zh: ["注重细节", "友善", "卫生干净", "技术好", "持久", "放松", "价格好"],
      es: ["Atención al detalle", "Amable", "Limpio / Higiénico", "Hábil", "Duradero", "Relajante", "Buen precio"],
    },
  },
  spa_massage: {
    services: {
      en: ["Deep tissue", "Swedish massage", "Foot reflexology", "Couples massage", "Facial", "Body scrub", "Sauna"],
      zh: ["深层按摩", "瑞典式按摩", "足底反射", "情侣按摩", "面部护理", "全身去角质", "桑拿"],
      es: ["Tejido profundo", "Sueco", "Reflexología", "Pareja", "Facial", "Exfoliante", "Sauna"],
    },
    qualities: {
      en: ["Skilled hands", "Relaxing atmosphere", "Clean", "Right pressure", "Friendly", "Punctual", "Worth the price"],
      zh: ["手法好", "环境放松", "干净", "力度合适", "友善", "守时", "物超所值"],
      es: ["Manos hábiles", "Ambiente relajante", "Limpio", "Presión justa", "Amable", "Puntual", "Buen precio"],
    },
  },
  gym_fitness: {
    services: {
      en: ["Membership", "Personal training", "Group class", "Yoga / Pilates", "Spin / Cardio", "Strength training", "Nutrition coaching"],
      zh: ["会员", "私教", "团课", "瑜伽 / 普拉提", "动感单车 / 有氧", "力量训练", "营养指导"],
      es: ["Membresía", "Entrenamiento personal", "Clase grupal", "Yoga / Pilates", "Spinning / Cardio", "Fuerza", "Nutrición"],
    },
    qualities: {
      en: ["Clean equipment", "Encouraging trainers", "Variety of classes", "Friendly community", "Not crowded", "Worth the price", "Saw real results"],
      zh: ["器材干净", "教练鼓励性强", "课程丰富", "氛围友好", "不拥挤", "性价比高", "效果明显"],
      es: ["Equipo limpio", "Entrenadores alentadores", "Variedad de clases", "Comunidad amable", "No abarrotado", "Buen precio", "Vi resultados"],
    },
  },

  // ===== APPAREL & RETAIL =====
  apparel_clothing: {
    services: {
      en: ["Casual wear", "Formal / Business", "Children's clothing", "Tailoring", "Bridal / Special occasion", "Consultation"],
      zh: ["休闲服装", "正装 / 商务", "童装", "裁缝", "婚礼 / 特殊场合", "搭配咨询"],
      es: ["Casual", "Formal / Negocios", "Niños", "Sastrería", "Boda / Ocasión especial", "Asesoría"],
    },
    qualities: {
      en: ["Quality fabric", "Good fit", "Friendly staff", "Reasonable price", "Helpful suggestions", "Unique selection", "Clean store"],
      zh: ["面料好", "版型合身", "员工友善", "价格合理", "搭配建议好", "选择独特", "店内整洁"],
      es: ["Tela de calidad", "Buen ajuste", "Personal amable", "Precio razonable", "Buenas sugerencias", "Selección única", "Tienda limpia"],
    },
  },
  jewelry_watch: {
    services: {
      en: ["Engagement ring", "Custom design", "Repair / Resize", "Watch repair", "Appraisal", "Cleaning", "Gold / Silver"],
      zh: ["订婚戒指", "定制设计", "维修 / 改尺寸", "钟表维修", "估价", "清洁", "黄金 / 银饰"],
      es: ["Anillo de compromiso", "Diseño personalizado", "Reparación / Ajuste", "Reparación de reloj", "Tasación", "Limpieza", "Oro / Plata"],
    },
    qualities: {
      en: ["Quality craftsmanship", "Trustworthy", "Honest pricing", "Beautiful selection", "Helpful with custom design", "Professional"],
      zh: ["工艺精湛", "值得信任", "定价诚实", "款式精美", "定制服务好", "专业"],
      es: ["Excelente artesanía", "Confiable", "Precio honesto", "Hermosa selección", "Excelente diseño personalizado", "Profesional"],
    },
  },
  shoes_accessories: {
    services: {
      en: ["Shoes", "Bags / Handbags", "Belts / Wallets", "Sunglasses", "Hats", "Repair"],
      zh: ["鞋", "包 / 手袋", "腰带 / 钱包", "太阳镜", "帽子", "维修"],
      es: ["Zapatos", "Bolsos", "Cinturones / Carteras", "Gafas de sol", "Sombreros", "Reparación"],
    },
    qualities: {
      en: ["Quality", "Comfortable", "Stylish", "Friendly staff", "Helpful with fit", "Reasonable price", "Good selection"],
      zh: ["质量好", "舒适", "时尚", "员工友善", "选码帮助大", "价格合理", "款式多"],
      es: ["Calidad", "Cómodo", "Estiloso", "Personal amable", "Ayuda con la talla", "Precio razonable", "Buena selección"],
    },
  },

  // ===== EDUCATION & TUTORING =====
  tutoring_test_prep: {
    services: {
      en: ["Math tutoring", "Reading / Writing", "Science tutoring", "SAT / ACT prep", "MCAT / GRE / LSAT", "After-school program", "College admissions"],
      zh: ["数学辅导", "阅读 / 写作", "科学辅导", "SAT / ACT 备考", "MCAT / GRE / LSAT", "课后辅导", "大学申请"],
      es: ["Tutoría de matemáticas", "Lectura / Escritura", "Ciencias", "Preparación SAT / ACT", "MCAT / GRE / LSAT", "Programa extraescolar", "Admisiones universitarias"],
    },
    qualities: {
      en: ["Patient", "Knowledgeable", "Effective", "Encouraging", "My child improved", "Clear explanations", "Engaging teacher"],
      zh: ["有耐心", "知识丰富", "有效", "鼓励性强", "孩子进步明显", "讲解清楚", "教学生动"],
      es: ["Paciente", "Conocedor", "Eficaz", "Alentador", "Mi hijo mejoró", "Explica claramente", "Maestro atractivo"],
    },
  },
  language_school: {
    services: {
      en: ["English / ESL", "Mandarin / Chinese", "Spanish", "French / Other", "Conversation class", "Business language", "Children's class"],
      zh: ["英语 / ESL", "中文 / 普通话", "西班牙语", "法语 / 其他", "口语课", "商务语言", "儿童课程"],
      es: ["Inglés / ESL", "Mandarín / Chino", "Español", "Francés / Otros", "Conversación", "Idioma de negocios", "Clases para niños"],
    },
    qualities: {
      en: ["Effective method", "Patient teachers", "Small class size", "Engaging", "Saw real progress", "Native speakers", "Affordable"],
      zh: ["方法有效", "老师有耐心", "小班授课", "课程生动", "进步明显", "母语老师", "学费合理"],
      es: ["Método eficaz", "Maestros pacientes", "Clases pequeñas", "Atractivo", "Vi progreso", "Hablantes nativos", "Asequible"],
    },
  },
  translation_immigration: {
    services: {
      en: ["Document translation", "Notary public", "Immigration paperwork", "Apostille service", "Certificate translation", "Interpretation"],
      zh: ["文件翻译", "公证服务", "移民文件", "海牙认证", "证书翻译", "口译"],
      es: ["Traducción de documentos", "Notario público", "Documentos de inmigración", "Apostilla", "Traducción de certificados", "Interpretación"],
    },
    qualities: {
      en: ["Fast turnaround", "Accurate", "Affordable", "Bilingual / Multilingual", "Knowledgeable about process", "Patient", "Trustworthy"],
      zh: ["速度快", "准确无误", "价格实惠", "双语 / 多语", "熟悉流程", "有耐心", "值得信任"],
      es: ["Rápido", "Preciso", "Asequible", "Bilingüe / Multilingüe", "Conoce el proceso", "Paciente", "Confiable"],
    },
  },

  // ===== PROFESSIONAL SERVICES =====
  accounting_tax: {
    services: {
      en: ["Personal tax", "Business tax", "Bookkeeping", "Payroll", "Tax planning", "IRS audit support", "Incorporation"],
      zh: ["个人报税", "企业报税", "记账", "工资单", "税务规划", "国税局审计协助", "公司注册"],
      es: ["Impuestos personales", "Impuestos comerciales", "Contabilidad", "Nómina", "Planificación fiscal", "Auditoría IRS", "Constitución"],
    },
    qualities: {
      en: ["Knowledgeable", "Found me deductions", "Honest", "Responsive", "Bilingual", "Reasonable price", "Trustworthy"],
      zh: ["知识丰富", "为我找到减免", "诚实", "回应快", "双语沟通", "价格合理", "值得信任"],
      es: ["Conocedor", "Encontró deducciones", "Honesto", "Responde rápido", "Bilingüe", "Precio razonable", "Confiable"],
    },
  },
  financial_advisor: {
    services: {
      en: ["Retirement planning", "Investment management", "College savings", "Estate planning", "Tax-advantaged strategies", "Consultation"],
      zh: ["退休规划", "投资管理", "教育储蓄", "遗产规划", "税务优化策略", "咨询"],
      es: ["Planificación de jubilación", "Gestión de inversiones", "Ahorro universitario", "Patrimonio", "Estrategias fiscales", "Consulta"],
    },
    qualities: {
      en: ["Trustworthy", "Knowledgeable", "Listens to goals", "Transparent fees", "Patient", "Strategic", "Honest about risk"],
      zh: ["值得信任", "知识丰富", "了解目标", "费用透明", "有耐心", "有策略", "诚实告知风险"],
      es: ["Confiable", "Conocedor", "Escucha objetivos", "Tarifas transparentes", "Paciente", "Estratégico", "Honesto sobre el riesgo"],
    },
  },
  professional_general: {
    services: {
      en: ["Photography", "Graphic design", "Marketing", "Consulting", "Printing", "Web / Tech support"],
      zh: ["摄影", "平面设计", "营销", "咨询", "印刷", "网络 / 技术支持"],
      es: ["Fotografía", "Diseño gráfico", "Marketing", "Consultoría", "Impresión", "Web / Soporte técnico"],
    },
    qualities: { ...GENERIC_QUALITIES },
  },

  // ===== FALLBACK =====
  other: {
    services: {
      en: ["Visit", "Service", "Consultation", "Appointment"],
      zh: ["到访", "服务", "咨询", "预约"],
      es: ["Visita", "Servicio", "Consulta", "Cita"],
    },
    qualities: { ...GENERIC_QUALITIES },
  },
};

/** Pick the trilingual chip set for a given category + language. */
export function getServicesForCategory(
  category: ReviewCategory,
  lang: Language,
): readonly string[] {
  return PRESETS[category]?.services[lang] ?? PRESETS.other.services[lang];
}

export function getQualitiesForCategory(
  category: ReviewCategory,
  lang: Language,
): readonly string[] {
  return PRESETS[category]?.qualities[lang] ?? PRESETS.other.qualities[lang];
}

/** Narrow an arbitrary string to a valid ReviewCategory (or 'other'). */
export function asReviewCategory(value: string | null | undefined): ReviewCategory {
  if (!value) return "other";
  return (REVIEW_CATEGORIES as readonly string[]).includes(value)
    ? (value as ReviewCategory)
    : "other";
}
