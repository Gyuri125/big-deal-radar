export type DealCategory =
  | 'mozi'
  | 'kultura'
  | 'muzeum'
  | 'gasztro'
  | 'utazas'
  | 'vasarlas'
  | 'penzugy'
  | 'egeszseg'
  | 'csalad'
  | 'egyeb';

export type DealType = 'flat' | 'free' | 'sale' | 'money' | 'access';

export type Confidence = 'verified' | 'unverified' | 'needs-check';

export type Recurrence =
  | 'annual'
  | 'monthly'
  | 'weekly'
  | 'daily'
  | 'continuous'
  | 'oneoff';

export interface Deal {
  id: string;
  title: string;
  category: DealCategory;
  type: DealType;
  timing: string;
  date_start: string | null;
  date_end: string | null;
  booking_opens: string | null;
  month: number | null;
  months: number[];
  recurrence: Recurrence;
  deal: string;
  normal_price: number | null;
  deal_price: number | null;
  currency: 'HUF' | 'EUR' | null;
  location: string;
  source_url: string | null;
  booking_url: string | null;
  booking_note: string | null;
  confidence: Confidence;
  tags: string[];
  notes: string | null;
  featured: boolean;
}

export type DealOverride = Partial<Omit<Deal, 'id' | 'title'>>;
