import { SponsorRecord } from '../types/career';
import { normalizeCompanyName } from '../server/sponsorMatcher';

const RAW_SPONSORS: Array<{
  name: string;
  city: string;
  county: string;
  rating: string;
  route: string;
}> = [
  { name: 'Arm Limited', city: 'Cambridge', county: 'Cambridgeshire', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Google UK Limited', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Revolut Ltd', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Meta Platforms Ireland Limited', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Amazon Web Services UK Limited', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'BP P.L.C.', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'DeepMind Technologies Limited', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Monzo Bank Limited', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Wise Payments Ltd', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Deliveroo', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Spotify UK Limited', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'JPMorgan Chase Bank, N.A.', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Goldman Sachs International', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Bloomberg L.P.', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'AstraZeneca UK Limited', city: 'Cambridge', county: 'Cambridgeshire', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Stripe Payments UK Limited', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Palantir Technologies UK, Ltd.', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Datadog UK Limited', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Cloudflare UK Limited', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'GitLab UK Limited', city: 'Reading', county: 'Berkshire', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Snowflake Computing UK Ltd', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Cisco Systems Limited', city: 'Feltham', county: 'Middlesex', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Microsoft Limited', city: 'Reading', county: 'Berkshire', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Salesforce.com UK Ltd', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'S3 Chemicals Limited', city: 'Manchester', county: 'Greater Manchester', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'BT Group PLC', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Starling Bank Limited', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Checkout.com', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Graphcore Limited', city: 'Bristol', county: 'Bristol', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Improbable Worlds Limited', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Darktrace Holdings Limited', city: 'Cambridge', county: 'Cambridgeshire', rating: 'Worker (A rating)', route: 'Skilled Worker' },
  { name: 'Twitter UK Ltd', city: 'London', county: 'Greater London', rating: 'Worker (A rating)', route: 'Skilled Worker' }
];

export const SPONSOR_REGISTRY: SponsorRecord[] = RAW_SPONSORS.map((s, idx) => ({
  id: idx + 1,
  organisationName: s.name,
  organisationNormalized: normalizeCompanyName(s.name),
  townCity: s.city,
  county: s.county,
  typeRating: s.rating,
  route: s.route,
}));
