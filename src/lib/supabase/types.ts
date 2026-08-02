/**
 * Types de la base de données AscoSys.
 * Reflète supabase/migrations/0001_init.sql.
 * (Peut être régénéré plus tard avec `supabase gen types typescript`.)
 */

export type ClientType = "entreprise" | "artisan" | "particulier";

export type Client = {
  id: string;
  company_name: string;
  contact_person: string | null;
  client_type: ClientType;
  rc: string | null;
  carte_artisan: string | null;
  nif: string | null;
  art: string | null;
  nis: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  industry_type: string | null;
  notes: string | null;
  solde_ouverture: number;
  created_at: string;
};

export type Forme = {
  id: string;
  ref: string;
  fournisseur: string | null;
  longueur: number | null;
  largeur: number | null;
  hauteur: number | null;
  hauteur_couvercle: number | null;
  longueur_forme: number | null;
  largeur_forme: number | null;
  nb_poses: number | null;
  laize_utilisee: string | null;
  poids_par_feuille: number | null;
  storage_location: string | null;
  notes: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  ref: string | null;
  client_id: string | null;
  forme_id: string | null;
  trace: string | null; // chemin du PDF de tracé dans le bucket "traces"
  active: boolean;
  created_at: string;
};

export type ProductPrice = {
  id: string;
  product_id: string;
  client_id: string | null; // null = prix général ; sinon prix spécifique à ce client
  prix_unitaire: number;
  valid_from: string;
  created_at: string;
};

/** Prix « facture / BL de route » (fictif) mémorisé pour un couple (client, produit). */
export type FictivePrice = {
  client_id: string;
  product_id: string;
  prix_unitaire: number;
  updated_at: string;
};

export type SalesDocumentType = "bon" | "facture";
export type SalesDocumentStatut = "brouillon" | "valide" | "paye";

export type SalesDocument = {
  id: string;
  numero: string;
  date: string;
  client_id: string;
  type: SalesDocumentType;
  tva_rate: number;
  total_ht: number;
  total_tva: number;
  timbre: number;
  total_ttc: number;
  paiement_mode: PaymentMode | null;
  statut: SalesDocumentStatut;
  historique: boolean;
  notes: string | null;
  created_at: string;
};

export type SalesDocumentLine = {
  id: string;
  document_id: string;
  product_id: string | null;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  total_ht: number;
  position: number;
};

export type PaymentMode = "cheque" | "espece" | "virement";

export type Payment = {
  id: string;
  client_id: string;
  document_id: string | null;
  date: string;
  montant: number;
  mode: PaymentMode;
  reference: string | null;
  note: string | null;
  created_at: string;
};

export type Caisse = {
  id: string;
  date: string;
  entree: number;
  sortie: number;
  observation: string | null;
  action_par: string | null;
  created_at: string;
};

export type TransactionDirection = "in" | "out";

export type TransactionCategory = {
  id: string;
  name: string;
  direction: TransactionDirection | "both";
  color: string;
  sort_order: number;
  active: boolean;
  is_system: boolean;
  created_at: string;
};

export type Transaction = {
  id: string;
  date: string;
  direction: TransactionDirection;
  montant: number;
  category_id: string | null;
  tiers: string | null;
  reference: string | null;
  description: string | null;
  created_at: string;
};

export type TransactionRunning = Transaction & { solde: number };

export type Employee = {
  id: string;
  name: string;
  role: string | null;
  salaire_mensuel: number;
  active: boolean;
  created_at: string;
};

export type SalaryEntryType = "accrual" | "avance" | "paiement";

export type SalaryEntry = {
  id: string;
  employee_id: string;
  date: string;
  type: SalaryEntryType;
  montant: number;
  note: string | null;
  created_at: string;
};

export type Leave = {
  id: string;
  employee_id: string;
  date: string;
  jours: number;
  type: string | null;
  note: string | null;
  created_at: string;
};

export type ProspectStatus = "nouveau" | "en_discussion" | "gagne" | "perdu";

export type Prospect = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  industry_type: string | null;
  notes: string | null;
  status: ProspectStatus;
  client_id: string | null;
  created_at: string;
};

export type ProformaStatut = "brouillon" | "envoye" | "valide" | "refuse";

export type Proforma = {
  id: string;
  numero: string;
  prospect_id: string | null;
  client_id: string | null;
  date: string;
  tva_rate: number;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  statut: ProformaStatut;
  notes: string | null;
  created_at: string;
};

export type ProformaLine = {
  id: string;
  proforma_id: string;
  product_id: string | null;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  total_ht: number;
  position: number;
};

export type ProspectDeposit = {
  id: string;
  prospect_id: string;
  proforma_id: string | null;
  date: string;
  montant: number;
  mode: PaymentMode;
  note: string | null;
  created_at: string;
};

export type OrderShift = "matin" | "soir";
export type OrderStatut = "en_attente" | "en_cours" | "termine" | "livre";

export type OrderQueue = {
  id: string;
  client_id: string | null;
  product_id: string | null;
  designation: string;
  quantite: number;
  laize_utilisee: string | null;
  date_prevue: string | null;
  shift: OrderShift;
  priority: number;
  statut: OrderStatut;
  proforma_id: string | null;
  notes: string | null;
  created_at: string;
};

/* -------- Vues -------- */
export type ClientBalance = {
  client_id: string;
  company_name: string;
  solde_ouverture: number;
  total_facture: number;
  total_paye: number;
  solde: number;
};

export type CaisseRunning = Caisse & { solde: number };

export type EmployeeBalance = {
  employee_id: string;
  name: string;
  salaire_mensuel: number;
  total_du: number;
  total_verse: number;
  reste_a_payer: number;
};

/** Helper de table pour le client Supabase typé. */
type TableConfig<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type ViewConfig<Row> = { Row: Row; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      profiles: TableConfig<{
        id: string;
        full_name: string | null;
        role: "admin" | "commercial" | "atelier";
        created_at: string;
      }>;
      clients: TableConfig<Client>;
      formes: TableConfig<Forme>;
      products: TableConfig<Product>;
      product_prices: TableConfig<ProductPrice>;
      sales_documents: TableConfig<SalesDocument>;
      sales_document_lines: TableConfig<SalesDocumentLine>;
      payments: TableConfig<Payment>;
      caisse: TableConfig<Caisse>;
      transaction_categories: TableConfig<TransactionCategory>;
      transactions: TableConfig<Transaction>;
      facture_counters: TableConfig<{ year: number; last: number }>;
      bl_counters: TableConfig<{ year: number; month: number; last: number }>;
      employees: TableConfig<Employee>;
      salary_entries: TableConfig<SalaryEntry>;
      leaves: TableConfig<Leave>;
      prospects: TableConfig<Prospect>;
      proformas: TableConfig<Proforma>;
      proforma_lines: TableConfig<ProformaLine>;
      prospect_deposits: TableConfig<ProspectDeposit>;
      order_queue: TableConfig<OrderQueue>;
      proforma_counters: TableConfig<{ year: number; last: number }>;
      fictive_prices: TableConfig<FictivePrice>;
    };
    Views: {
      client_balance: ViewConfig<ClientBalance>;
      caisse_running: ViewConfig<CaisseRunning>;
      transactions_running: ViewConfig<TransactionRunning>;
      employee_balance: ViewConfig<EmployeeBalance>;
    };
    Functions: {
      next_facture_numero: { Args: Record<string, never>; Returns: string };
      next_bl_numero: { Args: Record<string, never>; Returns: string };
      next_proforma_numero: { Args: Record<string, never>; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
