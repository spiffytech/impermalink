export interface User {
  email: string;
  scrypt: string;
  salt: string;
  lastLogin: string;
  recycleBinSize: number;
  apiKey: string;
}

export interface Link {
  id: number;
  email: string;
  domain: string;
  url: string;
  title: string | null;
  dateSaved: string;
  dateDeleted: string | null;
}
export type NewLink = Omit<Link, "id" | "dateSaved" | "dateDeleted">;
