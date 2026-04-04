export type Report = {
  id: string;
  category: string;
  latitude: number;
  longitude: number;
  photo_url: string;
  status: string;
  description: string;
  address: string | null;
  created_at: string;
};

export type ReportCategory = 'pothole' | 'litter' | 'garbage_bin' | 'graffiti' | 'other';
export type ReportStatus = 'pending' | 'acknowledged' | 'resolved';
