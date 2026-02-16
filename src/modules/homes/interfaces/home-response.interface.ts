export interface HomeResponse {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  ringUrl: string;
}

export interface HomeQrResponse {
  home: HomeResponse;
  qrUrl: string;
}
