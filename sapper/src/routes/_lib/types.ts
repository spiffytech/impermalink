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
  description: string | null;
  dateSaved: string;
  dateDeleted: string | null;
  body: string | null;
  favicon: string | null;
  faviconColor: string | null;
  faviconTailwindColor: string | null;
}
export type NewLink = Omit<Link, "id" | "dateSaved" | "dateDeleted">;

export type LinkGroup = { domain: string; links: Link[] };
